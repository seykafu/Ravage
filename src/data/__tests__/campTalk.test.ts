// Camp idle-dialogue integrity.
//
// Clicking a character at camp is a promise: they say something that
// fits where the story currently is. Two ways that promise breaks
// silently, both of which happened:
//
//  1. A character joins (or rejoins) the squad and nobody adds camp
//     lines — the click returns the "(looks up from the fire)"
//     fallback forever. Ranatoli and Selene shipped that way.
//  2. An era bucket is too coarse, so one set of lines covers a huge
//     stretch of campaign. B11-B29 were a single era for a long time.
//
// This test walks the REAL per-battle rosters and demands a line for
// every character in the squad at that point, plus valid expressions.

import { describe, it, expect } from "vitest";
import { CAMP_TALK, eraFromCompletedBattles, resolveCampBeat, type CampEra } from "../campTalk";
import { ACTIVE_ROSTER, fallenIds } from "../activeRoster";
import { PORTRAIT_EXPRESSIONS } from "../../assets/expressions";

describe("camp talk", () => {
  it("every character in a battle's squad has lines for that battle's era", () => {
    const missing: string[] = [];
    for (const [battleId, squad] of Object.entries(ACTIVE_ROSTER)) {
      const era = eraFromCompletedBattles([battleId]);
      // The dead leave the fire (CampScene subtracts them), so they
      // don't need lines for eras after they fall.
      const gone = fallenIds([battleId]);
      for (const id of squad ?? []) {
        if (gone.has(id)) continue;
        const lines = CAMP_TALK[id]?.eras[era];
        if (!lines || lines.length === 0) missing.push(`${id} has no camp lines for "${era}" (fielded in ${battleId})`);
      }
    }
    expect([...new Set(missing)], "camp lines missing — clicking these characters returns the generic fallback").toEqual([]);
  });

  it("every authored expression exists for that character's portrait", () => {
    const bad: string[] = [];
    for (const talk of Object.values(CAMP_TALK)) {
      const valid = new Set<string>(PORTRAIT_EXPRESSIONS[talk.portraitId] ?? []);
      for (const [era, lines] of Object.entries(talk.eras)) {
        for (const line of lines ?? []) {
          if (line.expression && !valid.has(line.expression)) {
            bad.push(`${talk.characterId}/${era}: "${line.expression}" is not a registered expression`);
          }
        }
      }
    }
    expect(bad, "an unregistered expression silently falls back to the base portrait").toEqual([]);
  });

  it("no era bucket spans more than a handful of chapters", () => {
    // Guards against the B11-B29 regression: one era covering half the
    // campaign means the camp stops tracking the story.
    const spans = new Map<CampEra, number[]>();
    for (let ch = 1; ch <= 29; ch++) {
      const era = eraFromCompletedBattles([`b${String(ch).padStart(2, "0")}_x`]);
      spans.set(era, [...(spans.get(era) ?? []), ch]);
    }
    for (const [era, chapters] of spans) {
      expect(chapters.length, `era "${era}" covers ${chapters.length} chapters (${chapters[0]}-${chapters.at(-1)})`)
        .toBeLessThanOrEqual(5);
    }
  });

  it("resolves a real beat for a mid-campaign click, and never returns an empty body", () => {
    const beat = resolveCampBeat("veya", ["b20_dawn_war"]);
    expect(beat.speaker).toBe("Veya");
    expect(beat.portraitId).toBe("veya");
    expect(beat.body.length).toBeGreaterThan(20);
    // Unknown character still yields a usable narrator beat.
    expect(resolveCampBeat("nobody", ["b01_palace_coup"]).body.length).toBeGreaterThan(10);
  });
});
