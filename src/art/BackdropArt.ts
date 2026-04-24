import Phaser from "phaser";
import { PixelCanvas, darkenColor, lightenColor, mixColor } from "./PixelCanvas";
import { Rng } from "../util/rng";
import { GAME_HEIGHT, GAME_WIDTH } from "../util/constants";

// Painted parallax-style backdrops for non-battle scenes.
// Each backdrop is a static large canvas drawn once, then referenced by Phaser.

interface MountainSpec {
  near: number;
  mid: number;
  far: number;
  sky: number;
  glow?: number;
  ground: number;
  hasMoon?: boolean;
  hasSnow?: boolean;
  hasFire?: boolean;
  hasFog?: boolean;
  seed: number;
  ridges?: number;
}

const drawSky = (px: PixelCanvas, sky: number, glow: number): void => {
  for (let y = 0; y < px.height; y++) {
    const t = y / px.height;
    const c = mixColor(sky, glow, Math.max(0, 1 - t * 1.4));
    px.ctx.fillStyle = `rgb(${(c >> 16) & 0xff},${(c >> 8) & 0xff},${c & 0xff})`;
    px.ctx.fillRect(0, y, px.width, 1);
  }
};

const drawStars = (px: PixelCanvas, rng: Rng): void => {
  for (let i = 0; i < 220; i++) {
    const x = rng.intRange(0, px.width);
    const y = rng.intRange(0, Math.floor(px.height * 0.55));
    const a = 0.2 + rng.next() * 0.7;
    px.pixel(x, y, 0xffffff, a);
  }
};

const drawMoon = (px: PixelCanvas, x: number, y: number, r: number): void => {
  for (let dx = -r; dx <= r; dx++) {
    for (let dy = -r; dy <= r; dy++) {
      const d = dx * dx + dy * dy;
      if (d <= r * r) {
        const t = (dx + dy) / (2 * r);
        const c = mixColor(0xfff7d0, 0xc9b07a, Math.max(0, t));
        px.pixel(x + dx, y + dy, c);
      }
    }
  }
  // halo
  for (let dx = -r * 2; dx <= r * 2; dx++) {
    for (let dy = -r * 2; dy <= r * 2; dy++) {
      const d = dx * dx + dy * dy;
      if (d > r * r && d <= (r * 2) * (r * 2)) {
        px.pixel(x + dx, y + dy, 0xfff7d0, 0.04);
      }
    }
  }
};

const drawRidge = (
  px: PixelCanvas,
  baseY: number,
  amplitude: number,
  color: number,
  rng: Rng
): void => {
  // Sample a noisy ridge across the width.
  const points: number[] = [];
  for (let x = 0; x < px.width; x++) {
    const noise =
      Math.sin(x * 0.013 + rng.intRange(0, 100)) * amplitude * 0.5 +
      Math.sin(x * 0.05 + rng.intRange(0, 100)) * amplitude * 0.25 +
      Math.sin(x * 0.1 + rng.intRange(0, 100)) * amplitude * 0.15;
    points.push(baseY - amplitude / 2 + noise);
  }
  for (let x = 0; x < px.width; x++) {
    const yTop = Math.max(0, Math.floor(points[x]!));
    for (let y = yTop; y < px.height; y++) {
      // shade by depth from ridge top
      const depth = y - yTop;
      const c = darkenColor(color, Math.min(0.5, depth / 90));
      px.pixel(x, y, c);
    }
    // crisp top highlight
    px.pixel(x, yTop, lightenColor(color, 0.2));
  }
};

const drawGround = (px: PixelCanvas, baseY: number, color: number, rng: Rng): void => {
  for (let y = baseY; y < px.height; y++) {
    const t = (y - baseY) / (px.height - baseY);
    const c = mixColor(color, 0x0a0a0a, t * 0.85);
    px.ctx.fillStyle = `rgb(${(c >> 16) & 0xff},${(c >> 8) & 0xff},${c & 0xff})`;
    px.ctx.fillRect(0, y, px.width, 1);
  }
  // grass/blades
  for (let i = 0; i < 200; i++) {
    const x = rng.intRange(0, px.width);
    const y = rng.intRange(baseY + 4, px.height - 4);
    px.pixel(x, y, lightenColor(color, 0.15), 0.4);
  }
};

const drawFog = (px: PixelCanvas, baseY: number, rng: Rng): void => {
  for (let i = 0; i < 12; i++) {
    const cx = rng.intRange(0, px.width);
    const cy = baseY + rng.intRange(-30, 30);
    const w = rng.intRange(180, 420);
    const h = rng.intRange(20, 40);
    px.ctx.fillStyle = "rgba(255,255,255,0.06)";
    px.ctx.beginPath();
    px.ctx.ellipse(cx, cy, w / 2, h / 2, 0, 0, Math.PI * 2);
    px.ctx.fill();
  }
};

const drawFireGlow = (px: PixelCanvas): void => {
  // soft warm glow at the bottom-center implying torchlight / siege fire
  const grad = px.ctx.createRadialGradient(
    px.width / 2,
    px.height,
    0,
    px.width / 2,
    px.height,
    Math.max(px.width, px.height) * 0.6
  );
  grad.addColorStop(0, "rgba(255,140,40,0.35)");
  grad.addColorStop(0.5, "rgba(255,80,30,0.10)");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  px.ctx.fillStyle = grad;
  px.ctx.fillRect(0, 0, px.width, px.height);
};

export const ensureBackdropTexture = (
  scene: Phaser.Scene,
  key: string,
  spec: MountainSpec,
  manifestId?: string  // optional: e.g. "backdrop:palaceCoup" — uses real PNG if loaded
): string => {
  if (manifestId && scene.textures.exists(manifestId)) return manifestId;
  if (scene.textures.exists(key)) return key;
  const w = GAME_WIDTH;
  const h = GAME_HEIGHT;
  const px = new PixelCanvas(w, h);
  const rng = new Rng(spec.seed);
  drawSky(px, spec.sky, spec.glow ?? spec.sky);
  if (spec.hasMoon) drawStars(px, rng);
  if (spec.hasMoon) drawMoon(px, w - 180, 110, 26);
  // ridges back to front
  const ridges = spec.ridges ?? 3;
  const colors = [spec.far, spec.mid, spec.near];
  for (let i = 0; i < ridges; i++) {
    const t = i / Math.max(1, ridges - 1);
    const baseY = Math.floor(h * (0.40 + 0.20 * t));
    const amp = Math.floor(60 + 60 * (1 - t));
    const c = colors[Math.min(i, colors.length - 1)] ?? spec.near;
    drawRidge(px, baseY, amp, c, rng);
  }
  drawGround(px, Math.floor(h * 0.78), spec.ground, rng);
  if (spec.hasFog) drawFog(px, Math.floor(h * 0.65), rng);
  if (spec.hasFire) drawFireGlow(px);
  // gentle vignette
  const grad = px.ctx.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, h * 0.85);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.55)");
  px.ctx.fillStyle = grad;
  px.ctx.fillRect(0, 0, w, h);
  scene.textures.addCanvas(key, px.canvas);
  return key;
};

export const BACKDROPS = {
  palaceCoup: {
    sky: 0x14091a,
    glow: 0x6a1a2c,
    far: 0x261820,
    mid: 0x140a14,
    near: 0x070306,
    ground: 0x1c0c10,
    seed: 1010,
    hasFire: true,
    hasFog: true,
    ridges: 3
  },
  thuling: {
    sky: 0x2c4a6c,
    glow: 0xefb56a,
    far: 0x344e6a,
    mid: 0x1f3550,
    near: 0x0d1b2a,
    ground: 0x4a3a22,
    seed: 2222,
    hasFog: true,
    ridges: 3
  },
  farmland: {
    sky: 0xc46a3e,
    glow: 0xf2c87a,
    far: 0x5a3320,
    mid: 0x3a2417,
    near: 0x261810,
    ground: 0x3a4a22,
    seed: 3030,
    hasFog: false,
    ridges: 3
  },
  mountain: {
    sky: 0x1a233a,
    glow: 0x7090c4,
    far: 0x2a3656,
    mid: 0x18213a,
    near: 0x0c1424,
    ground: 0x2a3a52,
    seed: 4040,
    hasMoon: true,
    hasFog: true,
    hasSnow: true,
    ridges: 3
  },
  swamp: {
    sky: 0x1a2924,
    glow: 0x68b88a,
    far: 0x18302a,
    mid: 0x0e2220,
    near: 0x081816,
    ground: 0x162622,
    seed: 5050,
    hasFog: true,
    ridges: 3
  },
  caravan: {
    sky: 0x4d3a26,
    glow: 0xefa45a,
    far: 0x4a2a18,
    mid: 0x32180e,
    near: 0x1c0e08,
    ground: 0x3a2a18,
    seed: 6060,
    ridges: 3
  },
  monastery: {
    sky: 0x1c1828,
    glow: 0x9a8a5a,
    far: 0x2a2440,
    mid: 0x16122a,
    near: 0x0a0814,
    ground: 0x222030,
    seed: 7070,
    hasFog: true,
    ridges: 3
  },
  orinhal: {
    sky: 0x2a1a14,
    glow: 0xc97a4a,
    far: 0x4a2a1a,
    mid: 0x2a1a12,
    near: 0x140c0a,
    ground: 0x2a1a14,
    seed: 8080,
    hasFire: true,
    ridges: 3
  },
  cliffs: {
    sky: 0x1a283c,
    glow: 0x4d6a8a,
    far: 0x223345,
    mid: 0x12222e,
    near: 0x06121c,
    ground: 0x1c2832,
    seed: 9090,
    hasFog: true,
    ridges: 3
  },
  grude: {
    sky: 0x141a32,
    glow: 0x6a92c4,
    far: 0x223256,
    mid: 0x12203c,
    near: 0x070d20,
    ground: 0x1a2236,
    seed: 11000,
    hasMoon: true,
    ridges: 3
  },
  // Interior / intimate backdrops used by story arcs. The procedural specs
  // here are fallbacks only — real PNGs at public/assets/backdrops/<id>.png
  // override them via the manifest. Outdoor parallax doesn't really suit
  // interiors, so the fallback colors aim for a tonal match more than realism.
  factory: {
    sky: 0x2a1a14,
    glow: 0xefa45a,
    far: 0x1a1410,
    mid: 0x0e0a08,
    near: 0x050402,
    ground: 0x1c1410,
    seed: 13100,
    hasFire: true,
    hasFog: true,
    ridges: 2
  },
  field_night_camp: {
    sky: 0x0a1426,
    glow: 0xefa45a,
    far: 0x122036,
    mid: 0x0a1422,
    near: 0x040810,
    ground: 0x182214,
    seed: 13200,
    hasMoon: true,
    hasFire: true,
    ridges: 2
  },
  rusty_house: {
    sky: 0x2a1a10,
    glow: 0xc88a52,
    far: 0x231510,
    mid: 0x180e0a,
    near: 0x0a0604,
    ground: 0x1a1008,
    seed: 13300,
    ridges: 2
  },
  study: {
    sky: 0x141022,
    glow: 0x9c8a52,
    far: 0x18142a,
    mid: 0x100c1c,
    near: 0x080612,
    ground: 0x140e1c,
    seed: 13400,
    ridges: 2
  },
  tavern: {
    sky: 0x2c1a10,
    glow: 0xefb56a,
    far: 0x241510,
    mid: 0x180e08,
    near: 0x0a0604,
    ground: 0x1c1208,
    seed: 13500,
    hasFire: true,
    ridges: 2
  },
  finalBoss: {
    sky: 0x18000c,
    glow: 0xff2030,
    far: 0x2c0815,
    mid: 0x14040b,
    near: 0x070103,
    ground: 0x1a060b,
    seed: 12000,
    hasFire: true,
    hasFog: true,
    ridges: 4
  }
};
