import Phaser from "phaser";
import { COLORS } from "../util/constants";
import { sfxClick, sfxHover } from "../audio/Sfx";

// A tiny gear icon button that opens the SettingsScene as a modal overlay.
// Drop into any scene that should expose audio settings — by convention,
// pinned to the top-right corner.
export class SettingsButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private hovered = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    const r = 18;
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
    this.setSize(hitR * 2, hitR * 2);
    this.setInteractive(
      new Phaser.Geom.Circle(0, 0, hitR),
      Phaser.Geom.Circle.Contains
    );
    this.on("pointerover", () => { this.hovered = true; sfxHover(); this.redraw(); });
    this.on("pointerout", () => { this.hovered = false; this.redraw(); });
    this.on("pointerdown", () => {
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
