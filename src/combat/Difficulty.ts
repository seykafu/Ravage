// Per-battle difficulty bump applied at unit-instantiation time.
//
// Design intent — the original B1-B13 enemy stats were tuned to be
// approachable for new players in roughly the order they'd be played.
// Once the campaign filled out, B2-B13 felt a touch easy for a player
// who'd internalized stances + AP + the weapon triangle. This module
// applies a small global stat bump to every battle EXCEPT the tutorial
// (B1 — the palace coup, where the player's about to lose by design
// regardless of mechanics).
//
// Why not just edit each battle's enemy roster? Two reasons:
//   * Centralizing the knob means a future "easy / normal / hard"
//     difficulty selector lives in exactly one place, not 30.
//   * It cleanly opts B1 out without scattering "if (battleId === ...)"
//     guards through the data layer.
//
// Bosses are NOT bumped — they're already tuned to be the hardest part
// of their respective fights, and stacking +HP on a boss who already
// holds position until the squad has thinned the guards turns the
// closing minute of every battle into a slog.
//
// Future: a `DIFFICULTY_PROFILES` map keyed off save.difficulty (when
// that lands) will replace the simple is-tutorial check.

import type { BattleId } from "../data/contentIds";
import type { UnitDef } from "./types";

// Battle ids that play at the original baseline (no bump). Today this is
// just the tutorial. Add other "designed-to-be-easy" entries here if /
// when they land — e.g., a recovery battle after a story death.
const BASELINE_BATTLES: ReadonlySet<BattleId> = new Set<BattleId>([
  "b01_palace_coup"
]);

// The bump itself. Conservative — +2 HP / +1 power across the board is
// roughly "one extra clean swing of survival" on most mooks without
// tipping into "you cannot win this without a Royal Lens" territory.
// Armor intentionally NOT bumped — armor scales damage non-linearly
// (damage = power - armor with a floor of 1), so even +1 armor on a
// stack of mooks compounds into a meaningful slog.
const HP_BUMP = 2;
const POWER_BUMP = 1;

export const applyDifficultyToEnemy = (def: UnitDef, battleId: BattleId): UnitDef => {
  if (BASELINE_BATTLES.has(battleId)) return def;
  // Bosses skip the bump — they're already long fights.
  if (def.classKind === "boss") return def;
  return {
    ...def,
    stats: {
      ...def.stats,
      hp: def.stats.hp + HP_BUMP,
      power: def.stats.power + POWER_BUMP
    }
  };
};
