import Phaser from "phaser";
import { PixelCanvas, darkenColor, lightenColor, mixColor } from "./PixelCanvas";
import { Rng } from "../util/rng";
import type { ObstacleKind, TerrainKind } from "../combat/types";
import { TILE_SIZE } from "../util/constants";

// Render a tile as a pseudo-3D block: top face + slight side highlight + speckled detail.
// We use TILE_SIZE for the top-face square; the bevel is drawn just inside its borders.

// Palettes used by the procedural tile painter. The real PNGs in
// public/assets/tiles/ override these at runtime — these stay as the
// always-available fallback if a real tile fails to load.
const TERRAIN_BASE: Record<TerrainKind, { hi: number; mid: number; lo: number }> = {
  grass:         { hi: 0x6da55a, mid: 0x4d8147, lo: 0x2e5a36 },
  stone:         { hi: 0x9e9e9e, mid: 0x6e6e75, lo: 0x44444a },
  dirt:          { hi: 0x8a684a, mid: 0x644a35, lo: 0x3a2b1e },
  wood:          { hi: 0xa07442, mid: 0x6f4e2c, lo: 0x3c2914 },
  carpet:        { hi: 0x91382f, mid: 0x6a221d, lo: 0x3c100c },
  water:         { hi: 0x4d8ed1, mid: 0x2c5e98, lo: 0x12345f },
  snow:          { hi: 0xeef0f4, mid: 0xc5cdd6, lo: 0x8c98a9 },
  mud:           { hi: 0x6a4d2c, mid: 0x4a3520, lo: 0x231811 },
  // Main asset set
  marble:        { hi: 0xefe9d8, mid: 0xc8c2af, lo: 0x8b8674 },
  sand:          { hi: 0xe6cf99, mid: 0xc4a973, lo: 0x8a7449 },
  forest:        { hi: 0x5b8a48, mid: 0x3a5e30, lo: 0x1f3a1c },
  wall:          { hi: 0x9e9a92, mid: 0x6f6c66, lo: 0x3e3c38 },
  door:          { hi: 0xa07442, mid: 0x6f4e2c, lo: 0x3c2914 },
  rubble:        { hi: 0xa9a299, mid: 0x7a746b, lo: 0x4a4540 },
  // Bonus asset set
  cobblestone:   { hi: 0x9a958a, mid: 0x6e6961, lo: 0x42403c },
  cracked_earth: { hi: 0xa68360, mid: 0x7a5b3e, lo: 0x4a3624 },
  ice:           { hi: 0xdaeaf2, mid: 0xa8c7d8, lo: 0x6e90a4 },
  lava:          { hi: 0xff8a3a, mid: 0xc94a1e, lo: 0x6f1c0c },
  moss_stone:    { hi: 0x6e7a52, mid: 0x4a5436, lo: 0x2a311e }
};

const drawIsoTile = (px: PixelCanvas, base: { hi: number; mid: number; lo: number }, rng: Rng): void => {
  const w = px.width;
  const h = px.height;
  // Fill top face
  px.fillRect(0, 0, w, h, base.mid);
  // Bevel: light along top + left, dark along bottom + right.
  for (let i = 0; i < 2; i++) {
    px.fillRect(i, i, w - i * 2, 1, lightenColor(base.mid, 0.18));
    px.fillRect(i, i, 1, h - i * 2, lightenColor(base.mid, 0.10));
    px.fillRect(i, h - 1 - i, w - i * 2, 1, darkenColor(base.mid, 0.30));
    px.fillRect(w - 1 - i, i, 1, h - i * 2, darkenColor(base.mid, 0.20));
  }
  // Speckle for organic feel
  const dots = Math.floor(rng.next() * 18) + 14;
  for (let n = 0; n < dots; n++) {
    const x = rng.intRange(2, w - 2);
    const y = rng.intRange(2, h - 2);
    const c = rng.next() < 0.5 ? base.hi : base.lo;
    px.pixel(x, y, c, 0.55);
  }
};

const drawObstacle = (px: PixelCanvas, kind: ObstacleKind, rng: Rng): void => {
  const w = px.width;
  const h = px.height;
  switch (kind) {
    case "hay": {
      const yellow = 0xd9b25c;
      const dark = 0x6a4f23;
      // Two haystacks
      const baseY = h - 6;
      px.fillRect(4, baseY - 14, w - 8, 14, yellow);
      // streaks
      for (let i = 0; i < 30; i++) {
        const x = rng.intRange(5, w - 5);
        const y = rng.intRange(baseY - 13, baseY - 1);
        px.pixel(x, y, dark);
      }
      // top highlight
      px.fillRect(4, baseY - 14, w - 8, 1, lightenColor(yellow, 0.2));
      // side shadow
      px.fillRect(4, baseY - 1, w - 8, 1, darkenColor(yellow, 0.4));
      // shadow under
      px.fillRect(2, baseY, w - 4, 2, 0x000000);
      px.ctx.globalAlpha = 1;
      break;
    }
    case "fence": {
      const wood = 0x6c4825;
      const lighter = lightenColor(wood, 0.25);
      // Horizontal rails
      px.fillRect(2, h - 14, w - 4, 2, wood);
      px.fillRect(2, h - 8, w - 4, 2, wood);
      px.fillRect(2, h - 14, w - 4, 1, lighter);
      // posts
      px.fillRect(4, h - 18, 3, 14, wood);
      px.fillRect(w - 7, h - 18, 3, 14, wood);
      px.fillRect(Math.floor(w / 2) - 1, h - 18, 3, 14, wood);
      break;
    }
    case "wagon": {
      const body = 0x6a3a1a;
      const trim = 0xb37a3a;
      const wheel = 0x1c1410;
      const baseY = h - 6;
      // body
      px.fillRect(3, baseY - 14, w - 6, 10, body);
      // trim
      px.fillRect(3, baseY - 14, w - 6, 1, trim);
      // wheels
      const wheelR = 4;
      for (let dx = 0; dx < wheelR * 2; dx++) {
        for (let dy = 0; dy < wheelR * 2; dy++) {
          const cx = dx - (wheelR - 0.5);
          const cy = dy - (wheelR - 0.5);
          if (cx * cx + cy * cy <= wheelR * wheelR) {
            px.pixel(6 + dx, baseY - 4 + dy, wheel);
            px.pixel(w - 14 + dx, baseY - 4 + dy, wheel);
          }
        }
      }
      // axle highlights
      px.pixel(6 + wheelR, baseY - 4 + wheelR, trim);
      px.pixel(w - 14 + wheelR, baseY - 4 + wheelR, trim);
      break;
    }
    case "barricade": {
      const wood = 0x4f3416;
      const ironPin = 0x787078;
      px.fillRect(3, h - 14, w - 6, 5, wood);
      px.fillRect(3, h - 9, w - 6, 4, darkenColor(wood, 0.25));
      px.fillRect(3, h - 14, w - 6, 1, lightenColor(wood, 0.3));
      px.fillRect(6, h - 14, 1, 9, ironPin);
      px.fillRect(w - 7, h - 14, 1, 9, ironPin);
      break;
    }
    case "pillar": {
      const stone = 0xb6b1a4;
      const mid = 0x70695a;
      const base = h - 4;
      px.fillRect(Math.floor(w / 2) - 5, 4, 10, base - 4, mid);
      px.fillRect(Math.floor(w / 2) - 5, 4, 10, 2, lightenColor(stone, 0.2));
      px.fillRect(Math.floor(w / 2) - 6, base - 6, 12, 4, stone);
      px.fillRect(Math.floor(w / 2) - 7, base - 2, 14, 3, darkenColor(stone, 0.3));
      break;
    }
    case "throne": {
      const seat = 0x5a1c1c;
      const gold = 0xd9b257;
      const base = h - 4;
      px.fillRect(6, base - 14, w - 12, 12, seat);
      px.fillRect(6, base - 14, w - 12, 1, gold);
      px.fillRect(6, base - 2, w - 12, 2, darkenColor(seat, 0.4));
      px.fillRect(4, base - 18, 3, 16, seat);
      px.fillRect(w - 7, base - 18, 3, 16, seat);
      px.fillRect(4, base - 18, 3, 1, gold);
      px.fillRect(w - 7, base - 18, 3, 1, gold);
      break;
    }
    case "tree": {
      const trunk = 0x5a3a1c;
      const leaves = 0x355937;
      const leavesHi = 0x6da55a;
      px.fillRect(Math.floor(w / 2) - 1, h - 10, 3, 8, trunk);
      // canopy
      const cx = Math.floor(w / 2);
      const cy = h - 18;
      const r = 8;
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (dx * dx + dy * dy <= r * r) {
            const c = (rng.next() < 0.4 ? leavesHi : leaves);
            px.pixel(cx + dx, cy + dy, c);
          }
        }
      }
      break;
    }
    case "rock": {
      const stone = 0x8c8a82;
      const dark = 0x46443e;
      const baseY = h - 4;
      const r = 7;
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (dx * dx + dy * dy <= r * r) {
            px.pixel(Math.floor(w / 2) + dx, baseY - r + dy, dx + dy < 0 ? stone : dark);
          }
        }
      }
      break;
    }
    case "torch": {
      const stone = 0x6a655d;
      const flame = 0xff8a3a;
      const flameHi = 0xfff0c0;
      px.fillRect(Math.floor(w / 2) - 1, h - 12, 3, 10, stone);
      px.fillRect(Math.floor(w / 2) - 2, h - 16, 5, 4, flame);
      px.fillRect(Math.floor(w / 2) - 1, h - 18, 3, 3, flameHi);
      break;
    }
    case "none":
    default:
      break;
  }
};

export const tileTextureKey = (terrain: TerrainKind, obstacle: ObstacleKind, seed: number): string =>
  `tile-${terrain}-${obstacle}-${seed}`;

// Cache key for the composited (real terrain + real obstacle) variant. We
// don't include the procedural seed because real PNGs are deterministic.
const compositeKey = (terrain: TerrainKind, obstacle: ObstacleKind): string =>
  `tile-real-${terrain}-${obstacle}`;

// Pull the underlying source image for a loaded Phaser texture so we can
// draw it onto our own canvas. Returns null if the asset isn't loaded.
const getSource = (scene: Phaser.Scene, key: string): CanvasImageSource | null => {
  if (!scene.textures.exists(key)) return null;
  const src = scene.textures.get(key).getSourceImage();
  return src as CanvasImageSource;
};

export const ensureTileTexture = (
  scene: Phaser.Scene,
  terrain: TerrainKind,
  obstacle: ObstacleKind,
  seed: number
): string => {
  // 1) Plain tile, no obstacle: use the real PNG directly if it's loaded.
  if (obstacle === "none") {
    const realKey = `tile:${terrain}`;
    if (scene.textures.exists(realKey)) return realKey;
  }

  // 2) Tile + obstacle: if BOTH real PNGs are loaded, composite them into a
  //    single cached canvas. The composite is keyed by (terrain, obstacle) so
  //    every cell with the same combo shares one texture (no per-seed waste).
  if (obstacle !== "none") {
    const composite = compositeKey(terrain, obstacle);
    if (scene.textures.exists(composite)) return composite;

    const tileSrc = getSource(scene, `tile:${terrain}`);
    const obstacleSrc = getSource(scene, `obstacle:${obstacle}`);
    if (tileSrc && obstacleSrc) {
      const canvas = document.createElement("canvas");
      canvas.width = TILE_SIZE;
      canvas.height = TILE_SIZE;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(tileSrc, 0, 0, TILE_SIZE, TILE_SIZE);
        ctx.drawImage(obstacleSrc, 0, 0, TILE_SIZE, TILE_SIZE);
        scene.textures.addCanvas(composite, canvas);
        return composite;
      }
    }
  }

  // 3) Fallback: full procedural — base tile palette + procedural obstacle.
  const key = tileTextureKey(terrain, obstacle, seed);
  if (scene.textures.exists(key)) return key;
  const px = new PixelCanvas(TILE_SIZE, TILE_SIZE);
  const rng = new Rng(seed * 16777619 ^ terrain.length * 7919);
  drawIsoTile(px, TERRAIN_BASE[terrain], rng);
  drawObstacle(px, obstacle, rng);
  scene.textures.addCanvas(key, px.canvas);
  return key;
};

// A tinted overlay tile — for highlights (move/attack/threat).
export const ensureTintTile = (scene: Phaser.Scene, color: number, alpha: number): string => {
  const key = `tint-${color.toString(16)}-${Math.round(alpha * 100)}`;
  if (scene.textures.exists(key)) return key;
  const px = new PixelCanvas(TILE_SIZE, TILE_SIZE);
  px.fillRect(0, 0, TILE_SIZE, TILE_SIZE, color, alpha);
  // bright border
  px.fillRect(0, 0, TILE_SIZE, 1, color, Math.min(1, alpha + 0.3));
  px.fillRect(0, TILE_SIZE - 1, TILE_SIZE, 1, color, Math.min(1, alpha + 0.3));
  px.fillRect(0, 0, 1, TILE_SIZE, color, Math.min(1, alpha + 0.3));
  px.fillRect(TILE_SIZE - 1, 0, 1, TILE_SIZE, color, Math.min(1, alpha + 0.3));
  scene.textures.addCanvas(key, px.canvas);
  return key;
};

export { mixColor };
