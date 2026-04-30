// Progression — XP awards, level-up rolls, growth-table application,
// catch-up rule for late-joining veterans.
//
// See docs/RAVAGE_DESIGN.md §4 for the full design rationale and tuning
// tables. This module is the single source of truth for every formula;
// other code (BattleScene, EndScene, save) should never reimplement them.
//
// Determinism: growth rolls take an injected `roll` callback (typically a
// closure over Math.random or an Rng). Tests pass a deterministic stub.

import { LEVEL_CAP, MAX_ABILITIES, XP_PER_LEVEL, type Ability, type GrowthTable, type Unit, type UnitStats } from "./types";
import type { CharacterRecord } from "../util/save";
import type { PromotionData } from "../data/promotions";

// ---- XP rewards ---------------------------------------------------------

// Base XP per defender class tag. The ENEMIES factory tag is implicit:
// regular bandits / mooks fall through to the default; royal_guard /
// royal_archer are "elite"; classKind === "boss" wins.
//
// Tweakable. Doubling these makes the game ~half as long; halving makes
// it twice as long. The level-difference modifier handles fine-grained
// pacing inside a single battle.
const BASE_XP_MOOK = 30;
const BASE_XP_ELITE = 50;
const BASE_XP_BOSS = 100;

// Tag check — `tags` is a ReadonlySet<string> on UnitDef. ENEMIES factories
// set "elite" on the units that should give Elite XP.
const isElite = (u: Unit): boolean => !!u.tags && u.tags.has("elite");
const isBoss = (u: Unit): boolean => u.classKind === "boss";

const baseXpFor = (defender: Unit): number => {
  if (isBoss(defender)) return BASE_XP_BOSS;
  if (isElite(defender)) return BASE_XP_ELITE;
  return BASE_XP_MOOK;
};

// XP earned for landing the killing blow. The level-difference modifier
// scales by ±10% per level diff and clamps to [0.30, 2.00] so neither
// farming under-leveled mooks nor stomping over-leveled bosses produces
// degenerate XP swings.
//
//   diff = defender.level - attacker.level
//   multiplier = clamp(1 + 0.10 * diff, 0.30, 2.00)
//   awarded = round(baseXP * multiplier)
//
// Killing a unit 7+ levels below you still gives 30% of base; killing one
// 10+ levels above you caps at 200%.
export const xpRewardFor = (attacker: Unit, defender: Unit): number => {
  const base = baseXpFor(defender);
  const diff = defender.level - attacker.level;
  const mult = Math.max(0.30, Math.min(2.00, 1 + 0.10 * diff));
  return Math.round(base * mult);
};

// ---- Level-up rolls -----------------------------------------------------

export type StatGain = Partial<Record<keyof UnitStats, number>>;

// Roll one level's worth of growths against `growths` and apply +1 to each
// stat that hits. The `roll` callback returns a number in [0, 1) — pass
// Math.random in production, a stubbed value in tests.
//
// Returns the gained stats so the UI can show "+HP +SPD" floaters and the
// log can describe what changed. The `unit.stats` object is mutated in
// place (the unit *is* its stats post-level-up).
export const applyOneLevel = (
  unit: Unit,
  growths: GrowthTable,
  roll: () => number = Math.random
): StatGain => {
  const gained: StatGain = {};
  // For each stat, roll growths[stat]% chance of +1. Convert to fraction.
  const pct = (g: number): number => g / 100;
  if (roll() < pct(growths.hp))       { unit.stats.hp += 1;       gained.hp = 1; }
  if (roll() < pct(growths.power))    { unit.stats.power += 1;    gained.power = 1; }
  if (roll() < pct(growths.armor))    { unit.stats.armor += 1;    gained.armor = 1; }
  if (roll() < pct(growths.speed))    { unit.stats.speed += 1;    gained.speed = 1; }
  if (roll() < pct(growths.movement)) { unit.stats.movement += 1; gained.movement = 1; }
  // HP gains heal up to the new max (FE convention) — the unit gets a small
  // mid-battle bump on level-up rather than the gain being invisible until
  // their next full restore.
  if (gained.hp) unit.state.hp = Math.min(unit.stats.hp, unit.state.hp + 1);
  return gained;
};

// Award XP and run any level-ups it triggers. Returns the (possibly multiple)
// level-up reports so the caller can sequence floaters / log lines for each.
//
// Capped at LEVEL_CAP (20). Once a unit hits the cap, further XP is
// discarded — `xp` stays at 0 at max level.
export interface LevelUpReport {
  newLevel: number;
  gained: StatGain;
}

export const awardXp = (
  unit: Unit,
  amount: number,
  roll: () => number = Math.random
): { totalAwarded: number; levelUps: LevelUpReport[] } => {
  const reports: LevelUpReport[] = [];
  if (unit.level >= LEVEL_CAP) return { totalAwarded: 0, levelUps: reports };
  let remaining = amount;
  let totalAwarded = 0;

  while (remaining > 0 && unit.level < LEVEL_CAP) {
    const toFill = XP_PER_LEVEL - unit.state.xp;
    if (remaining < toFill) {
      unit.state.xp += remaining;
      totalAwarded += remaining;
      remaining = 0;
      break;
    }
    // Filled a level. Drain the threshold, level up, roll growths.
    unit.state.xp = 0;
    totalAwarded += toFill;
    remaining -= toFill;
    unit.level += 1;
    const gained = unit.growths ? applyOneLevel(unit, unit.growths, roll) : {};
    reports.push({ newLevel: unit.level, gained });
    if (unit.level >= LEVEL_CAP) {
      // Discard any leftover XP — capped units can't bank for the future.
      remaining = 0;
    }
  }
  return { totalAwarded, levelUps: reports };
};

// ---- Catch-up rule (original-8 veterans rejoining) ----------------------

// When a veteran (Selene, Ranatoli, etc.) rejoins the active squad after the
// rest of the squad has out-leveled them, fast-forward them to keep pace.
// They retain their narrative L10 baseline; if the squad's average level is
// higher, they catch up to (squad_avg - 2), capped at LEVEL_CAP.
//
// Mutates `unit` in place. Returns the number of levels gained (0 if no
// catch-up was needed). The caller can use that count for "Selene catches
// up: +N levels" log lines if desired.
//
// Why (squad_avg - 2) instead of squad_avg flat? Veterans should feel
// strong at rejoin, but not OP — leaving them slightly behind the squad
// average preserves the player's reward for leveling their core team and
// avoids "always swap to whoever just rejoined" degenerate strategy.
export const catchUpToSquad = (
  unit: Unit,
  squadAverageLevel: number,
  roll: () => number = Math.random
): number => {
  const target = Math.min(LEVEL_CAP, squadAverageLevel - 2);
  if (target <= unit.level) return 0;
  const levelsToGain = target - unit.level;
  for (let i = 0; i < levelsToGain; i++) {
    unit.level += 1;
    if (unit.growths) applyOneLevel(unit, unit.growths, roll);
  }
  return levelsToGain;
};

// Compute the squad's average level for catch-up purposes. Excludes the
// rejoining unit so they don't pull the average down themselves.
export const squadAverageLevel = (squad: Unit[], excludeId?: string): number => {
  const eligible = squad.filter((u) => u.faction === "player" && u.id !== excludeId);
  if (eligible.length === 0) return 1;
  const sum = eligible.reduce((acc, u) => acc + u.level, 0);
  return Math.round(sum / eligible.length);
};

// ---- Story-gated promotion ----------------------------------------------

// Apply a promotion to a CharacterRecord. Pure — returns a new record with
// the boosted stats, new classKind, second ability slot filled, and
// optional spriteClassOverride. Caller writes the result back to the save.
//
// If the unit has already been promoted (record.classKind matches the
// promotion target), this is a no-op — re-firing the promote beat (e.g.,
// via DevJump replays) won't double-stack the stat boost.
export const promoteCharacter = (
  rec: CharacterRecord,
  data: PromotionData
): CharacterRecord => {
  if (rec.classKind === data.toClass) return rec;

  const boosted: UnitStats = {
    hp:       rec.stats.hp       + (data.statBoost.hp       ?? 0),
    power:    rec.stats.power    + (data.statBoost.power    ?? 0),
    armor:    rec.stats.armor    + (data.statBoost.armor    ?? 0),
    speed:    rec.stats.speed    + (data.statBoost.speed    ?? 0),
    movement: rec.stats.movement + (data.statBoost.movement ?? 0),
    ap:       rec.stats.ap       + (data.statBoost.ap       ?? 0)
  };

  // Second ability slot fills with the Tier 2 signature. If the unit
  // already has 2 abilities (the cap), the new one replaces the second
  // slot — never overwrite the first slot, which is the unit's signature
  // Tier 1 ability (Lucian's Aide, Leo's Destruct, etc.).
  const existing = rec.abilities ?? [];
  let newAbilities: Ability[];
  if (existing.length === 0) {
    newAbilities = [data.newAbility];
  } else if (existing.length < MAX_ABILITIES) {
    newAbilities = [...existing, data.newAbility];
  } else {
    newAbilities = [existing[0]!, data.newAbility];
  }

  return {
    ...rec,
    stats: boosted,
    classKind: data.toClass,
    abilities: newAbilities,
    ...(data.spriteClassOverride ? { spriteClassOverride: data.spriteClassOverride } : {})
  };
};
