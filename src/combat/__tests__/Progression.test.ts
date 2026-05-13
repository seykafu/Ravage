// XP curve + level-up roll + catch-up rule tests. The catch-up logic
// runs once per veteran rejoin (Selene at B7, Ranatoli at TBD), so a
// regression here breaks character balance for the entire second half.

import { describe, it, expect } from "vitest";
import { applyOneLevel, awardXp, catchUpToSquad, squadAverageLevel, xpRewardFor } from "../Progression";
import { createUnit } from "../Unit";
import { LEVEL_CAP, XP_PER_LEVEL, type GrowthTable, type Unit, type UnitDef } from "../types";

const HIGH_GROWTH: GrowthTable = { hp: 100, power: 100, armor: 100, speed: 100, movement: 100 };
const NEVER_GROW: GrowthTable = { hp: 0, power: 0, armor: 0, speed: 0, movement: 0 };

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

describe("applyOneLevel", () => {
  it("100% growths roll +1 on every stat (deterministic with roll=()=>0)", () => {
    const u = mkUnit({ stats: { hp: 30, power: 10, armor: 5, speed: 8, movement: 5, ap: 3 } });
    const before = { ...u.stats };
    const gained = applyOneLevel(u, HIGH_GROWTH, () => 0);
    expect(u.stats.hp).toBe(before.hp + 1);
    expect(u.stats.power).toBe(before.power + 1);
    expect(u.stats.armor).toBe(before.armor + 1);
    expect(u.stats.speed).toBe(before.speed + 1);
    expect(u.stats.movement).toBe(before.movement + 1);
    expect(gained).toEqual({ hp: 1, power: 1, armor: 1, speed: 1, movement: 1 });
  });

  it("0% growths never gain anything", () => {
    const u = mkUnit({});
    const before = { ...u.stats };
    const gained = applyOneLevel(u, NEVER_GROW, () => 0);
    expect(u.stats).toEqual(before);
    expect(gained).toEqual({});
  });

  it("HP gain heals up the unit by 1 (FE convention)", () => {
    const u = mkUnit({ stats: { hp: 30, power: 10, armor: 5, speed: 8, movement: 5, ap: 3 } });
    u.state.hp = 10; // wounded
    applyOneLevel(u, HIGH_GROWTH, () => 0);
    expect(u.state.hp).toBe(11);
  });
});

describe("awardXp", () => {
  it("fills below the threshold without leveling up", () => {
    const u = mkUnit({ level: 5 });
    u.state.xp = 0;
    const r = awardXp(u, 50, () => 0);
    expect(u.level).toBe(5);
    expect(u.state.xp).toBe(50);
    expect(r.levelUps).toHaveLength(0);
    expect(r.totalAwarded).toBe(50);
  });

  it("levels up exactly when xp crosses XP_PER_LEVEL", () => {
    const u = mkUnit({ level: 5, growths: HIGH_GROWTH });
    u.state.xp = 0;
    const r = awardXp(u, XP_PER_LEVEL, () => 0);
    expect(u.level).toBe(6);
    expect(u.state.xp).toBe(0);
    expect(r.levelUps).toHaveLength(1);
  });

  it("chains multiple level-ups in a single award", () => {
    const u = mkUnit({ level: 5, growths: HIGH_GROWTH });
    u.state.xp = 0;
    const r = awardXp(u, XP_PER_LEVEL * 3 + 25, () => 0);
    expect(u.level).toBe(8);
    expect(u.state.xp).toBe(25);
    expect(r.levelUps).toHaveLength(3);
  });

  it("caps at LEVEL_CAP and discards leftover XP", () => {
    const u = mkUnit({ level: LEVEL_CAP - 1, growths: HIGH_GROWTH });
    u.state.xp = 0;
    const r = awardXp(u, 10_000, () => 0);
    expect(u.level).toBe(LEVEL_CAP);
    expect(u.state.xp).toBe(0);
    expect(r.levelUps).toHaveLength(1);
  });

  it("returns nothing for already-capped units", () => {
    const u = mkUnit({ level: LEVEL_CAP });
    u.state.xp = 0;
    const r = awardXp(u, 500);
    expect(r.totalAwarded).toBe(0);
    expect(r.levelUps).toHaveLength(0);
    expect(u.level).toBe(LEVEL_CAP);
  });
});

describe("xpRewardFor", () => {
  it("returns base XP at equal levels", () => {
    const atk = mkUnit({ level: 5 });
    const def = mkUnit({ id: "d", level: 5 });
    // Mook default — base 30, multiplier 1.0.
    expect(xpRewardFor(atk, def)).toBe(30);
  });

  it("scales 10% per level diff and clamps to [0.30, 2.00]", () => {
    const atk = mkUnit({ level: 5 });
    const upMookDef = mkUnit({ id: "d", level: 10 });
    // diff = +5 → mult 1.5 → 30 * 1.5 = 45.
    expect(xpRewardFor(atk, upMookDef)).toBe(45);

    const downMookDef = mkUnit({ id: "d", level: 1 });
    // diff = -4 → mult 0.6 → 30 * 0.6 = 18.
    expect(xpRewardFor(atk, downMookDef)).toBe(18);

    const wayBelowDef = mkUnit({ id: "d", level: 1 });
    const overleveledAtk = mkUnit({ level: 20 });
    // diff = -19 → uncapped mult would be ~ -0.9; clamp to 0.30 → 30 * 0.30 = 9.
    expect(xpRewardFor(overleveledAtk, wayBelowDef)).toBe(9);
  });

  it("rewards more for elite (50 base) and boss (100 base)", () => {
    const atk = mkUnit({ level: 5 });
    const elite = mkUnit({ id: "e", level: 5, tags: new Set(["elite"]) });
    const boss = mkUnit({ id: "b", level: 5, classKind: "boss" });
    expect(xpRewardFor(atk, elite)).toBe(50);
    expect(xpRewardFor(atk, boss)).toBe(100);
  });
});

describe("catchUpToSquad", () => {
  it("levels a veteran up to (squad_avg - 2)", () => {
    const veteran = mkUnit({ level: 10, growths: HIGH_GROWTH });
    const gained = catchUpToSquad(veteran, 15, () => 0); // squad avg 15 → target 13
    expect(veteran.level).toBe(13);
    expect(gained).toBe(3);
  });

  it("is a no-op when already at or above (squad_avg - 2)", () => {
    const u = mkUnit({ level: 14 });
    const gained = catchUpToSquad(u, 15);
    expect(u.level).toBe(14);
    expect(gained).toBe(0);
  });

  it("respects the level cap", () => {
    const u = mkUnit({ level: LEVEL_CAP - 1, growths: HIGH_GROWTH });
    const gained = catchUpToSquad(u, 30, () => 0);
    expect(u.level).toBe(LEVEL_CAP);
    expect(gained).toBe(1);
  });
});

describe("squadAverageLevel", () => {
  it("averages player units only (ignores enemies and the excluded id)", () => {
    const a = mkUnit({ id: "a", level: 10 });
    const b = mkUnit({ id: "b", level: 14 });
    const enemy = mkUnit({ id: "e", level: 100, faction: "enemy" });
    expect(squadAverageLevel([a, b, enemy])).toBe(12);
  });

  it("excludes the named id (used so a rejoiner doesn't pull average down)", () => {
    const a = mkUnit({ id: "a", level: 10 });
    const b = mkUnit({ id: "b", level: 14 });
    const rejoiner = mkUnit({ id: "rejoin", level: 1 });
    expect(squadAverageLevel([a, b, rejoiner], "rejoin")).toBe(12);
  });

  it("returns 1 for an empty squad (defensive)", () => {
    expect(squadAverageLevel([])).toBe(1);
  });
});
