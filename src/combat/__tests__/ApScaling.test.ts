// AP progression rules: promotions grant +1 AP, and rank-and-file
// fielded deep into the campaign gain +1 AP through the difficulty
// layer — the two halves of "actions per turn scale with the war".

import { describe, it, expect } from "vitest";
import { applyDifficultyToEnemy } from "../Difficulty";
import { promoteCharacter } from "../Progression";
import { PROMOTIONS } from "../../data/promotions";
import { ENEMIES } from "../../data/units";

describe("promotion AP", () => {
  it("every promotion grants exactly +1 AP", () => {
    for (const [id, data] of Object.entries(PROMOTIONS)) {
      const rec = {
        level: 12,
        xp: 0,
        stats: { hp: 40, power: 15, armor: 8, speed: 10, movement: 5, ap: 3 }
      };
      const after = promoteCharacter(rec, data!);
      expect(after.stats.ap, `${id} promotion should grant +1 AP`).toBe(4);
    }
  });

  it("re-firing a promotion never double-stacks the AP", () => {
    const data = PROMOTIONS.amar!;
    const rec = {
      level: 12,
      xp: 0,
      stats: { hp: 40, power: 15, armor: 8, speed: 10, movement: 5, ap: 3 }
    };
    const once = promoteCharacter(rec, data);
    const twice = promoteCharacter(once, data);
    expect(twice.stats.ap).toBe(4);
  });
});

describe("late-campaign enemy AP", () => {
  it("rank-and-file gain +1 AP once fielded 8+ levels above reference", () => {
    // Royal Guard: reference L6, base 2 AP.
    const early = applyDifficultyToEnemy(ENEMIES.royalGuard("t1", 1, 10), "b07_monastery");
    expect(early.stats.ap, "L10 guard (4 above ref) stays at base AP").toBe(2);
    const late = applyDifficultyToEnemy(ENEMIES.royalGuard("t2", 2, 16), "b21_archbold_advances");
    expect(late.stats.ap, "L16 guard (10 above ref) gains the veteran AP").toBe(3);
  });

  it("bosses keep their authored AP (already 3 by design)", () => {
    const boss = applyDifficultyToEnemy(ENEMIES.imperialGeneral(18), "b20_dawn_war");
    expect(boss.stats.ap).toBe(3);
  });

  it("the Ravage line troops fight at 3 AP", () => {
    const trooper = applyDifficultyToEnemy(ENEMIES.ravageTrooper("t3", 3, 19), "b25_fleet_arrival");
    const lancer = applyDifficultyToEnemy(ENEMIES.ravageLancer("t4", 4, 19), "b25_fleet_arrival");
    const marksman = applyDifficultyToEnemy(ENEMIES.ravageMarksman("t5", 5, 19), "b25_fleet_arrival");
    expect(trooper.stats.ap).toBe(3);
    expect(lancer.stats.ap).toBe(3);
    expect(marksman.stats.ap, "marksmen stay at 2 — ranged tempo control").toBe(2);
  });
});
