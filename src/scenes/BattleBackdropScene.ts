import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { ensureBackdropForKey } from "../art/BackdropArt";
import type { BackdropKey } from "../data/contentIds";

// The painted distance behind a ¾ battle, in its own scene.
//
// On the flat board the backdrop was just the first image in BattleScene's
// world. The diorama board runs its world camera through a perspective
// pass (render/PerspectivePipeline) that tilts the image, and a tilted
// image uncovers wedges at the top corners — the far edge converges
// inward. Those pixels come out transparent, so something has to be
// UNDER the battle to show through them. A separate scene is that
// something, and being separate is the point: a third camera inside
// BattleScene would have drawn every mid-battle object (floaters,
// reinforcements, VFX) unless each one was explicitly routed away from
// it, which is exactly the bug class the Ravage aura fell into.
//
// Registered immediately before BattleScene in main.ts, so it renders
// beneath it. BattleScene launches it, drives its parallax each frame,
// mirrors its fades, and stops it on shutdown.

export interface BattleBackdropArgs {
  backdropKey: BackdropKey;
  /** Night / fog-of-war battle: the distance sinks into the same dark. */
  night?: boolean;
}

/** How much slower than the board the distance scrolls. */
export const BACKDROP_PARALLAX = 0.14;

/** Depth-of-field softening of the distance, in source pixels. */
const DISTANCE_BLUR_PX = 3;

/**
 * The distance, out of focus. A crisp board in front of a soft world is
 * the oldest diorama cue there is (tilt-shift photography fakes a model
 * village with nothing else), and the painted backdrops were as sharp as
 * the tiles — so the eye read one flat picture instead of a board with a
 * world behind it. Blurred once on the CPU at load rather than per frame
 * on the GPU; where the canvas has no `filter` (older Safari) the
 * backdrop simply stays sharp.
 */
const ensureDistant = (scene: Phaser.Scene, key: string): string => {
  const out = `${key}:distant`;
  if (scene.textures.exists(out)) return out;
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = src.width, h = src.height;
  if (!w || !h) return key;
  const tex = scene.textures.createCanvas(out, w, h);
  if (!tex) return key;
  const ctx = tex.getContext();
  if (!("filter" in ctx)) {
    scene.textures.remove(out);
    return key;
  }
  ctx.filter = `blur(${DISTANCE_BLUR_PX}px)`;
  // Overdraw past the rim so the blur has picture to pull in at the
  // edges, not transparent black.
  const pad = DISTANCE_BLUR_PX * 3;
  ctx.drawImage(src, -pad, -pad, w + pad * 2, h + pad * 2);
  ctx.filter = "none";
  tex.refresh();
  return out;
};

export class BattleBackdropScene extends Phaser.Scene {
  private backdropKey!: BackdropKey;
  private night = false;

  constructor() { super("BattleBackdropScene"); }

  init(data: BattleBackdropArgs): void {
    this.backdropKey = data.backdropKey;
    this.night = !!data.night;
  }

  create(): void {
    const sharp = ensureBackdropForKey(this, this.backdropKey);
    const key = ensureDistant(this, sharp);
    // ~6MB of canvas per backdrop: rebuilt per battle rather than kept
    // for every backdrop a long session passes through.
    if (key !== sharp) {
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        if (this.textures.exists(key)) this.textures.remove(key);
      });
    }
    // Oversized, and biased toward the bottom-right: the battle camera
    // only ever scrolls right/down from zero, so that's the direction the
    // parallax drags the image. 1.5× covers a pan of ~4000px across and
    // ~2300px down before an edge could show — far past the largest map.
    this.add.image(-60, -40, key)
      .setOrigin(0, 0)
      .setDisplaySize(GAME_WIDTH * 1.5, GAME_HEIGHT * 1.5)
      .setScrollFactor(1);
    // The same top-to-bottom dim BattleScene used, pinned to the screen.
    const dim = this.add.graphics().setScrollFactor(0);
    dim.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.22, 0.22, 0.42, 0.42);
    dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    if (this.night) {
      // Matches the battle's fog (0.82) closely enough that the sky and the
      // unlit board read as one night, with a touch left so the silhouette
      // of the distance survives.
      this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000511, 0.74)
        .setOrigin(0, 0).setScrollFactor(0);
    }
  }

  /** Follow the battle camera at a fraction of its speed. */
  follow(scrollX: number, scrollY: number): void {
    this.cameras.main.setScroll(scrollX * BACKDROP_PARALLAX, scrollY * BACKDROP_PARALLAX);
  }
}
