import { Grid } from "./Grid";
import { previewAttack } from "./Damage";
import { canTriggerReadyCounter } from "./Stances";
import { beginUnitTurn, damageUnit, isAlive } from "./Unit";
import type { AttackResult, Stance, Tile, TilePos, Unit } from "./types";
import type { Rng } from "../util/rng";

export interface BattleState {
  units: Unit[];
  grid: Grid;
  rng: Rng;
}

export const unitAt = (state: BattleState, p: TilePos): Unit | null => {
  for (const u of state.units) {
    if (!isAlive(u)) continue;
    if (u.state.position.x === p.x && u.state.position.y === p.y) return u;
  }
  return null;
};

export const reachableForUnit = (state: BattleState, u: Unit, range = u.stats.movement): TilePos[] => {
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
  if (path.length > u.stats.movement) return false;
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
  const preview = previewAttack(attacker, defender, tile, isCounter);
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
  if (
    result.hit &&
    !result.defenderKilled &&
    canTriggerReadyCounter(defender, attacker, state.grid)
  ) {
    const counter = rollAttack(state, defender, attacker, true);
    defender.state.stance = "none"; // Ready spent
    result.counterTriggered = true;
    result.counterResult = counter;
  } else if (
    result.defenderKilled &&
    canTriggerReadyCounter(defender, attacker, state.grid)
  ) {
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
