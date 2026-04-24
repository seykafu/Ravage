// AssetManifest — central registry mapping logical asset IDs to file paths.
//
// The pattern: every art helper (PortraitArt, UnitArt, etc.) consults the
// manifest first. If a real asset file is registered for the requested ID,
// we load and use it. Otherwise we fall back to procedural canvas generation.
//
// This lets us drop in real assets one-by-one (e.g., the Amar portrait first,
// then Lucian, then a swordsman sprite sheet) without breaking anything that
// hasn't been replaced yet. The procedural code stays as a permanent fallback.
//
// All paths are relative to /public, served at /<path>.

import type { ClassKind } from "../combat/types";
import { DEFAULT_USES_NEUTRAL_VARIANT, PORTRAIT_EXPRESSIONS } from "./expressions";

// --------- Asset specs (sizes, frame counts) ---------------------------------
//
// These dimensions match what the existing procedural code already produces,
// so we don't have to refactor combat. To upgrade fidelity later, bump these
// constants AND every reference site at the same time.

export const ASSET_SPEC = {
  portrait: { w: 64, h: 72 },
  unitSprite: { w: 32, h: 40 }, // single static frame
  // Animation strips. The frame count is "what the spritesheet should contain";
  // BootScene loads them as a Phaser spritesheet using these dimensions.
  unitAnim: {
    w: 32,
    h: 40,
    frames: {
      idle: 2,    // 2-frame breathing loop ~1fps
      walk: 4,    // 4-frame walk cycle
      attack: 5,  // wind-up + swing + recover
      hit: 2,     // flinch + recover
      death: 4    // fall + fade
    } as const
  },
  tile: { w: 48, h: 48 },
  backdrop: { w: 1280, h: 720 },
  // VFX overlays — slash arcs, hit sparks, arrow trails.
  vfx: {
    slash: { w: 64, h: 64, frames: 5 },
    hitSpark: { w: 32, h: 32, frames: 4 },
    arrow: { w: 24, h: 8, frames: 1 }
  }
} as const;

export type UnitAnimState = keyof typeof ASSET_SPEC.unitAnim.frames;

// --------- Manifest entries --------------------------------------------------
//
// To register a new real asset, add an entry here. BootScene reads this list
// at startup and queues each one for loading.
//
// Each entry has:
//   id     — the logical key the game code uses (e.g., "portrait:amar")
//   path   — file path under /public
//   kind   — "image" | "spritesheet" | "audio"
//   frame  — for spritesheets, frame dimensions

export type AssetKind = "image" | "spritesheet" | "audio";

export interface ManifestEntry {
  id: string;
  path: string;
  kind: AssetKind;
  frame?: { w: number; h: number };
}

// All known portraits. Add a file at public/assets/portraits/<id>.png and
// uncomment / register here to swap in the real version.
const PORTRAIT_IDS = [
  "amar", "lucian", "ning", "maya", "leo", "ranatoli", "selene",
  "kian", "ndari", "nebu",
  "dawn", "fergus", "ndara", "archbold", "khione", "mira", "tali",
  "narrator"
] as const;

const baseEntries: ManifestEntry[] = PORTRAIT_IDS.map((id) => ({
  id: `portrait:${id}`,
  // For characters with a curated `<id>_neutral.png`, prefer it over the
  // legacy base file (older test render).
  path: DEFAULT_USES_NEUTRAL_VARIANT.has(id)
    ? `assets/portraits/${id}_neutral.png`
    : `assets/portraits/${id}.png`,
  kind: "image"
}));

// Expression variants — `<character>_<expression>.png`. Loaded as
// `portrait:<id>:<expression>`. Missing files silently 404 and the dialog
// falls back to the default portrait.
const expressionEntries: ManifestEntry[] = Object.entries(PORTRAIT_EXPRESSIONS).flatMap(
  ([id, exprs]) => exprs.map((expr) => ({
    id: `portrait:${id}:${expr}`,
    path: `assets/portraits/${id}_${expr}.png`,
    kind: "image" as const
  }))
);

const portraitEntries: ManifestEntry[] = [...baseEntries, ...expressionEntries];

// Per-class animation strips. We register the full set per class; if a file
// doesn't exist on disk Vite's loader will simply 404 and Phaser will skip it
// (we suppress the load error and fall back to procedural).
const CLASSES: ClassKind[] = [
  "swordsman", "spearton", "knight", "archer",
  "shinobi", "sentinel", "wyvern_rider", "swordmaster", "boss"
];

const ANIM_STATES: UnitAnimState[] = ["idle", "walk", "attack", "hit", "death"];

const unitAnimEntries: ManifestEntry[] = CLASSES.flatMap((cls) =>
  ANIM_STATES.map((state) => ({
    id: `unit:${cls}:${state}`,
    path: `assets/sprites/${cls}/${state}.png`,
    kind: "spritesheet" as const,
    frame: { w: ASSET_SPEC.unitAnim.w, h: ASSET_SPEC.unitAnim.h }
  }))
);

// Backdrops keyed by the same names BackdropArt uses today.
const BACKDROP_IDS = [
  "palaceCoup", "thuling", "farmland", "mountain", "swamp",
  "caravan", "monastery", "orinhal", "cliffs", "gruge", "finalBoss"
] as const;

const backdropEntries: ManifestEntry[] = BACKDROP_IDS.map((id) => ({
  id: `backdrop:${id}`,
  path: `assets/backdrops/${id}.png`,
  kind: "image"
}));

// Tiles by terrain name. Optional override for the procedural tile painter.
const TILE_IDS = [
  "grass", "stone", "wood", "marble", "dirt", "snow", "sand", "water",
  "forest", "wall", "door", "rubble"
] as const;

const tileEntries: ManifestEntry[] = TILE_IDS.map((id) => ({
  id: `tile:${id}`,
  path: `assets/tiles/${id}.png`,
  kind: "image"
}));

// VFX
const vfxEntries: ManifestEntry[] = [
  { id: "vfx:slash",    path: "assets/vfx/slash.png",     kind: "spritesheet", frame: ASSET_SPEC.vfx.slash },
  { id: "vfx:hitSpark", path: "assets/vfx/hit_spark.png", kind: "spritesheet", frame: ASSET_SPEC.vfx.hitSpark },
  { id: "vfx:arrow",    path: "assets/vfx/arrow.png",     kind: "image" }
];

// UI overrides. The procedural parchment panel is fine, but if you drop a
// real PNG here it'll be used instead.
const uiEntries: ManifestEntry[] = [
  { id: "ui:panel",        path: "assets/ui/panel.png",        kind: "image" },
  { id: "ui:button_idle",  path: "assets/ui/button_idle.png",  kind: "image" },
  { id: "ui:button_hover", path: "assets/ui/button_hover.png", kind: "image" }
];

export const MANIFEST: ManifestEntry[] = [
  ...portraitEntries,
  ...unitAnimEntries,
  ...backdropEntries,
  ...tileEntries,
  ...vfxEntries,
  ...uiEntries
];

// --------- Runtime check: is a given asset id loaded? ------------------------
//
// BootScene populates this set as files successfully load. Art helpers ask
// hasAsset(id) before deciding whether to use the real image or the
// procedural fallback.

const loaded = new Set<string>();

export const markLoaded = (id: string): void => { loaded.add(id); };
export const markFailed = (id: string): void => { loaded.delete(id); };
export const hasAsset = (id: string): boolean => loaded.has(id);
export const loadedAssetIds = (): readonly string[] => Array.from(loaded);
