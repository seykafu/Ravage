import type { Ability, Item, TilePos, Unit, UnitDef, UnitState } from "./types";
import { MAX_INVENTORY, POTION_HEAL } from "./types";

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
    hasUsedRepositionStep: false,
    hasActedThisRound: false,
    position: { ...position },
    facingX: def.faction === "enemy" ? -1 : 1,
    alive: true,
    inventory: startingInventory(def),
    roamUsedThisTurn: false
  };
  return { ...def, state };
};

export const beginUnitTurn = (u: Unit): void => {
  u.state.apRemaining = u.stats.ap;
  u.state.hasUsedRepositionStep = false;
  u.state.hasActedThisRound = true;
  u.state.roamUsedThisTurn = false;
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
