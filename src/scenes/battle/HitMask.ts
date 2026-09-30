import type Phaser from "phaser";

// Pixel-accurate hit testing for unit billboards.
//
// A unit sheet frame is 32×40 with the figure standing in the middle of it:
// a third of the frame above the head, and a figure only 13–20 px wide.
// Testing the frame's rectangle (as picking did) let the transparent air
// around a figure claim the pointer — on the tilted board, exactly the air
// in front of the unit standing behind it.
//
// The mask of each frame is read back once and cached: which pixels are
// solid, the same grown by a couple of pixels (so a thin spear or a narrow
// waist is still easy to point at), and the centre of the figure's body.

export interface HitMask {
  w: number;
  h: number;
  /** 1 where the figure is solid. */
  solid: Uint8Array;
  /** `solid` grown by GROW px: forgiving to aim at. */
  near: Uint8Array;
  /** The body's centre in frame px (the centroid of the solid pixels). */
  cx: number;
  cy: number;
}

/** How far (frame px) a pointer may miss the figure and still hit it. */
const GROW = 2;

const cache = new Map<string, HitMask | null>();

const build = (frame: Phaser.Textures.Frame): HitMask | null => {
  const w = Math.round(frame.cutWidth), h = Math.round(frame.cutHeight);
  if (!w || !h) return null;
  const src = frame.source.image as CanvasImageSource | undefined;
  if (!src) return null;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const ctx = cv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(src, frame.cutX, frame.cutY, w, h, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const solid = new Uint8Array(w * h);
  let sx = 0, sy = 0, n = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3]! >= 64) {
        solid[y * w + x] = 1;
        sx += x; sy += y; n++;
      }
    }
  }
  if (n === 0) return null;
  const near = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!solid[y * w + x]) continue;
      for (let dy = -GROW; dy <= GROW; dy++) {
        for (let dx = -GROW; dx <= GROW; dx++) {
          if (dx * dx + dy * dy > GROW * GROW + 1) continue;
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && ny >= 0 && nx < w && ny < h) near[ny * w + nx] = 1;
        }
      }
    }
  }
  return { w, h, solid, near, cx: sx / n + 0.5, cy: sy / n + 0.5 };
};

/** The mask of a sprite's current frame (null if it can't be read). */
export const hitMaskOf = (s: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image): HitMask | null => {
  const key = `${s.texture.key}#${s.frame.name}`;
  if (cache.has(key)) return cache.get(key)!;
  let m: HitMask | null = null;
  try {
    m = build(s.frame);
  } catch {
    // A tainted canvas can't be read back; callers fall back to the box.
    m = null;
  }
  cache.set(key, m);
  return m;
};

/** A world point in a sprite's frame px, undoing its origin, scale, flip and turn. */
const toFrame = (s: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, m: HitMask, wx: number, wy: number) => {
  let dx = wx - s.x, dy = wy - s.y;
  if (s.rotation) {
    const c = Math.cos(-s.rotation), n = Math.sin(-s.rotation);
    [dx, dy] = [dx * c - dy * n, dx * n + dy * c];
  }
  let u = (dx / s.displayWidth + s.originX) * m.w;
  const v = (dy / s.displayHeight + s.originY) * m.h;
  if (s.flipX) u = m.w - u;
  return { u, v };
};

/** The world position of a sprite's body centre. */
export const bodyCentre = (s: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image): { x: number; y: number } => {
  const m = hitMaskOf(s);
  if (!m) return { x: s.x, y: s.y };
  const u = s.flipX ? m.w - m.cx : m.cx;
  return {
    x: s.x + (u / m.w - s.originX) * s.displayWidth,
    y: s.y + (m.cy / m.h - s.originY) * s.displayHeight
  };
};

/**
 * Whether a world point is on a sprite's figure. `forgiving` uses the
 * grown mask (for aiming); otherwise only solid pixels count (for "is it
 * covered"). Falls back to an inset box when the mask can't be read.
 */
export const figureAt = (
  s: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  wx: number,
  wy: number,
  forgiving: boolean
): boolean => {
  const m = hitMaskOf(s);
  if (!m) {
    const hw = s.displayWidth / 2 - 8, hh = s.displayHeight / 2;
    return wx >= s.x - hw && wx <= s.x + hw && wy >= s.y - hh + 6 && wy <= s.y + hh;
  }
  const { u, v } = toFrame(s, m, wx, wy);
  const x = Math.floor(u), y = Math.floor(v);
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return false;
  return (forgiving ? m.near : m.solid)[y * m.w + x] === 1;
};
