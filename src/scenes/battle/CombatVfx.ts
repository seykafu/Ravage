// Combat VFX — procedural, code-drawn attack effects. No image assets.
//
// Three effects, all spawned into WORLD space (callers pass BattleScene's
// addWorld so nothing double-renders on the UI camera):
//   * fireArrow — a projectile that actually flies for bow attacks,
//     with a shallow arc and velocity-following rotation. Returns a
//     promise that resolves on impact so the caller can sequence damage
//     application to the moment the arrow lands.
//   * slashArc  — a crescent sweep at the impact point for melee hits,
//     rotated to the attack direction. Gold + larger on crits.
//   * hitSpark  — a radial burst of short lines at the impact point.
//   * missWhiff — a soft air-puff past the defender when a swing misses.
//
// Follows the RavageVfx extraction pattern: pure top-level functions,
// scene passed in, no state held across calls.

import Phaser from "phaser";

type WorldTag = <T extends Phaser.GameObjects.GameObject>(obj: T) => T;

// Depths: units sit in the low tens; damage floaters at 45. VFX slots
// between — above sprites, below the numbers.
const DEPTH_ARROW = 36;
const DEPTH_IMPACT = 38;

// Build the arrow texture once per scene: a fletched shaft with a bright
// head, drawn pointing +x so rotation math is just the flight angle.
const ARROW_KEY = "vfx_arrow_proc";
const ensureArrowTexture = (scene: Phaser.Scene): string => {
  if (scene.textures.exists(ARROW_KEY)) return ARROW_KEY;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  // Shaft
  g.lineStyle(2, 0x8a6b45, 1);
  g.beginPath();
  g.moveTo(2, 3);
  g.lineTo(20, 3);
  g.strokePath();
  // Head
  g.fillStyle(0xdde3ec, 1);
  g.fillTriangle(20, 0.5, 20, 5.5, 26, 3);
  // Fletching
  g.fillStyle(0xb0563f, 1);
  g.fillTriangle(2, 3, 6, 0, 6, 3);
  g.fillTriangle(2, 3, 6, 6, 6, 3);
  g.generateTexture(ARROW_KEY, 26, 6);
  g.destroy();
  return ARROW_KEY;
};

// Fly an arrow from (fromX, fromY) to (toX, toY) with a shallow arc.
// Resolves when it lands. Flight time scales with distance so close
// shots snap and long shots visibly travel.
export const fireArrow = (
  scene: Phaser.Scene,
  world: WorldTag,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): Promise<void> => {
  const key = ensureArrowTexture(scene);
  const dist = Math.hypot(toX - fromX, toY - fromY);
  const duration = Phaser.Math.Clamp(dist * 0.9, 160, 340);
  const arcPeak = Math.min(26, dist * 0.16);
  const arrow = world(scene.add.image(fromX, fromY, key));
  arrow.setDepth(DEPTH_ARROW);
  return new Promise((res) => {
    let lastX = fromX;
    let lastY = fromY;
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration,
      ease: "Sine.easeOut",
      onUpdate: (tw) => {
        const f = tw.getValue() ?? 0;
        const x = fromX + (toX - fromX) * f;
        // Parabolic arc: peaks mid-flight, lands back on the target line.
        const y = fromY + (toY - fromY) * f - arcPeak * 4 * f * (1 - f);
        arrow.setPosition(x, y);
        // Rotation follows actual velocity so the arc reads in the arrow
        // itself, not just the path.
        if (x !== lastX || y !== lastY) {
          arrow.setRotation(Math.atan2(y - lastY, x - lastX));
          lastX = x;
          lastY = y;
        }
      },
      onComplete: () => {
        arrow.destroy();
        res();
      }
    });
  });
};

// Lens beam — Veya's focused-light attack. A brief amber charge glint at
// the rig, then a bright core beam with a soft halo snaps to the target
// and burns out from the origin end. Resolves at the moment the beam
// connects so damage application lands with the flash (same contract as
// fireArrow). No projectile travel: light doesn't fly, it arrives.
export const lensBeam = (
  scene: Phaser.Scene,
  world: WorldTag,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): Promise<void> => {
  const CORE = 0xffd98a;
  const HALO = 0xffb347;
  // Charge glint: a small expanding ring at the lens, pulling focus.
  const glint = world(scene.add.circle(fromX, fromY, 2, CORE, 0.9));
  glint.setDepth(DEPTH_ARROW);
  scene.tweens.add({
    targets: glint,
    radius: 7,
    alpha: 0,
    duration: 110,
    ease: "Sine.easeOut",
    onComplete: () => glint.destroy()
  });
  return new Promise((res) => {
    scene.time.delayedCall(90, () => {
      const g = world(scene.add.graphics());
      g.setDepth(DEPTH_ARROW);
      g.lineStyle(6, HALO, 0.35);
      g.lineBetween(fromX, fromY, toX, toY);
      g.lineStyle(2, CORE, 1);
      g.lineBetween(fromX, fromY, toX, toY);
      // Prismatic scatter where the beam lands.
      for (let i = 0; i < 4; i++) {
        const a = Math.random() * Math.PI * 2;
        g.lineStyle(1.5, i % 2 ? CORE : 0xfff2d9, 0.8);
        g.lineBetween(toX, toY, toX + Math.cos(a) * 9, toY + Math.sin(a) * 9);
      }
      res(); // impact — caller applies damage now, beam lingers as it fades
      scene.tweens.add({
        targets: g,
        alpha: 0,
        duration: 200,
        ease: "Cubic.easeOut",
        onComplete: () => g.destroy()
      });
    });
  });
};

// Crescent sweep at the impact point, rotated to the attack direction.
// A short arc stroke that rotates ~70° while fading — reads as the
// blade passing through, without needing frame art.
export const slashArc = (
  scene: Phaser.Scene,
  world: WorldTag,
  x: number,
  y: number,
  angle: number,
  crit: boolean
): void => {
  const g = world(scene.add.graphics({ x, y }));
  g.setDepth(DEPTH_IMPACT);
  const radius = crit ? 24 : 18;
  const color = crit ? 0xffd45a : 0xf2f5fa;
  // Two strokes — a bright core and a soft halo — sell a motion blur.
  g.lineStyle(4, color, 0.9);
  g.beginPath();
  g.arc(0, 0, radius, -0.9, 0.9);
  g.strokePath();
  g.lineStyle(8, color, 0.25);
  g.beginPath();
  g.arc(0, 0, radius, -0.7, 0.7);
  g.strokePath();
  g.setRotation(angle - 0.6);
  scene.tweens.add({
    targets: g,
    rotation: angle + 0.6,
    alpha: 0,
    duration: crit ? 160 : 120,
    ease: "Cubic.easeOut",
    onComplete: () => g.destroy()
  });
};

// Radial burst of short lines at the impact point. Crits get more rays,
// longer travel, and the gold palette.
export const hitSpark = (
  scene: Phaser.Scene,
  world: WorldTag,
  x: number,
  y: number,
  crit: boolean
): void => {
  const rays = crit ? 8 : 5;
  const color = crit ? 0xffd45a : 0xfff2d9;
  for (let i = 0; i < rays; i++) {
    const ang = (Math.PI * 2 * i) / rays + Math.random() * 0.5;
    const len = (crit ? 10 : 7) + Math.random() * 4;
    const dist = (crit ? 16 : 11) + Math.random() * 5;
    const line = world(scene.add.line(
      x, y,
      0, 0,
      Math.cos(ang) * len, Math.sin(ang) * len,
      color, 0.95
    ));
    line.setDepth(DEPTH_IMPACT).setLineWidth(crit ? 1.6 : 1.2);
    scene.tweens.add({
      targets: line,
      x: x + Math.cos(ang) * dist,
      y: y + Math.sin(ang) * dist,
      alpha: 0,
      duration: 150 + Math.random() * 60,
      ease: "Cubic.easeOut",
      onComplete: () => line.destroy()
    });
  }
};

// A soft air-puff drifting past the defender — the visual for a miss,
// so a whiffed swing shows motion instead of nothing but the floater.
export const missWhiff = (
  scene: Phaser.Scene,
  world: WorldTag,
  x: number,
  y: number,
  dirX: number
): void => {
  for (let i = 0; i < 3; i++) {
    const puff = world(scene.add.circle(
      x - dirX * 6 + (Math.random() - 0.5) * 8,
      y - 6 + i * 7,
      3 + Math.random() * 2,
      0xc9cdd6,
      0.4
    ));
    puff.setDepth(DEPTH_IMPACT);
    scene.tweens.add({
      targets: puff,
      x: x + dirX * (18 + Math.random() * 8),
      alpha: 0,
      scale: 1.6,
      duration: 220 + Math.random() * 80,
      ease: "Sine.easeOut",
      onComplete: () => puff.destroy()
    });
  }
};
