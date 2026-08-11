// Active-roster integrity. The squad tables live in ONE shared module
// (src/data/activeRoster.ts) precisely because they used to be forked:
// CampScene carried a private copy that stopped updating at B11, and
// everyone recruited after the crossing never appeared at the fire.
// Separately, the roster UI's display table (ROSTER_ORDER) silently
// dropped anyone it lacked a mapping for — Veya and Corin fought in
// every battle from their join onward while being invisible in the
// roster overlay. These tests make both failure modes loud.

import { describe, it, expect } from "vitest";
import { ACTIVE_ROSTER, ROSTER_ORDER, getActiveSquadIds } from "../activeRoster";
import { CAMP_TALK } from "../campTalk";
import { BATTLES } from "../battles";

describe("active roster integrity", () => {
  it("every id fielded in any ACTIVE_ROSTER entry has a ROSTER_ORDER mapping", () => {
    const displayIds = new Set(ROSTER_ORDER.map((r) => r.recordId));
    for (const [battleId, squad] of Object.entries(ACTIVE_ROSTER)) {
      for (const id of squad ?? []) {
        expect(
          displayIds.has(id),
          `${battleId} fields "${id}" but ROSTER_ORDER has no entry — ` +
          `they'd be invisible in the roster UI`
        ).toBe(true);
      }
    }
  });

  it("every ROSTER_ORDER factory produces a def whose id matches its recordId", () => {
    for (const { recordId, factory } of ROSTER_ORDER) {
      expect(factory().id).toBe(recordId);
    }
  });

  it("every ACTIVE_ROSTER key is a real battle id", () => {
    const battleIds = new Set<string>(BATTLES.map((b) => b.id));
    for (const key of Object.keys(ACTIVE_ROSTER)) {
      expect(battleIds.has(key), `ACTIVE_ROSTER references unknown battle "${key}"`).toBe(true);
    }
  });

  it("resolves the squad from the HIGHEST-index completed battle", () => {
    // Completed through B17 (out of order, as saves accumulate) — the
    // squad must be B17's six, Corin included.
    const completed = [
      "b03_dawn_bandits", "b17_lie", "b14_origin", "b01_palace_coup"
    ];
    const squad = getActiveSquadIds(completed);
    expect(squad).toContain("veya");
    expect(squad).toContain("corin");
    expect(squad).toHaveLength(6);
  });

  it("the fleet-arc squad of eight resolves after B23", () => {
    const squad = getActiveSquadIds(["b23_path_climax_a"]);
    expect(squad).toEqual(
      ["amar", "ning", "maya", "leo", "veya", "corin", "selene", "ranatoli"]
    );
  });

  it("every late joiner has authored camp-fire lines (no narrator fallback)", () => {
    for (const id of ["veya", "corin"]) {
      const talk = CAMP_TALK[id];
      expect(talk, `${id} missing from CAMP_TALK`).toBeTruthy();
      expect(Object.keys(talk!.eras).length).toBeGreaterThan(0);
    }
  });
});
