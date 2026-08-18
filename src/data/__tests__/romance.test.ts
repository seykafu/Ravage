// Romance integrity. Locks the author's design: every WAR path offers
// exactly one woman and one man (plus walking on alone); exile and
// forgetting offer no one; every offered partner has a wedding coda arc
// that rolls credits under the shared ending music; and the ending
// codas actually route into the choice.

import { describe, it, expect } from "vitest";
import { PATH_ROMANCES, weddingArcFor } from "../romance";
import { ARCS } from "../../story/beats";
import type { SevenPath } from "../contentIds";

const WAR_PATHS: SevenPath[] = ["vengeance", "restoration", "revolution", "duty", "mercy"];
const WOMEN = new Set(["maya", "selene", "ning", "veya", "ndara"]);
const MEN = new Set(["leo", "corin"]);

describe("romance design", () => {
  it("every war path offers exactly one woman and one man", () => {
    for (const path of WAR_PATHS) {
      const pair = PATH_ROMANCES[path];
      expect(pair, `${path} has no romance pair`).toBeTruthy();
      expect(WOMEN.has(pair!.woman.id), `${path}: ${pair!.woman.id} is not in the women roster`).toBe(true);
      expect(MEN.has(pair!.man.id), `${path}: ${pair!.man.id} is not in the men roster`).toBe(true);
    }
  });

  it("exile and forgetting offer no one — those endings are alone by design", () => {
    expect(PATH_ROMANCES.exile).toBeUndefined();
    expect(PATH_ROMANCES.forgetting).toBeUndefined();
  });

  it("every woman in the roster is offered on exactly one path", () => {
    const offered = WAR_PATHS.map((p) => PATH_ROMANCES[p]!.woman.id);
    expect(new Set(offered).size).toBe(WAR_PATHS.length);
  });

  it("every offered partner has a wedding arc that closes through the farewell under the ending suite", () => {
    const partners = new Set(
      WAR_PATHS.flatMap((p) => [PATH_ROMANCES[p]!.woman.id, PATH_ROMANCES[p]!.man.id])
    );
    for (const id of partners) {
      const arc = ARCS[weddingArcFor(id)];
      expect(arc, `missing wedding arc for ${id}`).toBeTruthy();
      expect(arc.next).toBe("story:where_they_went");
      expect(arc.music).toBe("emotionalLife");
      expect(arc.beats.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("the walking-on-alone coda exists and closes through the farewell", () => {
    const arc = ARCS.end_alone;
    expect(arc).toBeTruthy();
    expect(arc.next).toBe("story:where_they_went");
    expect(arc.music).toBe("emotionalLife");
  });

  it("every war-path ending coda routes into the romance choice", () => {
    for (const path of WAR_PATHS) {
      const arc = ARCS[`post_ending_${path}` as keyof typeof ARCS];
      expect(arc.next, `post_ending_${path} must route to "romance"`).toBe("romance");
    }
  });
});
