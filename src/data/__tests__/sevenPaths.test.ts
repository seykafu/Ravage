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
});
