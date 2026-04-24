import Phaser from "phaser";
import type { Unit } from "../combat/types";
import { animKey, hasUnitAnimation } from "./animations";
import type { UnitAnimState } from "./manifest";

// Plays a state animation on a unit sprite.
// - If a real spritesheet exists for this class+state, plays it via Phaser anims.
// - Otherwise applies a tween that approximates the state (idle bob, attack lunge, etc.)
//   so static procedural sprites still feel alive.

interface IdleTween {
  tween?: Phaser.Tweens.Tween;
}

const idleTweens = new WeakMap<Phaser.GameObjects.Sprite, IdleTween>();

const stopIdleFallback = (sprite: Phaser.GameObjects.Sprite): void => {
  const t = idleTweens.get(sprite);
  if (t?.tween) {
    t.tween.stop();
    t.tween = undefined;
  }
  // The walk fallback wobbles `angle`; reset it so the next state starts clean.
  sprite.angle = 0;
};

export const playUnitState = (
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  unit: Unit,
  state: UnitAnimState
): void => {
  if (hasUnitAnimation(unit.classKind, state)) {
    stopIdleFallback(sprite);
    sprite.play(animKey(unit.classKind, state), true);
    return;
  }

  // Procedural fallback. Stop any previous fallback tween first.
  stopIdleFallback(sprite);

  switch (state) {
    case "idle": {
      // Gentle 2-frame breathing: subtle Y bob + scale pulse.
      const baseY = sprite.y;
      const tween = scene.tweens.add({
        targets: sprite,
        y: baseY - 1.5,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
      idleTweens.set(sprite, { tween });
      break;
    }
    case "walk": {
      // Tilt-wobble while moving. We CANNOT tween `y` here — animateMove owns
      // sprite.x/sprite.y and a competing y-tween causes the sprite to flicker
      // back-and-forth between the bob target and the per-step move target.
      sprite.angle = 0;
      const tween = scene.tweens.add({
        targets: sprite,
        angle: 4,
        duration: 130,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
      idleTweens.set(sprite, { tween });
      break;
    }
    case "attack":
      // The lunge tween is owned by BattleScene.lunge() — nothing to do here.
      break;
    case "hit":
      // Flash handled at the call site.
      break;
    case "death":
      // Fade handled at the call site.
      break;
  }
};

// Reset to idle and clear any pending tweens. Useful after death cleanup or
// when a turn ends.
export const resetToIdle = (
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  unit: Unit
): void => {
  playUnitState(scene, sprite, unit, "idle");
};
