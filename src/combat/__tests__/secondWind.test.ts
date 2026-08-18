// Boss second-phase tests (UnitDef.secondWind).
//
// The B28 finale hangs on this: every path's final opponent refuses the
// first killing blow, comes back tougher, and retaliates against anything
// that closes. Three classes of bug would each quietly ruin the fight —
//
//   1. The phase never fires, or fires twice (an unkillable boss).
//   2. The victory condition resolves on the FIRST death, ending the
//      battle before phase two is ever seen.
//   3. "Twice as tough" floors most of the squad at 1 damage, so the
//      finale is two characters plinking while six watch. That is the
//      exact reason toughness is a damage multiplier here and not a
//      doubled armor stat — armor is subtractive in this game.
//
// so all three are pinned down below.

import { describe, it, expect } from "vitest";
import { createUnit, damageUnit, isAlive } from "../Unit";
import { performAttack } from "../Actions";
import { previewAttack } from "../Damage";
import { canTriggerRelentlessCounter } from "../Stances";
import { Grid } from "../Grid";
import { defeatUnit } from "../Victory";
import { Rng } from "../../util/rng";
import { applyDifficultyToEnemy } from "../Difficulty";
import { serializeUnit, deserializeUnit } from "../Suspend";
import { projectPlayer } from "../BalanceSim";
import { BATTLES, resolveBattleForPath } from "../../data/battles";
import type { SevenPath } from "../../data/contentIds";
import type { MapDef, Tile, Unit, UnitDef } from "../types";

const MINI_MAP: MapDef = {
  id: "mini",
  name: "Mini",
  width: 8,
  height: 8,
  tiles: Array.from({ length: 64 }, () => ({ terrain: "grass" as const, obstacle: "none" as const })),
  startPositions: { player: [], enemy: [] }
};
const GRID = new Grid(MINI_MAP);
const NEUTRAL_TILE = {
  terrain: "grass", obstacle: "none", defendBonus: 1, hitPenalty: 0, blocksMovement: false
} as unknown as Tile;

const mkUnit = (overrides: Partial<UnitDef>, pos = { x: 0, y: 0 }): Unit => createUnit({
  id: "u", name: "U", shortName: "U", faction: "player", classKind: "swordsman",
  weapon: "sword", stats: { hp: 30, power: 10, armor: 5, speed: 8, movement: 5, ap: 3 },
  artSeed: 0, level: 5, ...overrides
}, pos);

const PHASE = { hpFraction: 0.5, damageTaken: 0.5, announce: "It stands." };

describe("second wind — the phase change itself", () => {
  it("refuses the first killing blow and comes back at the authored fraction", () => {
    const boss = mkUnit({ id: "boss", faction: "enemy", secondWind: PHASE });
    expect(damageUnit(boss, 999)).toBe(true);
    expect(isAlive(boss), "boss must survive the first lethal hit").toBe(true);
    expect(boss.state.hp).toBe(15);          // 50% of 30
    expect(boss.state.secondWindUsed).toBe(true);
    expect(boss.state.alwaysCounters).toBe(true);
    expect(boss.state.damageTakenMult).toBe(0.5);
  });

  it("fires exactly once — the second killing blow lands normally", () => {
    const boss = mkUnit({ id: "boss", faction: "enemy", secondWind: PHASE });
    damageUnit(boss, 999);
    expect(damageUnit(boss, 999), "no second phase two").toBe(false);
    expect(isAlive(boss), "boss must actually die the second time").toBe(false);
    expect(boss.state.hp).toBe(0);
  });

  it("leaves ordinary units completely alone", () => {
    const mook = mkUnit({ id: "mook", faction: "enemy" });
    expect(damageUnit(mook, 999)).toBe(false);
    expect(isAlive(mook)).toBe(false);
    expect(mook.state.damageTakenMult).toBe(1);
  });

  it("starts the Ravage counter clean so the blow that 'killed' them doesn't carry over", () => {
    const boss = mkUnit({ id: "boss", faction: "enemy", secondWind: PHASE });
    damageUnit(boss, 999);
    expect(boss.state.damageTakenSinceLastTurn).toBe(0);
    expect(boss.state.ravagedNextTurn).toBe(false);
  });

  it("does NOT hand the battle to the player on the first death", () => {
    // The bug this guards: defeatUnit evaluating on the killing blow that
    // the second wind refused would end B28 before phase two exists.
    const boss = mkUnit({ id: "boss", faction: "enemy", secondWind: PHASE }, { x: 1, y: 1 });
    const hero = mkUnit({ id: "hero" }, { x: 0, y: 0 });
    const state = { units: [hero, boss], grid: GRID, rng: new Rng(1) };
    const cond = defeatUnit("boss");
    damageUnit(boss, 999);
    expect(cond.evaluate({ state, round: 1 }), "phase two must not read as victory").toBeNull();
    damageUnit(boss, 999);
    expect(cond.evaluate({ state, round: 1 }), "the real death must win").toBe("player");
  });
});

describe("second wind — surviving a save and quit", () => {
  it("a phased boss stays phased through a suspend round-trip", () => {
    // Without this the player could bank a free third phase by saving
    // mid-fight: the flags ride UnitState, so they must survive the
    // JSON round-trip that writeSave puts them through.
    const boss = mkUnit({ id: "boss", faction: "enemy", secondWind: PHASE });
    damageUnit(boss, 999);
    const revived = deserializeUnit(JSON.parse(JSON.stringify(serializeUnit(boss))));
    expect(revived.state.secondWindUsed, "phase two must not reset on resume").toBe(true);
    expect(revived.state.alwaysCounters).toBe(true);
    expect(revived.state.damageTakenMult).toBe(0.5);
    expect(damageUnit(revived, 999), "no bonus phase after resuming").toBe(false);
    expect(isAlive(revived)).toBe(false);
  });
});

describe("second wind — halved damage", () => {
  it("halves what lands, and halves it for EVERY attacker equally", () => {
    // The squad's damage spread must be preserved. Doubling a subtractive
    // armor stat instead would floor the weaker attackers at 1 while the
    // heaviest hitter barely noticed — six of eight characters benched.
    const boss = mkUnit({ id: "boss", faction: "enemy", secondWind: PHASE }, { x: 1, y: 0 });
    const attackers = [8, 14, 20, 32].map((power, i) =>
      mkUnit({ id: `a${i}`, stats: { hp: 30, power, armor: 5, speed: 8, movement: 5, ap: 3 } })
    );
    const before = attackers.map((a) => previewAttack(a, boss, NEUTRAL_TILE, false, []).damage);
    damageUnit(boss, 999);
    const after = attackers.map((a) => previewAttack(a, boss, NEUTRAL_TILE, false, []).damage);
    for (let i = 0; i < attackers.length; i++) {
      expect(after[i]!, `attacker ${i} should take ~half`).toBe(Math.max(1, Math.round(before[i]! * 0.5)));
      expect(after[i]!, `attacker ${i} must not be floored to chip damage`).toBeGreaterThan(1);
    }
  });
});

describe("second wind — unconditional counters", () => {
  it("retaliates with no Ready stance and no speed advantage", () => {
    const boss = mkUnit({
      id: "boss", faction: "enemy", secondWind: PHASE,
      stats: { hp: 60, power: 12, armor: 2, speed: 1, movement: 5, ap: 3 }  // slower: no speed counter
    }, { x: 1, y: 0 });
    const hero = mkUnit({ id: "hero", stats: { hp: 60, power: 6, armor: 0, speed: 20, movement: 5, ap: 3 } });
    const state = { units: [hero, boss], grid: GRID, rng: new Rng(7) };
    expect(canTriggerRelentlessCounter(boss, hero), "not armed before the phase").toBe(false);
    damageUnit(boss, 999);
    expect(canTriggerRelentlessCounter(boss, hero)).toBe(true);
    const res = performAttack(state, hero, boss);
    expect(res.counterTriggered, "phase two must hit back").toBe(true);
  });

  it("still obeys weapon reach — a bow at melee cannot retaliate", () => {
    const boss = mkUnit({ id: "boss", faction: "enemy", weapon: "bow", secondWind: PHASE }, { x: 1, y: 0 });
    const hero = mkUnit({ id: "hero" }, { x: 0, y: 0 });
    damageUnit(boss, 999);
    expect(canTriggerRelentlessCounter(boss, hero), "bows do not counter in the face").toBe(false);
  });
});

describe("B28 finale — every path's boss has a survivable phase two", () => {
  const PATHS: Array<SevenPath | null> = [null, "vengeance", "restoration", "revolution", "duty", "mercy"];
  const base = BATTLES.find((b) => b.id === "b28_path_final")!;

  it("every path's final opponent carries a second wind and a reserve keyed to it", () => {
    for (const path of PATHS) {
      const node = path ? resolveBattleForPath(base, path) : base;
      const label = path ?? "base";
      const boss = node.buildEnemies!().find((d) => d.classKind === "boss")!;
      expect(boss.secondWind, `${label}: final boss has no phase two`).toBeDefined();
      expect(boss.secondWind!.announce.length, `${label}: phase two says nothing`).toBeGreaterThan(20);
      const wave = (node.reinforcements ?? []).find((w) => w.onSecondWindOf === boss.id);
      expect(wave, `${label}: no reserve keyed to ${boss.id}`).toBeDefined();
      expect(wave!.units().length, `${label}: empty reserve`).toBeGreaterThan(0);
    }
  });

  it("the whole squad can still hurt phase two — nobody gets benched at chip damage", () => {
    for (const path of PATHS) {
      const node = path ? resolveBattleForPath(base, path) : base;
      const label = path ?? "base";
      const defs = node.buildEnemies!().map((d) => applyDifficultyToEnemy(d, node.id));
      const bossDef = defs.find((d) => d.classKind === "boss")!;
      const lvl = Math.round(defs.reduce((a, d) => a + d.level, 0) / defs.length);
      const boss = createUnit(bossDef, { x: 0, y: 0 });
      damageUnit(boss, 999_999);
      expect(boss.state.secondWindUsed, `${label}: phase two never armed`).toBe(true);
      for (const pdef of node.buildPlayers!()) {
        // Same projection the campaign difficulty curve uses: authored
        // base + expected growth gains + the promotion boost.
        const p = projectPlayer(pdef, Math.max(pdef.level, lvl));
        const dmg = previewAttack(p, boss, NEUTRAL_TILE, false, []).damage;
        expect(dmg, `${label}: ${pdef.name} does chip damage to phase two`).toBeGreaterThan(1);
      }
    }
  });

  it("phase two costs a real but finite number of swings", () => {
    for (const path of PATHS) {
      const node = path ? resolveBattleForPath(base, path) : base;
      const label = path ?? "base";
      const defs = node.buildEnemies!().map((d) => applyDifficultyToEnemy(d, node.id));
      const bossDef = defs.find((d) => d.classKind === "boss")!;
      const lvl = Math.round(defs.reduce((a, d) => a + d.level, 0) / defs.length);
      const players = node.buildPlayers!().map((d) => projectPlayer(d, Math.max(d.level, lvl)));
      const boss = createUnit(bossDef, { x: 0, y: 0 });
      damageUnit(boss, 999_999);
      const swings = players
        .map((p) => {
          const pr = previewAttack(p, boss, NEUTRAL_TILE, false, []);
          return (pr.hitRate / 100) * pr.damage * (1 + pr.critRate / 100);
        })
        .sort((a, b) => b - a)
        .slice(0, 4);
      const htk = boss.state.hp / (swings.reduce((a, b) => a + b, 0) / swings.length);
      expect(htk, `${label}: phase two dies too fast to register`).toBeGreaterThan(2);
      expect(htk, `${label}: phase two is a slog`).toBeLessThan(14);
    }
  });
});
