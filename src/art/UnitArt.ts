import Phaser from "phaser";
import { PixelCanvas, darkenColor, lightenColor } from "./PixelCanvas";
import { Rng } from "../util/rng";
import type { ClassKind, Unit, WeaponKind } from "../combat/types";
import { TILE_SIZE } from "../util/constants";

// Sprite is drawn at 32×40 then composited at TILE_SIZE-aligned width.
const SW = 32;
const SH = 40;

interface Pal {
  primary: number;
  secondary: number;
  accent: number;
  skin: number;
  hair: number;
}

const defaultPalette = (u: Unit): Pal => {
  if (u.faction === "player") {
    return {
      primary: u.palette?.primary ?? 0x3a7bcb,
      secondary: u.palette?.secondary ?? 0x1a4078,
      accent: u.palette?.accent ?? 0xf2d34a,
      skin: 0xc69372,
      hair: 0x1b1610
    };
  }
  return {
    primary: u.palette?.primary ?? 0x6c2727,
    secondary: u.palette?.secondary ?? 0x371414,
    accent: u.palette?.accent ?? 0xb89a3a,
    skin: 0xa6856a,
    hair: 0x271916
  };
};

// Body: head, torso, legs, with shading.
const drawBody = (px: PixelCanvas, p: Pal, rng: Rng): void => {
  const cx = SW / 2;
  // shadow under feet
  px.ctx.fillStyle = "rgba(0,0,0,0.35)";
  px.ctx.beginPath();
  px.ctx.ellipse(cx, SH - 3, 8, 2, 0, 0, Math.PI * 2);
  px.ctx.fill();

  // Legs
  for (let y = SH - 9; y < SH - 3; y++) {
    for (let x = -3; x <= -1; x++) px.pixel(cx + x, y, p.secondary);
    for (let x = 1; x <= 3; x++) px.pixel(cx + x, y, p.secondary);
  }
  // boot tips
  px.fillRect(cx - 4, SH - 4, 4, 1, darkenColor(p.secondary, 0.4));
  px.fillRect(cx, SH - 4, 4, 1, darkenColor(p.secondary, 0.4));

  // Torso (8 wide × 10 tall)
  for (let y = SH - 19; y < SH - 9; y++) {
    for (let x = -4; x <= 3; x++) {
      const c =
        x === -4 || x === 3 ? darkenColor(p.primary, 0.3) :
        x === -3 ? lightenColor(p.primary, 0.1) :
        p.primary;
      px.pixel(cx + x, y, c);
    }
  }
  // belt
  px.fillRect(cx - 4, SH - 11, 8, 1, p.secondary);
  // chest accent
  px.fillRect(cx - 1, SH - 17, 2, 4, p.accent);

  // Arms (small stubs at sides)
  for (let y = SH - 18; y < SH - 12; y++) {
    px.pixel(cx - 5, y, p.primary);
    px.pixel(cx + 4, y, p.primary);
  }

  // Head (8x8)
  const headTop = SH - 28;
  for (let y = headTop; y < headTop + 8; y++) {
    for (let x = -3; x <= 2; x++) {
      const c =
        x === -3 ? darkenColor(p.skin, 0.2) :
        x === 2 ? darkenColor(p.skin, 0.15) :
        p.skin;
      px.pixel(cx + x, y, c);
    }
  }
  // hair
  for (let y = headTop; y < headTop + 3; y++) {
    for (let x = -3; x <= 2; x++) {
      px.pixel(cx + x, y, p.hair);
    }
  }
  // eye
  px.pixel(cx - 2, headTop + 4, 0x100808);
  px.pixel(cx + 1, headTop + 4, 0x100808);
  // mouth
  px.pixel(cx - 1, headTop + 6, darkenColor(p.skin, 0.5));
  // chin shadow
  px.pixel(cx - 1, headTop + 7, darkenColor(p.skin, 0.3));
  px.pixel(cx, headTop + 7, darkenColor(p.skin, 0.3));

  // tiny variation noise
  for (let i = 0; i < 6; i++) {
    const x = rng.intRange(cx - 4, cx + 4);
    const y = rng.intRange(SH - 18, SH - 4);
    if (rng.next() < 0.5) {
      px.shadePixel(x, y, 0.92);
    } else {
      px.shadePixel(x, y, 1.08);
    }
  }
};

// Class-specific weapon / accessory.
const drawWeapon = (px: PixelCanvas, kind: ClassKind, weapon: WeaponKind, p: Pal): void => {
  const cx = SW / 2;
  if (weapon === "sword") {
    // sword on right
    const x = cx + 6;
    const yTop = SH - 28;
    for (let y = yTop; y < SH - 12; y++) px.pixel(x, y, 0xd6d6d6);
    px.pixel(x - 1, SH - 13, 0x666666);
    px.pixel(x + 1, SH - 13, 0x666666);
    px.fillRect(x - 1, SH - 12, 3, 2, p.accent); // pommel
    px.pixel(x, yTop - 1, 0xfff7c4); // gleam
  } else if (weapon === "spear") {
    const x = cx + 7;
    for (let y = SH - 30; y < SH - 4; y++) px.pixel(x, y, 0x6f4e2c);
    // tip
    px.pixel(x, SH - 32, 0xefefef);
    px.pixel(x - 1, SH - 31, 0xefefef);
    px.pixel(x + 1, SH - 31, 0xefefef);
    px.pixel(x, SH - 30, 0xefefef);
  } else if (weapon === "bow") {
    const x = cx + 6;
    for (let y = SH - 26; y < SH - 14; y++) {
      px.pixel(x, y, 0x4a2f17);
      if (y === SH - 26 || y === SH - 15) px.pixel(x + 1, y, 0x4a2f17);
    }
    // string
    for (let y = SH - 25; y < SH - 15; y++) px.pixel(x - 1, y, 0xb6b6b6);
  } else if (weapon === "dactyl") {
    // dactyl wing behind
    const wingC = darkenColor(p.primary, 0.15);
    for (let y = SH - 22; y < SH - 14; y++) {
      for (let x = -7; x < -3; x++) px.pixel(cx + x, y, wingC);
    }
    px.fillRect(cx - 7, SH - 14, 4, 1, darkenColor(wingC, 0.3));
  } else if (weapon === "shield") {
    // shield on left
    const x = cx - 7;
    for (let y = SH - 22; y < SH - 11; y++) {
      for (let dx = 0; dx < 3; dx++) px.pixel(x + dx, y, p.primary);
    }
    px.fillRect(x, SH - 22, 3, 1, p.accent);
  }

  // Class flair
  if (kind === "knight") {
    // helmet plume
    for (let y = SH - 31; y < SH - 27; y++) px.pixel(cx, y, p.accent);
  }
  if (kind === "shinobi") {
    // mask
    for (let y = SH - 24; y < SH - 22; y++) {
      for (let x = -3; x <= 2; x++) px.pixel(cx + x, y, 0x1c1c1c);
    }
  }
  if (kind === "boss") {
    // crown
    px.pixel(cx - 2, SH - 29, p.accent);
    px.pixel(cx, SH - 30, p.accent);
    px.pixel(cx + 2, SH - 29, p.accent);
    px.fillRect(cx - 3, SH - 28, 6, 1, p.accent);
  }
};

const unitTexKey = (u: Unit): string => `unit-${u.id}`;

// Tracks (id, effectiveClass) pairs we've already warned about, so the
// fallback log doesn't fire on every camera redraw.
const warnedFallback = new Set<string>();

export const ensureUnitTexture = (scene: Phaser.Scene, u: Unit): string => {
  // The sprite class can be overridden separately from the mechanical
  // classKind — this lets a unit get its class's mechanics (e.g., knight
  // gets +2 mountBonus from Actions.ts) while rendering with another
  // class's sprites until proper assets ship for theirs.
  const spriteClass = u.spriteClassOverride ?? u.classKind;

  // If a real idle spritesheet exists for that class, prefer it. The first
  // frame becomes the static texture used by code paths that don't animate.
  const realKey = `unit:${spriteClass}:idle`;
  if (scene.textures.exists(realKey)) return realKey;

  // No real sprite — falling back to the procedural pixel-art generator.
  // This is a permanent feature (procedural is the default for unfinished
  // classes), but in DEV we surface it once so missing-sprite mistakes
  // like "Kian shipped as a class with no sprite folder" don't reach the
  // player as "LOL crappy sprite". Set spriteClassOverride on the UnitDef
  // (or ship sprites for the class) to silence the warning.
  if (import.meta.env.DEV) {
    const tag = `${u.id}:${spriteClass}`;
    if (!warnedFallback.has(tag)) {
      warnedFallback.add(tag);
      console.warn(
        `[UnitArt] No sprite for class "${spriteClass}" — unit "${u.id}" (${u.name}) ` +
        `is using the procedural fallback. Add a spriteClassOverride on the UnitDef ` +
        `or drop assets at public/assets/sprites/${spriteClass}/idle.png.`
      );
    }
  }

  const key = unitTexKey(u);
  if (scene.textures.exists(key)) return key;
  const px = new PixelCanvas(SW, SH);
  const rng = new Rng(u.artSeed);
  const p = defaultPalette(u);
  drawBody(px, p, rng);
  drawWeapon(px, u.classKind, u.weapon, p);
  scene.textures.addCanvas(key, px.canvas);
  return key;
};

export const UNIT_SPRITE_W = SW;
export const UNIT_SPRITE_H = SH;

// Compute the on-screen pixel position for a tile (top-left origin), used everywhere.
export const tileToPixel = (
  tile: { x: number; y: number },
  originX: number,
  originY: number
): { x: number; y: number } => ({
  x: originX + tile.x * TILE_SIZE + TILE_SIZE / 2,
  y: originY + tile.y * TILE_SIZE + TILE_SIZE / 2
});
