import Phaser from "phaser";
import { BESPOKE_SPRITES, type SpriteClass } from "../combat/types";
import { ASSET_SPEC, hasAsset, type UnitAnimState } from "./manifest";

// Phaser-side animation registry. Once spritesheets are loaded by BootScene,
// we create animations from them — one per (class, state) combination — so
// any Sprite can do `sprite.play(animKey(class, "attack"))` without thinking
// about frame counts or rates.

interface AnimSpec {
  frameRate: number;
  repeat: number; // -1 for loop, 0 for one-shot
}

const ANIM_SPECS: Record<UnitAnimState, AnimSpec> = {
  idle:   { frameRate: 2,  repeat: -1 },
  walk:   { frameRate: 8,  repeat: -1 },
  // 11fps puts the third (impact) frame on screen from ~180ms to ~270ms:
  // across the moment a melee lunge connects (~250ms) and the moment the
  // bow and lens release (BattleScene.lunge waits for it).
  attack: { frameRate: 11, repeat: 0 },
  hit:    { frameRate: 12, repeat: 0 },
  death:  { frameRate: 6,  repeat: 0 }
};

export const animKey = (cls: SpriteClass, state: UnitAnimState): string =>
  `anim:${cls}:${state}`;

export const textureKey = (cls: SpriteClass, state: UnitAnimState): string =>
  `unit:${cls}:${state}`;

// Returns true if real animation art exists for this class+state combo.
export const hasUnitAnimation = (cls: SpriteClass, state: UnitAnimState): boolean =>
  hasAsset(textureKey(cls, state));

const STATES: UnitAnimState[] = ["idle", "walk", "attack", "hit", "death"];

// Idempotent (existing anim keys skip; missing textures skip) — safe to
// re-call as background-streamed sheets arrive. The class list mirrors
// the manifest's CLASSES so newly shipped folders (lenscaster, knight's
// Tier 2s, ...) get animations without touching this file again.
export const registerUnitAnimations = (scene: Phaser.Scene): void => {
  const anims = scene.anims;
  const classes: SpriteClass[] = [
    "swordsman", "spearton", "knight", "archer",
    "shinobi", "sentinel", "dactyl_rider", "swordmaster", "boss",
    "lenscaster", "khan", "prismarch", "spearton_lord",
    "robinhelm", "dactyl_king", "shinobi_master", "guardian",
    ...BESPOKE_SPRITES
  ];

  for (const cls of classes) {
    for (const state of STATES) {
      const tex = textureKey(cls, state);
      const ak = animKey(cls, state);
      if (anims.exists(ak)) continue;
      if (!scene.textures.exists(tex)) continue;
      const frameCount = ASSET_SPEC.unitAnim.frames[state];
      const spec = ANIM_SPECS[state];
      anims.create({
        key: ak,
        frames: anims.generateFrameNumbers(tex, { start: 0, end: frameCount - 1 }),
        frameRate: spec.frameRate,
        repeat: spec.repeat
      });
    }
  }
};
