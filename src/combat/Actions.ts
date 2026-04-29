import { Grid } from "./Grid";
import { previewAttack } from "./Damage";
import { canTriggerReadyCounter, canTriggerSpeedCounter } from "./Stances";
import { beginUnitTurn, damageUnit, hasAbility, isAlive } from "./Unit";
import type { AttackResult, Stance, Tile, TilePos, Unit } from "./types";
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

export const effectiveMovement = (u: Unit): number => u.stats.movement + mountBonus(u);

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

const rollAttack = (
  state: BattleState,
  attacker: Unit,
  defender: Unit,
  isCounter = false
): AttackResult => {
  const tile = state.grid.tileAt(defender.state.position);
  const preview = previewAttack(attacker, defender, tile, isCounter, state.units);
  const hit = state.rng.rollPercent(preview.hitRate);
  let dmg = 0;
  let crit = false;
  if (hit) {
    crit = state.rng.rollPercent(preview.critRate);
    dmg = crit ? preview.damage * 2 : preview.damage;
    damageUnit(defender, dmg);
  }
  return {
    hit,
    crit,
    damage: dmg,
    attackerId: attacker.id,
    defenderId: defender.id,
    defenderRemainingHp: defender.state.hp,
    defenderKilled: !isAlive(defender),
    counterTriggered: false
  };
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

export const enterStance = (u: Unit, stance: Exclude<Stance, "none">): void => {
  u.state.stance = stance;
};

export const beginTurn = (u: Unit): void => beginUnitTurn(u);

export const checkVictory = (state: BattleState): "player" | "enemy" | null => {
  const playersAlive = state.units.some((u) => u.faction === "player" && isAlive(u));
  const enemiesAlive = state.units.some((u) => u.faction === "enemy" && isAlive(u));
  if (!playersAlive) return "enemy";
  if (!enemiesAlive) return "player";
  return null;
};

export const tileFor = (state: BattleState, u: Unit): Tile =>
  state.grid.tileAt(u.state.position);
