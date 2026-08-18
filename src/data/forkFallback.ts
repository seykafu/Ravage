import { battleById } from "./battles";
import { PLAYERS } from "./units";
import { createUnit } from "../combat/Unit";
import { catchUpToSquad } from "../combat/Progression";
import { PATH_FORK_BATTLE, type CharacterRecord, type SaveState } from "../util/save";

// Reconstructing a Seven Paths fork snapshot for saves that predate them.
//
// Snapshots are written when B18 resolves, so any campaign finished
// before that feature shipped has none — and the another-path rewind
// used to fall back to keeping the squad exactly as it ended: level 20
// veterans replaying chapter 19. That's the opposite of the point.
//
// We can't recover what those characters ACTUALLY were at the fork, but
// we can rebuild what the design expects them to be: the factory unit
// caught up to the level B18's own enemies are authored at, using the
// same deterministic progression math the catch-up rule uses everywhere
// else. Promotions are preserved from the live record — they're earned
// permanently, and most land before the fork anyway.

// The design's intended squad level at the fork = the average level of
// the enemies B18 fields. Falls back to 13 if the node ever loses its
// roster (the authored value at time of writing).
export const forkLevel = (): number => {
  const node = battleById(PATH_FORK_BATTLE);
  const enemies = node?.buildEnemies?.() ?? [];
  if (enemies.length === 0) return 13;
  return Math.max(1, Math.round(enemies.reduce((n, e) => n + e.level, 0) / enemies.length));
};

// Build a stand-in snapshot from a finished save. Levels and stats come
// from the reconstruction above; the item pool is the one thing we
// genuinely cannot recover, so it keeps what the save has.
export const synthesizeForkSnapshot = (s: SaveState): NonNullable<SaveState["pathForkSnapshot"]> => {
  const target = forkLevel();
  const out: Record<string, CharacterRecord> = {};
  for (const [id, rec] of Object.entries(s.characters ?? {})) {
    const factory = PLAYERS[id as keyof typeof PLAYERS];
    if (!factory) { out[id] = rec; continue; }
    const unit = createUnit(factory(), { x: 0, y: 0 });
    if (unit.level < target) catchUpToSquad(unit, target);
    out[id] = {
      level: unit.level,
      xp: 0,
      stats: { ...unit.stats },
      // Promotions are permanent and mostly pre-fork — keep them.
      ...(rec.classKind ? { classKind: rec.classKind } : {}),
      ...(rec.abilities ? { abilities: [...rec.abilities] } : {}),
      ...(rec.spriteClassOverride ? { spriteClassOverride: rec.spriteClassOverride } : {})
    };
  }
  return {
    characters: out,
    // Bags fold into the pool, same as a real capture — the rewind
    // clears assignedInventory, so anything left only in a character's
    // bag would be destroyed.
    squadInventory: JSON.parse(JSON.stringify([
      ...(s.squadInventory ?? []),
      ...Object.values(s.assignedInventory ?? {}).flat()
    ])),
    // A legacy save records no fork-era death count and there is no way
    // to recover one — deaths are a running total with no per-chapter
    // history. 0 is the generous reading and much closer to the truth
    // at chapter 18 than the finished run's total would be.
    squadDeaths: 0,
    takenAt: "reconstructed"
  };
};
