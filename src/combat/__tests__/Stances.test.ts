// Stance counter-trigger tests. Verify the range/weapon gating that
// determines whether a defender retaliates — bows DON'T counter at melee
// distance, spears reach 1-2, swords/shields/dactyls reach 1.
//
// These rules drive whether the player can safely close on an archer in
// Ready (yes) vs walk into a swordsman in Ready (no), so they're balance-
// sensitive.

import { describe, it, expect } from "vitest";
import { canTriggerReadyCounter, canTriggerSpeedCounter, counterZoneTiles, SPEED_COUNTER_THRESHOLD } from "../Stances";
import { Grid } from "../Grid";
import { createUnit } from "../Unit";
import type { MapDef, Unit, UnitDef } from "../types";

const MINI_MAP: MapDef = {
  id: "mini",
  name: "Mini",
  width: 8,
  height: 8,
  tiles: Array.from({ length: 64 }, () => ({ terrain: "grass" as const, obstacle: "none" as const })),
  startPositions: { player: [], enemy: [] }
};
const GRID = new Grid(MINI_MAP);

const mkUnit = (overrides: Partial<UnitDef>, pos = { x: 0, y: 0 }): Unit => {
  const def: UnitDef = {
    id: overrides.id ?? "u",
    name: "U",
    shortName: "U",
    faction: "player",
    classKind: "swordsman",
    weapon: "sword",
    stats: { hp: 30, power: 10, armor: 5, speed: 8, movement: 5, ap: 3 },
    artSeed: 0,
    level: 5,
    ...overrides
  };
  return createUnit(def, pos);
};

describe("Ready counter — range gating per weapon", () => {
  it("sword in Ready counters at distance 1", () => {
    const def = mkUnit({ weapon: "sword" }, { x: 4, y: 4 });
    def.state.stance = "ready";
    const atk = mkUnit({ id: "atk" }, { x: 5, y: 4 });
    expect(canTriggerReadyCounter(def, atk, GRID)).toBe(true);
  });

  it("sword in Ready does NOT counter at distance 2", () => {
    const def = mkUnit({ weapon: "sword" }, { x: 4, y: 4 });
    def.state.stance = "ready";
    const atk = mkUnit({ id: "atk" }, { x: 6, y: 4 });
    expect(canTriggerReadyCounter(def, atk, GRID)).toBe(false);
  });

  it("spear in Ready counters at distance 1 AND 2", () => {
    const def = mkUnit({ weapon: "spear" }, { x: 4, y: 4 });
    def.state.stance = "ready";
    const adj = mkUnit({ id: "adj" }, { x: 5, y: 4 });
    const reach2 = mkUnit({ id: "r2" }, { x: 6, y: 4 });
    expect(canTriggerReadyCounter(def, adj, GRID)).toBe(true);
    expect(canTriggerReadyCounter(def, reach2, GRID)).toBe(true);
  });

  it("bow in Ready counters at 2-4 only — adjacent melee gets a free swing", () => {
    const archer = mkUnit({ weapon: "bow" }, { x: 4, y: 4 });
    archer.state.stance = "ready";
    const melee = mkUnit({ id: "m" }, { x: 5, y: 4 });
    const ranged = mkUnit({ id: "r" }, { x: 7, y: 4 });
    const tooFar = mkUnit({ id: "x" }, { x: 4, y: 0 }); // dist 4 — at the edge
    expect(canTriggerReadyCounter(archer, melee, GRID)).toBe(false);
    expect(canTriggerReadyCounter(archer, ranged, GRID)).toBe(true);
    expect(canTriggerReadyCounter(archer, tooFar, GRID)).toBe(true);
  });

  it("does NOT trigger when stance is not 'ready' (defensive or none)", () => {
    const def = mkUnit({ weapon: "sword" }, { x: 4, y: 4 });
    const atk = mkUnit({ id: "atk" }, { x: 5, y: 4 });
    def.state.stance = "none";
    expect(canTriggerReadyCounter(def, atk, GRID)).toBe(false);
    def.state.stance = "defensive";
    expect(canTriggerReadyCounter(def, atk, GRID)).toBe(false);
  });
});

describe("Speed counter — passive retaliation when fast enough", () => {
  it("triggers when defender out-speeds attacker by SPEED_COUNTER_THRESHOLD or more", () => {
    const slowAtk = mkUnit({ id: "atk", stats: { hp: 30, power: 10, armor: 5, speed: 5, movement: 5, ap: 3 } }, { x: 5, y: 4 });
    const fastDef = mkUnit({ stats: { hp: 30, power: 10, armor: 5, speed: 5 + SPEED_COUNTER_THRESHOLD, movement: 5, ap: 3 } }, { x: 4, y: 4 });
    expect(canTriggerSpeedCounter(fastDef, slowAtk)).toBe(true);
  });

  it("does NOT trigger when speed differential is below threshold", () => {
    const atk = mkUnit({ id: "atk", stats: { hp: 30, power: 10, armor: 5, speed: 8, movement: 5, ap: 3 } }, { x: 5, y: 4 });
    const def = mkUnit({ stats: { hp: 30, power: 10, armor: 5, speed: 8 + (SPEED_COUNTER_THRESHOLD - 1), movement: 5, ap: 3 } }, { x: 4, y: 4 });
    expect(canTriggerSpeedCounter(def, atk)).toBe(false);
  });

  it("respects weapon reach even with sufficient speed differential", () => {
    const slowAtk = mkUnit({ id: "atk", stats: { hp: 30, power: 10, armor: 5, speed: 5, movement: 5, ap: 3 } }, { x: 7, y: 4 });
    const fastSwordDef = mkUnit({ weapon: "sword", stats: { hp: 30, power: 10, armor: 5, speed: 5 + SPEED_COUNTER_THRESHOLD, movement: 5, ap: 3 } }, { x: 4, y: 4 });
    // Sword reach is 1, attacker is 3 away — no counter despite the speed gap.
    expect(canTriggerSpeedCounter(fastSwordDef, slowAtk)).toBe(false);
  });
});

describe("counterZoneTiles", () => {
  it("returns 4 tiles for a sword (1-tile reach, 4-neighbour)", () => {
    const def = mkUnit({ weapon: "sword" }, { x: 4, y: 4 });
    const tiles = counterZoneTiles(def);
    expect(tiles).toHaveLength(4);
    expect(tiles).toContainEqual({ x: 5, y: 4 });
    expect(tiles).toContainEqual({ x: 3, y: 4 });
    expect(tiles).toContainEqual({ x: 4, y: 5 });
    expect(tiles).toContainEqual({ x: 4, y: 3 });
  });

  it("returns the 2-4 ring for a bow (no melee tile)", () => {
    const archer = mkUnit({ weapon: "bow" }, { x: 4, y: 4 });
    const tiles = counterZoneTiles(archer);
    // Adjacent tiles must NOT be in the zone — bow doesn't counter at melee.
    expect(tiles).not.toContainEqual({ x: 5, y: 4 });
    expect(tiles).not.toContainEqual({ x: 4, y: 4 });
    // Distance-2 and distance-4 tiles SHOULD be in the zone.
    expect(tiles).toContainEqual({ x: 6, y: 4 });
    expect(tiles).toContainEqual({ x: 4, y: 0 });
  });
});
