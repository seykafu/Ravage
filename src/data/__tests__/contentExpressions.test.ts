// Content-integrity guard: every portrait EXPRESSION referenced by a dialogue
// beat must be known to the portrait registry.
//
// Why this exists: the dialogue renderer resolves an expression by trying
// `portrait:<id>:<expr>`, then the character's default portrait, then a
// procedural fallback. So a beat that asks for an expression the registry
// has never heard of doesn't crash — it silently renders the character's
// NEUTRAL face. That means a writer can fat-finger `expression: "redy"` (or
// use a real emotion like "ready" that was never registered) and lose the
// authorial intent with zero feedback. The full audit found 11 such pairs.
//
// This test makes that class of mistake fail at `npm test` instead. A beat's
// expression is considered "known" if it is:
//   * "neutral" (the implicit base portrait), or
//   * listed in PORTRAIT_EXPRESSIONS[id], or
//   * the registered DEFAULT_VARIANT_FOR[id] (a named-neutral standing in
//     for the base file).
// Registering a slug does NOT require the PNG to exist yet — BootScene 404s
// missing files harmlessly. So the fix for a failure is always cheap: add the
// slug to PORTRAIT_EXPRESSIONS (preserving intent), or correct the typo.
//
// These plain static imports work under the `node` vitest env precisely
// because the content graph (battles.ts → units → palettes, musicKeys,
// Victory, maps, beats) is Phaser-FREE: the MUSIC constants were split into
// audio/musicKeys.ts so battles.ts no longer transitively imports Phaser. If
// a future edit reintroduces a Phaser import into this graph, THIS test will
// fail to load — which is itself a useful signal that the decoupling broke.

import { describe, it, expect } from "vitest";
import { BATTLES } from "../battles";
import { ARCS } from "../../story/beats";
import { PORTRAIT_EXPRESSIONS, DEFAULT_VARIANT_FOR } from "../../assets/expressions";
import type { DialogBeat } from "../../story/beats";

// Collect every beat in the game from both content sources.
const collectBeats = (): { where: string; beat: DialogBeat }[] => {
  const out: { where: string; beat: DialogBeat }[] = [];

  // BattleNode.intro/outro are plain framing STRINGS, not beats — the only
  // per-battle beats are in the mid-fight `dialogues[].beats`. The bracketing
  // story beats live in ARCS (below).
  for (const node of BATTLES) {
    for (const dlg of node.dialogues ?? []) {
      for (const [i, beat] of dlg.beats.entries()) {
        out.push({ where: `battle ${node.id} dialogue ${dlg.id} beat[${i}]`, beat });
      }
    }
  }

  for (const arc of Object.values(ARCS)) {
    for (const [i, beat] of arc.beats.entries()) {
      out.push({ where: `arc ${arc.id} beat[${i}]`, beat });
    }
  }

  return out;
};

const isKnownExpression = (id: string, expr: string): boolean => {
  if (expr === "neutral") return true;
  if ((PORTRAIT_EXPRESSIONS[id] ?? []).includes(expr)) return true;
  if (DEFAULT_VARIANT_FOR.get(id) === expr) return true;
  return false;
};

describe("dialogue expression integrity", () => {
  it("collects a non-trivial number of beats (sanity: content actually loaded)", () => {
    // Guards against the walker silently finding nothing (e.g., a shape change
    // in BattleNode) and the test passing vacuously.
    expect(collectBeats().length).toBeGreaterThan(100);
  });

  it("every beat's (portraitId, expression) is registered", () => {
    const unknown: string[] = [];
    for (const { where, beat } of collectBeats()) {
      if (!beat.expression) continue; // no expression → default portrait, fine
      const id = beat.portraitId;
      if (!id) continue; // narrator-style beat with an expression but no id
      if (!isKnownExpression(id, beat.expression)) {
        unknown.push(`${where}: "${id}" has no registered expression "${beat.expression}"`);
      }
    }
    // Print every offender at once so a content pass can fix them in a batch.
    expect(unknown, `\n${unknown.join("\n")}\n`).toEqual([]);
  });
});
