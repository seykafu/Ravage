import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../util/constants";

// The night beyond the camp board, in its own scene — the battle's
// arrangement (see BattleBackdropScene). CampScene's world camera runs
// through the keystone tilt, which uncovers transparent wedges at the top
// corners; this scene is what shows through them and through the sky
// above the board.
//
// Registered immediately before CampScene in main.ts, so it renders
// beneath it. CampScene launches it, drives its parallax, mirrors its
// fades, and stops it on shutdown.

/** How much of the camp camera's drift the distance follows. */
export const CAMP_BACKDROP_PARALLAX = 0.35;

const SKY = "backdrop:camp_sky";

// The painting's treeline foot sits at 54% of its height. Placed so the
// foot is just hidden behind the board's back edge (screen y ≈ 357), the
// mountains and the tops of the far trees stand over it and the moon
// stays on screen.
const SKY_W = GAME_WIDTH * 1.1;
const SKY_TREE_FOOT = 0.54;
const BOARD_BACK_SCREEN_Y = 366;

export class CampBackdropScene extends Phaser.Scene {
  constructor() { super("CampBackdropScene"); }

  create(): void {
    if (this.textures.exists(SKY)) {
      const src = this.textures.get(SKY).getSourceImage() as HTMLImageElement;
      const h = SKY_W * ((src.height || 9) / (src.width || 16));
      this.add.image(GAME_WIDTH / 2, BOARD_BACK_SCREEN_Y - h * SKY_TREE_FOOT, SKY)
        .setOrigin(0.5, 0)
        .setDisplaySize(SKY_W, h);
    } else {
      // The painting hasn't arrived (or failed): a plain night, so the
      // camp is never drawn over black.
      const g = this.add.graphics();
      g.fillGradientStyle(0x070b1c, 0x070b1c, 0x111a30, 0x111a30, 1);
      g.fillRect(-80, -60, GAME_WIDTH + 160, GAME_HEIGHT * 0.6);
      g.fillStyle(0x05070c, 1);
      g.fillRect(-80, GAME_HEIGHT * 0.6 - 60, GAME_WIDTH + 160, GAME_HEIGHT);
    }
    // A touch of the board's own dark, so the sky never outshines the fire.
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x02040a, 0.18).setOrigin(0, 0).setScrollFactor(0);
  }

  /** Follow the camp camera's drift at a fraction of it. */
  follow(scrollX: number, scrollY: number): void {
    this.cameras.main.setScroll(scrollX * CAMP_BACKDROP_PARALLAX, scrollY * CAMP_BACKDROP_PARALLAX);
  }

  fade(out: boolean, ms: number): void {
    if (out) this.cameras.main.fadeOut(ms, 0, 0, 0);
    else this.cameras.main.fadeIn(ms, 0, 0, 0);
  }
}
