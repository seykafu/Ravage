// Combat impact toolkit — the "feel" layer for hits and deaths.
//
// Three tools, all procedural:
//   * hitStop      — a beat of near-frozen time on impact. THE classic
//                    juice tool: 60ms reads as weight, 120ms as a crit.
//                    Restores through the caller's restore callback so
//                    the fast-forward timescale (2x enemy turns) comes
//                    back correctly instead of hardcoding 1.
//   * ashBurst     — dark motes kicked up at a death, fluttering down.
//   * soulWisp     — a single soft light that rises off a fallen unit
//                    and fades. Paired with ashBurst it turns the death
//                    fade into a read: something LEFT.
//
// Follows the RavageVfx/CombatVfx extraction pattern: pure top-level
// functions, scene passed in, world-tagging callback keeps everything
// off the UI camera.

import Phaser from "phaser";

type WorldTag = <T extends Phaser.GameObjects.GameObject>(obj: T) => T;

const DEPTH_IMPACT = 38;

// Monotonic token so overlapping dilations (counter chains, a hit-stop
// inside a Ravage slow-mo) don't have the FIRST restore un-freeze the
// SECOND early. Only the latest dilation's timer restores.
let stopToken = 0;

// General time dilation: scale the scene's tween + timer clocks for a
// wall-clock duration, then restore through the caller's callback (so
// fast-forward's 2x comes back correctly).
export const timeDilate = (
  scene: Phaser.Scene,
  scale: number,
  ms: number,
  restore: () => void
): void => {
  scene.tweens.timeScale = scale;
  scene.time.timeScale = scale;
  const token = ++stopToken;
  // Wall-clock timer — scene timers are slowed by the dilation itself.
  setTimeout(() => {
    if (token !== stopToken) return;
    // Scene may have shut down while we waited.
    if (!scene.scene || !scene.sys) return;
    // PAUSED still restores. A player death pops the retreat dialogue,
    // which pauses BattleScene — with the old isActive()-only guard the
    // restore silently skipped, and the battle came back from the
    // dialogue stuck at 5% speed until the next hit reset it (death
    // slow-mo that never let go; counters crawling so slowly they read
    // as never firing). Writing timeScale on a paused scene is safe —
    // its tweens simply aren't advancing.
    if (!scene.sys.isActive() && !scene.sys.isPaused()) return;
    restore();
  }, ms);
};

export const hitStop = (
  scene: Phaser.Scene,
  ms: number,
  restore: () => void
): void => {
  // Near-zero, not zero: a true 0 timescale stalls tween onComplete
  // chains some callers await. 0.05 freezes the eye without freezing
  // the machinery.
  timeDilate(scene, 0.05, ms, restore);
};

// Dark ash motes at a death: kicked upward, then fluttering down past
// where they started. Reads as the fire going out of someone.
export const ashBurst = (
  scene: Phaser.Scene,
  world: WorldTag,
  x: number,
  y: number
): void => {
  const count = 8;
  for (let i = 0; i < count; i++) {
    const shade = Phaser.Math.Between(0x2a, 0x4a);
    const mote = world(scene.add.circle(
      x + Phaser.Math.Between(-10, 10),
      y + Phaser.Math.Between(-16, 4),
      Phaser.Math.Between(1, 3),
      (shade << 16) | (shade << 8) | (shade + 6),
      0.85
    ));
    mote.setDepth(DEPTH_IMPACT);
    const rise = Phaser.Math.Between(10, 26);
    const drift = Phaser.Math.Between(-14, 14);
    scene.tweens.add({
      targets: mote,
      y: mote.y - rise,
      x: mote.x + drift * 0.4,
      duration: Phaser.Math.Between(180, 300),
      ease: "Cubic.easeOut",
      onComplete: () => {
        scene.tweens.add({
          targets: mote,
          y: mote.y + rise + Phaser.Math.Between(8, 18),
          x: mote.x + drift,
          alpha: 0,
          duration: Phaser.Math.Between(420, 700),
          ease: "Sine.easeIn",
          onComplete: () => mote.destroy()
        });
      }
    });
  }
};

// A ring of dust kicked out along the GROUND — a footfall, a body
// hitting the floor, a crit shoving someone back. The ring is squashed to
// the board's foreshortening (`squash` = tile depth / tile width), so it
// lies on the tilted ground instead of standing up like a wreath. Depth
// comes from the caller (sorted with the actors at that foot position) so
// a puff behind someone is hidden by them.
export const groundDust = (
  scene: Phaser.Scene,
  world: WorldTag,
  x: number,
  y: number,
  opts: { depth: number; count?: number; spread?: number; squash?: number; color?: number; dirX?: number }
): void => {
  const count = opts.count ?? 6;
  const spread = opts.spread ?? 14;
  const squash = opts.squash ?? 0.5;
  const color = opts.color ?? 0xc9b07a;
  for (let i = 0; i < count; i++) {
    // Even ring with jitter; a directional kick (dirX) biases puffs one way.
    let a = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    if (opts.dirX) a = (opts.dirX > 0 ? 0 : Math.PI) + (Math.random() - 0.5) * 1.8;
    const dist = spread * (0.6 + Math.random() * 0.5);
    const puff = world(scene.add.circle(x, y, 2 + Math.random() * 2, color, 0.5));
    puff.setDepth(opts.depth);
    scene.tweens.add({
      targets: puff,
      x: x + Math.cos(a) * dist,
      y: y + Math.sin(a) * dist * squash - 3 - Math.random() * 3,
      alpha: 0,
      scale: 1.9,
      duration: 380 + Math.random() * 160,
      ease: "Cubic.easeOut",
      onComplete: () => puff.destroy()
    });
  }
};

// One soft light rising off the fallen — needs the shared soft-dot
// texture (same one Atmosphere generates); caller passes its key so
// this module doesn't duplicate the canvas-texture builder.
export const soulWisp = (
  scene: Phaser.Scene,
  world: WorldTag,
  x: number,
  y: number,
  dotTexKey: string
): void => {
  if (!scene.textures.exists(dotTexKey)) return;
  const wisp = world(scene.add.image(x, y - 10, dotTexKey));
  wisp.setDepth(DEPTH_IMPACT).setScale(1.6).setAlpha(0).setTint(0xcfe0ff);
  scene.tweens.add({
    targets: wisp,
    alpha: { from: 0, to: 0.7 },
    duration: 260,
    ease: "Sine.easeOut",
    onComplete: () => {
      scene.tweens.add({
        targets: wisp,
        y: y - 54,
        alpha: 0,
        scale: 0.7,
        duration: 950,
        ease: "Sine.easeIn",
        onComplete: () => wisp.destroy()
      });
    }
  });
};
