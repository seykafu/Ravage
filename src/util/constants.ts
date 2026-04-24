export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;
export const TILE_SIZE = 48;

export const COLORS = {
  bgDeep: 0x05060a,
  bgPanel: 0x0d111c,
  panelEdge: 0x2a2a3a,
  gold: 0xc9b07a,
  goldBright: 0xf2d997,
  blood: 0xb84141,
  steel: 0x6c7281,
  parchment: 0xe8d8a6,
  player: 0x6db2ff,
  enemy: 0xd05a4a,
  ally: 0x6ed09a,
  ready: 0xffd45a,
  defensive: 0x8ad6ff,
  threat: 0xff6e5a,
  moveTile: 0x4d8aff,
  attackTile: 0xff5a4d,
  hover: 0xfff7c4
} as const;

export const FONT_TITLE = '700 56px "Cinzel", "Trajan Pro", "Times New Roman", serif';
export const FONT_HEADER = '600 22px "Cinzel", "Trajan Pro", serif';
export const FONT_BODY = '400 16px "Georgia", "Times New Roman", serif';
export const FONT_UI = '600 14px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
export const FONT_MONO = '12px "Consolas", "Menlo", monospace';

// Font families — bake the full fallback stack once so every scene matches.
//
// Display + Heading stay Cinzel for banner moments where the calligraphic
// look earns its keep. Everything else is "Pixelify Sans" — a variable
// pixel-art font designed to render crisply on a canvas with
// `image-rendering: pixelated`. The previous Garamond/Inter stack rendered
// antialiased glyphs that looked blurry once the canvas was nearest-neighbor
// scaled to the window. Pixel fonts dodge that conflict entirely.
export const FAMILY_DISPLAY = '"Cinzel Decorative", "Cinzel", "Trajan Pro", "Times New Roman", serif';
export const FAMILY_HEADING = '"Cinzel", "Trajan Pro", "Times New Roman", serif';
export const FAMILY_BODY    = '"Pixelify Sans", "EB Garamond", "Georgia", "Times New Roman", serif';
export const FAMILY_UI      = '"Pixelify Sans", "Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif';
export const FAMILY_MONO    = '"Consolas", "Menlo", monospace';

// Typography scale — single source of truth for Phaser TextStyle objects.
// All scenes should pull from this rather than hand-rolling fontFamily/fontSize.
import type Phaser from "phaser";
type TS = Phaser.Types.GameObjects.Text.TextStyle;

const SHADOW_DEEP = { offsetX: 0, offsetY: 3, color: "#000", blur: 10, fill: true, stroke: true };
const SHADOW_SOFT = { offsetX: 0, offsetY: 2, color: "#000", blur: 6,  fill: true, stroke: false };

export const TYPO = {
  display: {
    fontFamily: FAMILY_DISPLAY,
    fontSize: "120px",
    color: "#f4d999",
    stroke: "#1a0e04",
    strokeThickness: 8,
    shadow: { offsetX: 0, offsetY: 4, color: "#000", blur: 18, fill: true, stroke: true }
  } as TS,
  title: {
    fontFamily: FAMILY_DISPLAY,
    fontSize: "32px",
    color: "#f4d999",
    stroke: "#1a0e04",
    strokeThickness: 5,
    shadow: SHADOW_DEEP
  } as TS,
  h1: {
    fontFamily: FAMILY_HEADING,
    fontSize: "26px",
    color: "#f4d999",
    stroke: "#1a0e04",
    strokeThickness: 4,
    shadow: SHADOW_SOFT
  } as TS,
  h2: {
    fontFamily: FAMILY_HEADING,
    fontSize: "20px",
    color: "#e8c97c",
    stroke: "#1a0e04",
    strokeThickness: 3,
    shadow: SHADOW_SOFT
  } as TS,
  speaker: {
    fontFamily: FAMILY_HEADING,
    fontSize: "22px",
    color: "#f4d999",
    stroke: "#000",
    strokeThickness: 3,
    shadow: SHADOW_SOFT
  } as TS,
  body: {
    fontFamily: FAMILY_BODY,
    fontSize: "20px",
    color: "#f3ecd9",
    stroke: "#000",
    strokeThickness: 2,
    shadow: SHADOW_SOFT
  } as TS,
  bodyItalic: {
    fontFamily: FAMILY_BODY,
    fontSize: "20px",
    color: "#dccfa8",
    fontStyle: "italic",
    stroke: "#000",
    strokeThickness: 2,
    shadow: SHADOW_SOFT
  } as TS,
  caption: {
    fontFamily: FAMILY_BODY,
    fontSize: "16px",
    color: "#c9b07a",
    stroke: "#000",
    strokeThickness: 2
  } as TS,
  ui: {
    fontFamily: FAMILY_UI,
    fontSize: "14px",
    color: "#dde6ef",
    stroke: "#000",
    strokeThickness: 2
  } as TS,
  uiBold: {
    fontFamily: FAMILY_UI,
    fontSize: "14px",
    fontStyle: "600",
    color: "#f4e4b0",
    stroke: "#000",
    strokeThickness: 2
  } as TS,
  micro: {
    fontFamily: FAMILY_UI,
    fontSize: "11px",
    color: "#a0a8b8",
    stroke: "#000",
    strokeThickness: 2
  } as TS,
  mono: {
    fontFamily: FAMILY_MONO,
    fontSize: "12px",
    color: "#aab2c0"
  } as TS
} as const;

export const GAME_STATE_KEY = "ravage:save:v1";
