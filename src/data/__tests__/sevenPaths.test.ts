// Seven Paths (B18) wiring + save round-trip guards.
//
// B18 ("Seven Names, One Choice") forks the campaign: ChoiceScene writes the
// player's pick to save.flags via setSevenPath, and routing reads it back via
// getSevenPath. These tests pin the round-trip and the validation, plus the
// invariant that every SevenPath has a corresponding B19 path-opener battle
// declared (so a committed choice always has somewhere to point).
//
// Pure data + save helpers — no Phaser. The save module reaches localStorage
// only inside writeSave/loadSave (not used here); the pure setters/getters we
// test operate on plain SaveState objects.

import { describe, it, expect } from "vitest";
import { defaultSave, getSevenPath, setSevenPath, SEVEN_PATHS_FLAG } from "../../util/save";
import type { SevenPath } from "../contentIds";

const ALL_PATHS: SevenPath[] = [
  "vengeance", "restoration", "revolution", "duty", "exile", "mercy", "forgetting"
];

describe("Seven Paths save round-trip", () => {
  it("a fresh save has no chosen path", () => {
    expect(getSevenPath(defaultSave())).toBeNull();
  });

  it("setSevenPath persists and getSevenPath reads back every path", () => {
    for (const p of ALL_PATHS) {
      const s = setSevenPath(defaultSave(), p);
      expect(s.flags[SEVEN_PATHS_FLAG]).toBe(p);
      expect(getSevenPath(s)).toBe(p);
    }
  });

  it("setSevenPath is pure — it does not mutate the input save", () => {
    const before = defaultSave();
    const after = setSevenPath(before, "revolution");
    expect(before.flags[SEVEN_PATHS_FLAG]).toBeUndefined();
    expect(after).not.toBe(before);
  });

  it("getSevenPath rejects a corrupt / hand-edited flag value", () => {
    const s = defaultSave();
    s.flags[SEVEN_PATHS_FLAG] = "not_a_real_path";
    expect(getSevenPath(s)).toBeNull();
  });

  it("re-choosing overwrites the prior pick", () => {
    let s = setSevenPath(defaultSave(), "mercy");
    s = setSevenPath(s, "exile");
    expect(getSevenPath(s)).toBe("exile");
  });
});

describe("Seven Paths ↔ B19 opener coverage", () => {
  it("every path has a declared b19 path-opener battle", async () => {
    const { BATTLES } = await import("../battles");
    const ids = new Set(BATTLES.map((b: { id: string }) => b.id));
    for (const p of ALL_PATHS) {
      expect(ids.has(`b19_path_opener_${p}`), `missing opener for path ${p}`).toBe(true);
    }
  });

  // The core promise of the divergence: NO choice may dead-end. Every opener
  // must be fully playable — map, deployable squad, enemies, and a victory
  // condition. Also guards the unit-count-vs-start-position contract for the
  // reused map layouts (deployed units must all have real spawn tiles).
  it("every path opener is fully playable (map, units, victory, spawns)", async () => {
    const { BATTLES } = await import("../battles");
    for (const p of ALL_PATHS) {
      const b = BATTLES.find((x: { id: string }) => x.id === `b19_path_opener_${p}`);
      // Throw (not just expect) so TS narrows b/b.map for the checks below.
      if (!b || !b.map) throw new Error(`${p}: opener missing or has no map`);
      expect(b.playable, `${p} not playable`).toBe(true);
      expect(b.victory, `${p} missing victory`).toBeTruthy();
      const players = b.buildPlayers ? b.buildPlayers() : [];
      const enemies = b.buildEnemies ? b.buildEnemies() : [];
      expect(players.length, `${p} has no players`).toBeGreaterThan(0);
      expect(enemies.length, `${p} has no enemies`).toBeGreaterThan(0);
      expect(
        b.map.startPositions.player.length,
        `${p}: more deployed players than spawn tiles`
      ).toBeGreaterThanOrEqual(players.length);
      expect(
        b.map.startPositions.enemy.length,
        `${p}: more enemies than spawn tiles`
      ).toBeGreaterThanOrEqual(enemies.length);
    }
  });
});
