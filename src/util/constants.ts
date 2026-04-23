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

export const GAME_STATE_KEY = "ravage:save:v1";
