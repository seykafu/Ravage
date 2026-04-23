import type { TilePos, Unit, UnitDef, UnitState } from "./types";

export const createUnit = (def: UnitDef, position: TilePos): Unit => {
  const state: UnitState = {
    hp: def.stats.hp,
    apRemaining: def.stats.ap,
    stance: "none",
    hasUsedRepositionStep: false,
    hasActedThisRound: false,
    position: { ...position },
    facingX: def.faction === "enemy" ? -1 : 1,
    alive: true
  };
  return { ...def, state };
};

export const beginUnitTurn = (u: Unit): void => {
  u.state.apRemaining = u.stats.ap;
  u.state.hasUsedRepositionStep = false;
  u.state.hasActedThisRound = true;
  // Stances expire at the start of this unit's next turn.
  if (u.state.stance === "ready" || u.state.stance === "defensive") {
    u.state.stance = "none";
  }
};

export const endUnitTurn = (u: Unit): void => {
  u.state.apRemaining = 0;
};

export const isAlive = (u: Unit): boolean => u.state.alive && u.state.hp > 0;

export const damageUnit = (u: Unit, amount: number): void => {
  u.state.hp -= amount;
  if (u.state.hp <= 0) {
    u.state.hp = 0;
    u.state.alive = false;
  }
};
