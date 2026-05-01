import { Grid } from "./Grid";
import { previewAttack } from "./Damage";
import { canTriggerReadyCounter, canTriggerSpeedCounter } from "./Stances";
import { beginUnitTurn, damageUnit, hasAbility, isAlive } from "./Unit";
import type { AttackResult, Stance, Tile, TilePos, Unit } from "./types";
import { RAVAGE_MOVE_BONUS } from "./types";
import type { Rng } from "../util/rng";

export interface BattleState {
  units: Unit[];
  grid: Grid;
  rng: Rng;
}

// Mounted classes (knights, dactyl riders) move further than infantry.
// Returned as a +N bonus added to the unit's base movement stat.
export const mountBonus = (u: Unit): number => {
  if (u.classKind === "knight" || u.classKind === "dactyl_rider") return 2;
  return 0;
};

// Ravage State adds +1 MOV during the unit's Ravaged turn — wounded
// units press forward instead of falling back. Stacks with mountBonus.
const ravageMoveBonus = (u: Unit): number =>
  u.state.ravagedActive ? RAVAGE_MOVE_BONUS : 0;

export const effectiveMovement = (u: Unit): number =>
  u.stats.movement + mountBonus(u) + ravageMoveBonus(u);

export const unitAt = (state: BattleState, p: TilePos): Unit | null => {
  for (const u of state.units) {
    if (!isAlive(u)) continue;
    if (u.state.position.x === p.x && u.state.position.y === p.y) return u;
  }
  return null;
};

export const reachableForUnit = (state: BattleState, u: Unit, range = effectiveMovement(u)): TilePos[] => {
  return state.grid.reachableTiles(u.state.position, range, (p) => {
    const occ = unitAt(state, p);
    return occ !== null && occ !== u && occ.faction !== u.faction;
  });
};

export const targetsForUnit = (state: BattleState, u: Unit): Unit[] => {
  const out: Unit[] = [];
  const minR = u.weapon === "bow" ? 2 : 1;
  const maxR = u.weapon === "bow" ? 4 : u.weapon === "spear" ? 2 : 1;
  for (const tile of state.grid.attackTargetTiles(u.state.position, minR, maxR)) {
    const t = unitAt(state, tile);
    if (t && t.faction !== u.faction && isAlive(t)) out.push(t);
  }
  return out;
};

export const moveUnit = (state: BattleState, u: Unit, dest: TilePos): boolean => {
  const path = state.grid.pathTo(u.state.position, dest, (p) => {
    const occ = unitAt(state, p);
    return occ !== null && occ !== u && occ.faction !== u.faction;
  });
  if (!path) return false;
  if (path.length > effectiveMovement(u)) return false;
  // Set facing based on net direction
  if (dest.x > u.state.position.x) u.state.facingX = 1;
  else if (dest.x < u.state.position.x) u.state.facingX = -1;
  u.state.position = { ...dest };
  return true;
};

// Roll an attack to its outcome (hit/miss/crit/dmg) WITHOUT applying
// damage. Used by both the sync performAttack and the async player-path
// in BattleScene that needs to ask the player about Interpose before
// committing damage. Damage is computed against the named defender's
// stats — if Interpose redirects the blow, the caller is responsible
// for re-rolling against the interposer's tile/armor.
export interface AttackRoll {
  hit: boolean;
  crit: boolean;
  damage: number;
}

export const rollAttackOnly = (
  state: BattleState,
  attacker: Unit,
  defender: Unit,
  isCounter = false
): AttackRoll => {
  const tile = state.grid.tileAt(defender.state.position);
  const preview = previewAttack(attacker, defender, tile, isCounter, state.units);
  const hit = state.rng.rollPercent(preview.hitRate);
  let dmg = 0;
  let crit = false;
  if (hit) {
    crit = state.rng.rollPercent(preview.critRate);
    dmg = crit ? preview.damage * 2 : preview.damage;
  }
  return { hit, crit, damage: dmg };
};

// Apply a pre-rolled outcome to a (possibly redirected) defender. Returns
// the AttackResult that the UI consumes. Counter logic is NOT in here —
// it's still in performAttack so the AI path keeps the full single-call
// behaviour, and BattleScene runs its own counter step after handling
// Interpose so the counter targets / sources the right unit.
export const applyAttackOutcome = (
  attacker: Unit,
  defender: Unit,
  roll: AttackRoll
): AttackResult => {
  if (roll.hit) damageUnit(defender, roll.damage);
  return {
    hit: roll.hit,
    crit: roll.crit,
    damage: roll.damage,
    attackerId: attacker.id,
    defenderId: defender.id,
    defenderRemainingHp: defender.state.hp,
    defenderKilled: !isAlive(defender),
    counterTriggered: false
  };
};

const rollAttack = (
  state: BattleState,
  attacker: Unit,
  defender: Unit,
  isCounter = false
): AttackResult => {
  const roll = rollAttackOnly(state, attacker, defender, isCounter);
  return applyAttackOutcome(attacker, defender, roll);
};

export const performAttack = (state: BattleState, attacker: Unit, defender: Unit): AttackResult => {
  const result = rollAttack(state, attacker, defender, false);

  // Destruct: if the defender was killed and has the ability, the attacker also dies.
  if (result.defenderKilled && hasAbility(defender, "Destruct") && isAlive(attacker)) {
    // Lethal blow — armor-bypassing self-immolation.
    damageUnit(attacker, attacker.state.hp);
    result.destructTriggered = true;
    result.attackerKilled = !isAlive(attacker);
  }

  // Counter resolution. A defender retaliates iff EITHER they're in Ready
  // stance OR they out-speed the attacker by SPEED_COUNTER_THRESHOLD points.
  // Ready takes priority because it carries the +25% damage / +5% crit kicker
  // (attackerStanceModifier in Damage.ts) and consumes the stance slot; a
  // Speed counter is passive and does base damage. Only a still-living
  // defender / still-living attacker can produce a counter.
  if (result.hit && !result.defenderKilled && isAlive(defender) && isAlive(attacker)) {
    if (canTriggerReadyCounter(defender, attacker, state.grid)) {
      const counter = rollAttack(state, defender, attacker, true);
      defender.state.stance = "none"; // Ready spent
      result.counterTriggered = true;
      result.counterResult = counter;
    } else if (canTriggerSpeedCounter(defender, attacker)) {
      const counter = rollAttack(state, defender, attacker, true);
      result.counterTriggered = true;
      result.counterResult = counter;
    }
  } else if (result.defenderKilled && canTriggerReadyCounter(defender, attacker, state.grid)) {
    // Defender died but had Ready ready to fire; clear the stance so the
    // corpse doesn't appear "still primed" in any post-mortem UI snapshot.
    defender.state.stance = "none";
  }
  return result;
};

// Returns the player-faction units adjacent to `defender` (Manhattan dist
// 1) that could potentially interpose for a killing blow. Excludes the
// defender themselves and the attacker (in case the attacker happens to
// be adjacent, which they will be for melee). Excludes dead units. Used
// by BattleScene's interpose flow.
export const interposeCandidates = (
  state: BattleState,
  defender: Unit,
  attacker: Unit
): Unit[] => {
  if (defender.faction !== "player") return [];
  const out: Unit[] = [];
  for (const u of state.units) {
    if (u === defender || u === attacker) continue;
    if (u.faction !== "player") continue;
    if (!isAlive(u)) continue;
    const dx = Math.abs(u.state.position.x - defender.state.position.x);
    const dy = Math.abs(u.state.position.y - defender.state.position.y);
    if (dx + dy === 1) out.push(u);
  }
  return out;
};

export const enterStance = (u: Unit, stance: Exclude<Stance, "none">): void => {
  u.state.stance = stance;
};

export const beginTurn = (u: Unit): void => beginUnitTurn(u);

// Note: the legacy `checkVictory` (rout-only, fixed) was deleted in favor of
// the VictoryCondition primitive. See src/combat/Victory.ts; BattleScene now
// reads the per-battle condition from BattleNode.victory and evaluates it
// against (state, round). The default rout behavior lives there as
// `routEnemies`.

export const tileFor = (state: BattleState, u: Unit): Tile =>
  state.grid.tileAt(u.state.position);
