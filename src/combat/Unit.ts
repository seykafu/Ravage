import type { Ability, Item, TilePos, Unit, UnitDef, UnitState } from "./types";
import { MAX_INVENTORY, POTION_HEAL, RAVAGE_THRESHOLD_PCT } from "./types";

const startingInventory = (def: UnitDef): Item[] => {
  // Players begin every battle with three potions; enemies start empty.
  if (def.faction !== "player") return [];
  return [
    { id: `${def.id}_potion_1`, kind: "potion", name: "Potion", uses: 1 },
    { id: `${def.id}_potion_2`, kind: "potion", name: "Potion", uses: 1 },
    { id: `${def.id}_potion_3`, kind: "potion", name: "Potion", uses: 1 }
  ];
};

export const createUnit = (def: UnitDef, position: TilePos): Unit => {
  const state: UnitState = {
    hp: def.stats.hp,
    apRemaining: def.stats.ap,
    stance: "none",
    xp: 0,
    hasUsedRepositionStep: false,
    hasActedThisRound: false,
    hasStartedTurnThisRound: false,
    position: { ...position },
    facingX: def.faction === "enemy" ? -1 : 1,
    alive: true,
    inventory: startingInventory(def),
    roamUsedThisTurn: false,
    damageTakenSinceLastTurn: 0,
    ravagedNextTurn: false,
    ravagedActive: false
  };
  return { ...def, state };
};

export const beginUnitTurn = (u: Unit): void => {
  // Idempotent within a round: re-entering this unit (e.g., the player
  // clicks away and back during the player phase) must not refill AP.
  if (u.state.hasStartedTurnThisRound) return;
  u.state.hasStartedTurnThisRound = true;
  u.state.apRemaining = u.stats.ap;
  u.state.hasUsedRepositionStep = false;
  u.state.roamUsedThisTurn = false;
  // Stances expire at the start of this unit's next turn.
  if (u.state.stance === "ready" || u.state.stance === "defensive") {
    u.state.stance = "none";
  }
  // Ravage: promote the "next turn" flag into the active flag for this turn.
  // Reset the damage counter so the next round of incoming damage measures
  // from a clean baseline.
  u.state.ravagedActive = u.state.ravagedNextTurn;
  u.state.ravagedNextTurn = false;
  u.state.damageTakenSinceLastTurn = 0;
};

export const endUnitTurn = (u: Unit): void => {
  u.state.apRemaining = 0;
  u.state.hasActedThisRound = true;
  // Ravage state is a one-turn buff — the bonus and penalty both end
  // here. New damage taken between now and this unit's next turn will
  // accumulate fresh and may re-trigger ravagedNextTurn.
  u.state.ravagedActive = false;
};

export const isAlive = (u: Unit): boolean => u.state.alive && u.state.hp > 0;

export const damageUnit = (u: Unit, amount: number): void => {
  u.state.hp -= amount;
  if (u.state.hp <= 0) {
    u.state.hp = 0;
    u.state.alive = false;
  }
  // Track damage taken since this unit's last turn started. If the running
  // total crosses the Ravage threshold AND the unit is still alive, queue
  // them to enter Ravage state on their next turn. Dead units obviously
  // don't ravage. The flag is sticky — once set, it stays set even if
  // more damage piles on; beginUnitTurn promotes it on the next turn.
  u.state.damageTakenSinceLastTurn += amount;
  if (u.state.alive && u.state.damageTakenSinceLastTurn >= u.stats.hp * RAVAGE_THRESHOLD_PCT) {
    u.state.ravagedNextTurn = true;
  }
};

export const healUnit = (u: Unit, amount: number): number => {
  const before = u.state.hp;
  u.state.hp = Math.min(u.stats.hp, u.state.hp + amount);
  return u.state.hp - before;
};

export const hasAbility = (u: Unit, a: Ability): boolean =>
  !!u.abilities && u.abilities.includes(a);

// Returns the amount actually healed (0 if the unit was at full HP).
export const useItem = (u: Unit, itemId: string): { ok: boolean; healed: number; itemName: string } => {
  const idx = u.state.inventory.findIndex((it) => it.id === itemId);
  if (idx < 0) return { ok: false, healed: 0, itemName: "" };
  const item = u.state.inventory[idx]!;
  let healed = 0;
  if (item.kind === "potion") {
    healed = healUnit(u, POTION_HEAL);
  }
  // Consume the item (single use).
  u.state.inventory.splice(idx, 1);
  return { ok: true, healed, itemName: item.name };
};

export const canCarryMore = (u: Unit): boolean => u.state.inventory.length < MAX_INVENTORY;
