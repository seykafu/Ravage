// Sprite asset integrity. The class sprite folders are a drop-in art
// pipeline: BootScene loads public/assets/sprites/<class>/<state>.png
// for every class in the manifest, and resolveSpriteClass upgrades
// units the moment their class art exists. That contract fails SILENTLY
// on a bad drop — a file named "idle.png.png" (real incident) simply
// 404s and the unit keeps its stand-in sprite with no error anywhere.
// These tests make bad drops loud.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ASSET_SPEC, type UnitAnimState } from "../manifest";

const SPRITES_DIR = join(__dirname, "..", "..", "..", "public", "assets", "sprites");
const STATES: UnitAnimState[] = ["idle", "walk", "attack", "hit", "death"];
const VALID_NAMES = new Set(STATES.map((s) => `${s}.png`));

const pngSize = (path: string): { w: number; h: number; colorType: number } => {
  const d = readFileSync(path);
  return { w: d.readUInt32BE(16), h: d.readUInt32BE(20), colorType: d[25]! };
};

const classDirs = readdirSync(SPRITES_DIR).filter((f) =>
  statSync(join(SPRITES_DIR, f)).isDirectory()
);

describe("sprite assets", () => {
  it("every file in a class folder is an exactly-named state sheet", () => {
    for (const cls of classDirs) {
      for (const f of readdirSync(join(SPRITES_DIR, cls))) {
        if (f === "README.md") continue;
        expect(
          VALID_NAMES.has(f),
          `sprites/${cls}/${f}: not a recognized state sheet name — ` +
          `the loader asks for ${STATES.join("/")}.png exactly (case-sensitive ` +
          `on Vercel; double extensions like "idle.png.png" 404 silently)`
        ).toBe(true);
      }
    }
  });

  it("every shipped sheet has the exact frame geometry the loader slices", () => {
    const { w: fw, h: fh, frames } = ASSET_SPEC.unitAnim;
    for (const cls of classDirs) {
      for (const f of readdirSync(join(SPRITES_DIR, cls))) {
        if (f === "README.md" || !VALID_NAMES.has(f)) continue;
        const state = f.replace(".png", "") as UnitAnimState;
        const { w, h, colorType } = pngSize(join(SPRITES_DIR, cls, f));
        expect(
          { w, h },
          `sprites/${cls}/${f}: expected ${frames[state] * fw}x${fh} ` +
          `(${frames[state]} frames of ${fw}x${fh}) — a full-res render here ` +
          `gets sliced into garbage frames`
        ).toEqual({ w: frames[state] * fw, h: fh });
        expect(colorType, `sprites/${cls}/${f}: not RGBA (needs real alpha)`).toBe(6);
      }
    }
  });
});
