import { describe, it, expect } from "vitest";
import { battleById } from "../battles";
import { ARCS } from "../../story/beats";
import { resolveCampBeat } from "../campTalk";

// The epilogue tells the story of whichever marriage the save holds (or of
// walking on alone): B29's dialogues and the road home are filtered by
// partner (BattleDialogue.partner / DialogBeat.partner), and the camp's last
// nights speak of the wedding.

const PARTNERS = ["selene", "corin", "ning", "leo", "maya", "veya", "ndara"];
const ALL_DONE = ["b28_path_final"];

const b29For = (married: string) =>
  (battleById("b29_epilogue")?.dialogues ?? []).filter((d) => !d.partner || d.partner === married);

const roadHomeFor = (married: string) =>
  ARCS.post_epilogue.beats.filter((b) => !b.partner || b.partner === married);

describe("the epilogue, married or not", () => {
  for (const married of [...PARTNERS, "none"]) {
    it(`B29 closes once, on its own ending (${married})`, () => {
      const closes = b29For(married).filter((d) => d.trigger.kind === "before_victory");
      expect(closes).toHaveLength(1);
      const mid = b29For(married).filter((d) => d.id.startsWith("b29_wed_"));
      expect(mid).toHaveLength(married === "none" ? 0 : 1);
    });

    it(`the road home ends on their picture, or on none (${married})`, () => {
      const homes = roadHomeFor(married).filter((b) => b.tableau?.kind === "home");
      if (married === "none") expect(homes).toHaveLength(0);
      else {
        expect(homes).toHaveLength(1);
        expect(homes[0]!.tableau!.partner).toBe(married);
        expect(roadHomeFor(married).at(-1)).toBe(homes[0]);
      }
    });
  }

  it("the camp talks about the wedding after it", () => {
    expect(resolveCampBeat("ranatoli", ALL_DONE, "maya").body).toMatch(/Maya|wind/);
    expect(resolveCampBeat("selene", ALL_DONE, "selene").speaker).toBe("Selene");
    // Walking on alone, the camp keeps its own last-night lines.
    const alone = resolveCampBeat("amar", ALL_DONE, "none").body;
    expect(alone).not.toMatch(/Selene|Corin|Ning|Leo|Maya|Veya|Ndara/);
  });

  it("only after the war: earlier eras ignore the partner", () => {
    const early = resolveCampBeat("ranatoli", ["b01_palace_coup", "b02_farmland"], "maya").body;
    expect(early).not.toContain("Captain-my-Captain and Maya");
  });
});
