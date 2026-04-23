import Phaser from "phaser";
import { PixelCanvas, darkenColor, lightenColor } from "./PixelCanvas";
import { Rng } from "../util/rng";

// 64×72 portraits: head + shoulders, painted in pixel-style with rim light for the "3D feel".

interface PortraitInput {
  id: string;
  primary: number;
  secondary: number;
  accent: number;
  skin: number;
  hair: number;
  hairStyle?: "short" | "long" | "tied" | "bald" | "hooded";
  beard?: boolean;
  scar?: boolean;
  artSeed: number;
}

const PW = 64;
const PH = 72;

const drawPortrait = (px: PixelCanvas, p: PortraitInput): void => {
  const rng = new Rng(p.artSeed * 31 + 17);
  // Backdrop: vertical gradient from secondary → black, with a soft vignette.
  for (let y = 0; y < PH; y++) {
    const t = y / PH;
    const c = lightenColor(0x000000, 0.0);
    const r = ((p.secondary >> 16) & 0xff) * (0.4 - t * 0.3);
    const g = ((p.secondary >> 8) & 0xff) * (0.4 - t * 0.3);
    const b = (p.secondary & 0xff) * (0.4 - t * 0.3);
    px.ctx.fillStyle = `rgb(${Math.max(0, r) | 0},${Math.max(0, g) | 0},${Math.max(0, b) | 0})`;
    px.ctx.fillRect(0, y, PW, 1);
  }

  // Shoulders / collar
  px.fillRect(8, PH - 18, PW - 16, 18, p.primary);
  px.fillRect(8, PH - 18, PW - 16, 1, lightenColor(p.primary, 0.25));
  // collar trim
  px.fillRect(20, PH - 18, PW - 40, 3, p.accent);
  // chest accent
  px.fillRect(PW / 2 - 1, PH - 14, 2, 6, darkenColor(p.accent, 0.2));

  // Neck
  const neckY = PH - 24;
  for (let y = neckY; y < PH - 18; y++) {
    for (let x = PW / 2 - 5; x < PW / 2 + 5; x++) {
      px.pixel(x, y, p.skin);
    }
  }
  px.fillRect(PW / 2 - 5, neckY, 10, 1, darkenColor(p.skin, 0.25));

  // Head: rounded rectangle, 22 wide × 26 tall
  const hx0 = PW / 2 - 11;
  const hy0 = 14;
  for (let y = 0; y < 26; y++) {
    for (let x = 0; x < 22; x++) {
      const cx = x - 10.5;
      const cy = y - 12;
      const dist = Math.sqrt(cx * cx * 1.4 + cy * cy);
      if (dist < 12) {
        px.pixel(hx0 + x, hy0 + y, p.skin);
      }
    }
  }
  // jaw shadow
  for (let x = 0; x < 22; x++) {
    px.pixel(hx0 + x, hy0 + 22, darkenColor(p.skin, 0.18));
  }
  // cheek shadow on left
  for (let y = 8; y < 18; y++) {
    px.pixel(hx0 + 1, hy0 + y, darkenColor(p.skin, 0.20));
  }
  // rim light right
  for (let y = 4; y < 22; y++) {
    px.pixel(hx0 + 20, hy0 + y, lightenColor(p.skin, 0.25));
  }

  // Hair
  if (p.hairStyle === "hooded") {
    // hooded silhouette over head
    for (let y = 4; y < 30; y++) {
      const halfW = 14 - Math.max(0, y - 18);
      for (let dx = -halfW; dx < halfW; dx++) {
        px.pixel(PW / 2 + dx, hy0 - 4 + y, p.hair);
      }
    }
    // shadow under hood
    for (let y = 0; y < 4; y++) {
      for (let x = 0; x < 22; x++) px.pixel(hx0 + x, hy0 + 6 + y, darkenColor(p.skin, 0.5));
    }
  } else {
    // hairline
    for (let x = -1; x < 23; x++) {
      px.pixel(hx0 + x, hy0 + 4, p.hair);
      px.pixel(hx0 + x, hy0 + 5, p.hair);
    }
    for (let y = 6; y < 10; y++) {
      px.pixel(hx0 - 1, hy0 + y, p.hair);
      px.pixel(hx0 + 22, hy0 + y, p.hair);
    }
    if (p.hairStyle === "long") {
      for (let y = 10; y < 24; y++) {
        px.pixel(hx0 - 1, hy0 + y, p.hair);
        px.pixel(hx0 + 22, hy0 + y, p.hair);
      }
    }
    if (p.hairStyle === "tied") {
      // ponytail tail
      for (let y = 10; y < 18; y++) {
        px.pixel(hx0 + 23, hy0 + y, p.hair);
        px.pixel(hx0 + 24, hy0 + y, p.hair);
      }
    }
  }

  // Eyes
  const eyeY = hy0 + 12;
  px.fillRect(hx0 + 6, eyeY, 3, 2, 0xfafafa);
  px.fillRect(hx0 + 13, eyeY, 3, 2, 0xfafafa);
  px.pixel(hx0 + 7, eyeY + 1, 0x121620);
  px.pixel(hx0 + 14, eyeY + 1, 0x121620);
  // eyebrows
  px.fillRect(hx0 + 6, eyeY - 2, 4, 1, p.hair);
  px.fillRect(hx0 + 13, eyeY - 2, 4, 1, p.hair);
  // nose
  px.pixel(hx0 + 11, eyeY + 4, darkenColor(p.skin, 0.25));
  px.pixel(hx0 + 11, eyeY + 5, darkenColor(p.skin, 0.20));
  // mouth
  px.fillRect(hx0 + 9, eyeY + 8, 4, 1, darkenColor(p.skin, 0.45));

  if (p.scar) {
    for (let i = 0; i < 4; i++) px.pixel(hx0 + 17, eyeY - 1 + i, 0xb24a3a);
  }
  if (p.beard) {
    for (let y = eyeY + 9; y < eyeY + 14; y++) {
      for (let x = hx0 + 6; x < hx0 + 16; x++) {
        if (rng.next() < 0.6) px.pixel(x, y, p.hair);
      }
    }
  }

  // Highlight on hair
  for (let i = 0; i < 4; i++) {
    px.pixel(hx0 + 8 + i, hy0 + 5, lightenColor(p.hair, 0.3));
  }

  // Border frame
  for (let x = 0; x < PW; x++) {
    px.pixel(x, 0, p.accent);
    px.pixel(x, PH - 1, p.accent);
  }
  for (let y = 0; y < PH; y++) {
    px.pixel(0, y, p.accent);
    px.pixel(PW - 1, y, p.accent);
  }
};

export const ensurePortraitTexture = (
  scene: Phaser.Scene,
  p: PortraitInput,
  expression?: string
): string => {
  // Prefer the expression variant if it loaded, then the default real portrait,
  // then fall back to the procedural canvas.
  if (expression) {
    const exprKey = `portrait:${p.id}:${expression}`;
    if (scene.textures.exists(exprKey)) return exprKey;
  }

  const realKey = `portrait:${p.id}`;
  if (scene.textures.exists(realKey)) return realKey;

  const key = `portrait-${p.id}`;
  if (scene.textures.exists(key)) return key;
  const px = new PixelCanvas(PW, PH);
  drawPortrait(px, p);
  scene.textures.addCanvas(key, px.canvas);
  return key;
};

export const PORTRAIT_W = PW;
export const PORTRAIT_H = PH;
