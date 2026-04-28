import Phaser from "phaser";
import { COLORS } from "../util/constants";
import { sfxClick, sfxHover } from "../audio/Sfx";

// A tiny gear icon button that opens the SettingsScene as a modal overlay.
// Drop into any scene that should expose audio settings — by convention,
// pinned to the top-right corner.
//
// Hit zone is a transparent Phaser.GameObjects.Rectangle child rather than a
// Container-level circular hit area: same reason as Button.ts — Phaser's
// native Rectangle input geometry is reliable across the whole visible area,
// whereas custom Circle hit areas on Containers have intermittently failed
// the right-half of the touch target.
export class SettingsButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private hovered = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    // Touch target — kept ≥44px even though the visible circle is smaller.
    const hitR = 24;
    this.bg = scene.add.graphics();
    this.add(this.bg);
    // Draw the gear glyph as text — universally readable, no asset needed.
    const glyph = scene.add.text(0, 1, "\u2699", {
      fontFamily: "Segoe UI Symbol, Apple Symbols, Symbola, sans-serif",
      fontSize: "20px",
      color: "#f4e4b0"
    }).setOrigin(0.5);
    this.add(glyph);

    // Transparent square hit zone covering the full touch target.
    const hitZone = scene.add.rectangle(0, 0, hitR * 2, hitR * 2, 0x000000, 0).setOrigin(0.5);
    hitZone.setInteractive({ useHandCursor: true });
    this.add(hitZone);

    hitZone.on("pointerover", () => { this.hovered = true; sfxHover(); this.redraw(); });
    hitZone.on("pointerout", () => { this.hovered = false; this.redraw(); });
    hitZone.on("pointerdown", () => {
      sfxClick();
      // Pause the launching scene so its tweens/timers freeze, then overlay
      // the settings modal. SettingsScene resumes us on close.
      const key = scene.scene.key;
      scene.scene.pause(key);
      scene.scene.launch("SettingsScene", { from: key });
    });
    this.setDepth(1000);
    this.redraw();
    scene.add.existing(this);
  }

  private redraw(): void {
    const r = 18;
    const g = this.bg;
    g.clear();
    g.fillStyle(this.hovered ? 0x1c2032 : 0x131724, 0.92);
    g.fillCircle(0, 0, r);
    g.lineStyle(1, COLORS.gold, this.hovered ? 0.95 : 0.75);
    g.strokeCircle(0, 0, r);
  }
}
