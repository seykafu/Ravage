import { BATTLES, battleById } from "./battles";
import type { BattleId, SevenPath } from "./contentIds";
import type { SaveState } from "../util/save";

// Unlock reconciliation.
//
// A battle's victory unlocks the next one, so `unlockedBattles` is
// really a CACHE derived from `completedBattles`. That cache goes stale
// whenever the unlock graph changes after someone has already played
// through it: when B28 started unlocking the epilogue, every save that
// had already beaten B28 was left with Chapter 29 locked forever,
// because the unlock event was in the past.
//
// reconcileUnlocks recomputes the cache from what the player has
// actually completed. It only ever ADDS — a manually-unlocked battle
// (dev jump, future new-game-plus) is never taken away.

// Mirrors BattleScene.checkEnd's unlock semantics: an explicit
// `unlocks` field wins (including null, meaning "unlocks nothing"),
// otherwise the next battle in campaign order.
export const nextAfterVictory = (id: BattleId): BattleId | null => {
  const node = battleById(id);
  if (!node) return null;
  if (node.unlocks !== undefined) return node.unlocks;
  const idx = BATTLES.findIndex((b) => b.id === node.id);
  return idx >= 0 && idx + 1 < BATTLES.length ? BATTLES[idx + 1]!.id : null;
};

export const reconcileUnlocks = (s: SaveState, path: SevenPath | null): SaveState => {
  const unlocked = new Set(s.unlockedBattles);
  const before = unlocked.size;

  // The opener is always available.
  unlocked.add("b01_palace_coup");

  for (const id of s.completedBattles) {
    // Anything already played is obviously reachable.
    unlocked.add(id);
    // B18's unlock belongs to ChoiceScene — it opens the chosen path's
    // B19, which the static graph can't know.
    if (id === "b18_path_chosen") {
      if (path) unlocked.add(`b19_path_opener_${path}`);
      continue;
    }
    const next = nextAfterVictory(id as BattleId);
    if (next) unlocked.add(next);
  }

  if (unlocked.size === before) return s;
  return { ...s, unlockedBattles: [...unlocked] };
};
