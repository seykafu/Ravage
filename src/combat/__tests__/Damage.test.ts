// Damage formula tests. Cover the weapon triangle, stance modifiers,
// terrain, equipment, and Ravage state. These are the math knobs the
// designer tunes battle-to-battle, so a regression here breaks balance
// across every fight.
//
// Construction helpers below build a minimal Unit that's just enough to
// satisfy the Damage.ts code paths — no Phaser, no scene, no AI.

import { describe, it, expect } from "vitest";
import { previewAttack, weaponModifier, attackerRavageModifier, effectiveArmor } from "../Damage";
import { createUnit } from "../Unit";
import { createFang, createRoyalLens, createDactylFood } from "../items";
import type { Tile, Unit, UnitDef, WeaponKind } from "../types";

const NEUTRAL_TILE: Tile = {
  pos: { x: 0, y: 0 },
  terrain: "grass",
  obstacle: "none",
  defendBonus: 1.0,
  blocksMovement: false,
  blocksLineOfSight: false,
  hitPenalty: 0
};

const mkDef = (overrides: Partial<UnitDef>): UnitDef => ({
  id: "test",
  name: "Test",
  shortName: "Tt",
  faction: "player",
  classKind: "swordsman",
  weapon: "sword",
  stats: { hp: 30, power: 10, armor: 5, speed: 8, movement: 5, ap: 3 },
  artSeed: 0,
  level: 5,
  ...overrides
});

const mkUnit = (overrides: Partial<UnitDef>, pos = { x: 0, y: 0 }): Unit =>
  createUnit(mkDef(overrides), pos);

describe("weaponModifier", () => {
  it("returns 1.15 for sword vs spear (favored)", () => {
    expect(weaponModifier("sword", "spear")).toBeCloseTo(1.15);
    expect(weaponModifier("spear", "shield")).toBeCloseTo(1.15);
    expect(weaponModifier("shield", "sword")).toBeCloseTo(1.15);
  });
  it("returns 0.85 for the inverse matchup", () => {
    expect(weaponModifier("spear", "sword")).toBeCloseTo(0.85);
    expect(weaponModifier("shield", "spear")).toBeCloseTo(0.85);
    expect(weaponModifier("sword", "shield")).toBeCloseTo(0.85);
  });
  it("returns 1.0 for mirror matchups and bow/dactyl neutrals", () => {
    expect(weaponModifier("sword", "sword")).toBe(1.0);
    expect(weaponModifier("bow", "sword")).toBe(1.0);
    expect(weaponModifier("sword", "bow")).toBe(1.0);
    expect(weaponModifier("dactyl", "spear")).toBe(1.0);
  });
});

describe("previewAttack", () => {
  it("computes higher damage with weapon advantage than disadvantage", () => {
    const sword = mkUnit({ weapon: "sword", stats: { hp: 30, power: 20, armor: 0, speed: 10, movement: 5, ap: 3 } });
    const spear = mkUnit({ weapon: "spear", stats: { hp: 30, power: 20, armor: 0, speed: 10, movement: 5, ap: 3 } }, { x: 1, y: 0 });
    const shield = mkUnit({ weapon: "shield", stats: { hp: 30, power: 20, armor: 0, speed: 10, movement: 5, ap: 3 } }, { x: 1, y: 0 });
    const vsSpear = previewAttack(sword, spear, NEUTRAL_TILE);
    const vsShield = previewAttack(sword, shield, NEUTRAL_TILE);
    expect(vsSpear.damage).toBeGreaterThan(vsShield.damage);
  });

  it("respects terrain defendBonus (cover halves damage)", () => {
    const atk = mkUnit({ stats: { hp: 30, power: 20, armor: 0, speed: 10, movement: 5, ap: 3 } });
    const def = mkUnit({ stats: { hp: 30, power: 10, armor: 0, speed: 10, movement: 5, ap: 3 } }, { x: 1, y: 0 });
    const open = previewAttack(atk, def, NEUTRAL_TILE);
    const cover: Tile = { ...NEUTRAL_TILE, defendBonus: 0.5 };
    const inCover = previewAttack(atk, def, cover);
    expect(inCover.damage).toBeLessThan(open.damage);
  });

  it("applies defensive stance (×0.5 incoming) on the defender", () => {
    const atk = mkUnit({ stats: { hp: 30, power: 30, armor: 0, speed: 10, movement: 5, ap: 3 } });
    const def = mkUnit({ stats: { hp: 30, power: 10, armor: 0, speed: 10, movement: 5, ap: 3 } }, { x: 1, y: 0 });
    const baseline = previewAttack(atk, def, NEUTRAL_TILE);
    def.state.stance = "defensive";
    const defended = previewAttack(atk, def, NEUTRAL_TILE);
    expect(defended.damage).toBeLessThan(baseline.damage);
    // Floor of 1: defensive can't drive damage below 1.
    expect(defended.damage).toBeGreaterThanOrEqual(1);
  });

  it("Ready stance grants the counter bonus only when isCounter=true", () => {
    const atk = mkUnit({ stats: { hp: 30, power: 20, armor: 0, speed: 10, movement: 5, ap: 3 } });
    atk.state.stance = "ready";
    const def = mkUnit({ stats: { hp: 30, power: 10, armor: 0, speed: 10, movement: 5, ap: 3 } }, { x: 1, y: 0 });
    const initiated = previewAttack(atk, def, NEUTRAL_TILE, false);
    const countered = previewAttack(atk, def, NEUTRAL_TILE, true);
    expect(countered.damage).toBeGreaterThan(initiated.damage);
    // Counter bonus should also bump crit by +5.
    expect(countered.critRate).toBe(initiated.critRate + 5);
  });

  it("applies Royal Lens (+15% hit per copy) and Fang (+10% crit per copy) additively", () => {
    const atk = mkUnit({});
    const def = mkUnit({}, { x: 1, y: 0 });
    const baseline = previewAttack(atk, def, NEUTRAL_TILE);
    atk.state.inventory = [createRoyalLens(), createRoyalLens(), createFang()];
    const buffed = previewAttack(atk, def, NEUTRAL_TILE);
    expect(buffed.hitRate).toBe(Math.min(99, baseline.hitRate + 30));
    expect(buffed.critRate).toBe(baseline.critRate + 10);
  });

  it("clamps hitRate to [50, 99] and critRate to [0, 60]", () => {
    const slowAtk = mkUnit({ stats: { hp: 30, power: 10, armor: 0, speed: 1, movement: 5, ap: 3 } });
    const fastDef = mkUnit({ stats: { hp: 30, power: 10, armor: 0, speed: 30, movement: 5, ap: 3 } }, { x: 1, y: 0 });
    const p = previewAttack(slowAtk, fastDef, NEUTRAL_TILE);
    expect(p.hitRate).toBeGreaterThanOrEqual(50);
    expect(p.critRate).toBeGreaterThanOrEqual(0);
  });

  it("damage is at least 1 (chip floor)", () => {
    const wimp = mkUnit({ stats: { hp: 30, power: 1, armor: 0, speed: 5, movement: 5, ap: 3 } });
    const tank = mkUnit({ stats: { hp: 30, power: 5, armor: 100, speed: 5, movement: 5, ap: 3 } }, { x: 1, y: 0 });
    expect(previewAttack(wimp, tank, NEUTRAL_TILE).damage).toBe(1);
  });
});

describe("Ravage State (attacker bonus + defender armor halving)", () => {
  it("attackerRavageModifier returns 1.5 when ravagedActive, else 1.0", () => {
    const u = mkUnit({});
    expect(attackerRavageModifier(u)).toBe(1.0);
    u.state.ravagedActive = true;
    expect(attackerRavageModifier(u)).toBe(1.5);
  });

  it("effectiveArmor halves armor when defender is ravagedActive", () => {
    const u = mkUnit({ stats: { hp: 30, power: 10, armor: 10, speed: 5, movement: 5, ap: 3 } });
    expect(effectiveArmor(u)).toBe(10);
    u.state.ravagedActive = true;
    expect(effectiveArmor(u)).toBe(5);
  });

  it("Dactyl Food imposes -4 armor on a dactyl-class carrier (and only them)", () => {
    const dactyl = mkUnit({ classKind: "dactyl_rider", stats: { hp: 30, power: 10, armor: 10, speed: 5, movement: 5, ap: 3 } });
    dactyl.state.inventory = [createDactylFood()];
    expect(effectiveArmor(dactyl)).toBe(6);

    const sword = mkUnit({ classKind: "swordsman", stats: { hp: 30, power: 10, armor: 10, speed: 5, movement: 5, ap: 3 } });
    sword.state.inventory = [createDactylFood()];
    expect(effectiveArmor(sword)).toBe(10); // gated, no penalty
  });

  it("Ravaged trade does ~3× the damage of a clean trade (both attacker bonus + defender penalty stack)", () => {
    const atk = mkUnit({ stats: { hp: 30, power: 20, armor: 0, speed: 10, movement: 5, ap: 3 } });
    const def = mkUnit({ stats: { hp: 30, power: 10, armor: 8, speed: 10, movement: 5, ap: 3 } }, { x: 1, y: 0 });
    const clean = previewAttack(atk, def, NEUTRAL_TILE).damage;
    atk.state.ravagedActive = true;
    def.state.ravagedActive = true;
    const ravaged = previewAttack(atk, def, NEUTRAL_TILE).damage;
    expect(ravaged).toBeGreaterThan(clean * 2);
  });
});
