// Portrait manifest integrity.
//
// Two invariants, both learned the hard way:
//
//  1. Every playable character with `portrait: true` must have a BASE
//     `portrait:<id>` entry in the manifest. The expression registry
//     (PORTRAIT_EXPRESSIONS) only loads `portrait:<id>:<expr>` variants;
//     the battle side panel, initiative UI, and expressionless dialogue
//     beats all look up the base key. Veya and Corin shipped with full
//     expression sets but no base entry — their art loaded for dialogue
//     yet the battle menu showed the procedural fallback face.
//
//  2. Manifest paths must match on-disk filenames with EXACT case.
//     Windows dev boxes resolve `corin_neutral.png` against
//     `Corin_neutral.png`; Vercel's Linux filesystem 404s it. A file
//     that is missing entirely is allowed (pending art falls back by
//     design) — but a file that exists with the wrong case is always a
//     latent production bug.

import { describe, it, expect } from "vitest";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { MANIFEST } from "../manifest";
import { PLAYERS } from "../../data/units";

const PORTRAIT_DIR = join(__dirname, "..", "..", "..", "public", "assets", "portraits");
const onDisk = new Set(readdirSync(PORTRAIT_DIR));
const onDiskLower = new Map<string, string>();
for (const f of onDisk) onDiskLower.set(f.toLowerCase(), f);

const portraitEntries = MANIFEST.filter((e) => e.id.startsWith("portrait:"));

describe("portrait manifest", () => {
  it("every playable character with a portrait has a base manifest entry", () => {
    const baseIds = new Set(
      portraitEntries
        .filter((e) => e.id.split(":").length === 2)
        .map((e) => e.id.slice("portrait:".length))
    );
    for (const factory of Object.values(PLAYERS)) {
      const def = factory();
      if (!def.portrait) continue;
      const pid = def.portraitId ?? def.id;
      expect(
        baseIds.has(pid),
        `${def.id}: no base "portrait:${pid}" entry in PORTRAIT_IDS — ` +
        `the battle menu will show the procedural fallback face`
      ).toBe(true);
    }
  });

  it("every playable character's base portrait file exists on disk", () => {
    const baseByPid = new Map(
      portraitEntries
        .filter((e) => e.id.split(":").length === 2)
        .map((e) => [e.id.slice("portrait:".length), e] as const)
    );
    for (const factory of Object.values(PLAYERS)) {
      const def = factory();
      if (!def.portrait) continue;
      const entry = baseByPid.get(def.portraitId ?? def.id);
      if (!entry) continue; // covered by the previous test
      const file = entry.path.split("/").pop()!;
      expect(
        onDiskLower.has(file.toLowerCase()),
        `${def.id}: base portrait file "${file}" not found in public/assets/portraits`
      ).toBe(true);
    }
  });

  it("no manifest portrait path differs from its on-disk file only by case", () => {
    for (const e of portraitEntries) {
      const file = e.path.split("/").pop()!;
      const actual = onDiskLower.get(file.toLowerCase());
      if (actual === undefined) continue; // missing entirely = pending art, allowed
      expect(
        actual,
        `${e.id}: manifest asks for "${file}" but disk has "${actual}" — ` +
        `works on Windows, 404s on Vercel`
      ).toBe(file);
    }
  });
});
