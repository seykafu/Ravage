import Phaser from "phaser";
import { COLORS } from "../util/constants";
import { sfxClick, sfxHover } from "../audio/Sfx";

// Toggle button that doubles the enemy-turn animation speed. Sits next to the
// SettingsButton on the top-right; the host scene reads `enabled` (or wires up
// the onToggle callback) and applies `tweens.timeScale = 2` /
// `time.timeScale = 2` while an enemy unit is acting.
//
// Visual states:
//   off  — dim gold outline, gold "▶▶" glyph
//   on   — bright gold fill, dark glyph (clearly "active")
export class FastForwardButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private glyph: Phaser.GameObjects.Text;
  private hovered = false;
  private enabled = false;

  constructor(scene: Phaser.Scene, x: number, y: number, onToggle: (enabled: boolean) => void) {
    super(scene, x, y);
    const r = 18;
    const hitR = 24;
    this.bg = scene.add.graphics();
    this.add(this.bg);
    // "▶▶" rendered as text — universally readable, no asset needed.
    this.glyph = scene.add.text(0, 1, "\u23E9", {
      fontFamily: "Segoe UI Symbol, Apple Symbols, Symbola, sans-serif",
      fontSize: "16px",
      color: "#f4e4b0"
    }).setOrigin(0.5);
    this.add(this.glyph);
    this.setSize(hitR * 2, hitR * 2);
    this.setInteractive(
      new Phaser.Geom.Circle(0, 0, hitR),
      Phaser.Geom.Circle.Contains
    );
    this.on("pointerover", () => { this.hovered = true; sfxHover(); this.redraw(); });
    this.on("pointerout", () => { this.hovered = false; this.redraw(); });
    this.on("pointerdown", () => {
      sfxClick();
      this.enabled = !this.enabled;
      onToggle(this.enabled);
      this.redraw();
    });
    this.setDepth(1000);
    this.redraw();
    scene.add.existing(this);
  }

  public isEnabled(): boolean { return this.enabled; }

  private redraw(): void {
    const r = 18;
    const g = this.bg;
    g.clear();
    if (this.enabled) {
      // Active — solid gold fill, dark glyph.
      g.fillStyle(COLORS.gold, this.hovered ? 1.0 : 0.92);
      g.fillCircle(0, 0, r);
      g.lineStyle(1, COLORS.gold, 1.0);
      g.strokeCircle(0, 0, r);
      this.glyph.setColor("#1a1408");
    } else {
      // Idle — dim panel, gold glyph.
      g.fillStyle(this.hovered ? 0x1c2032 : 0x131724, 0.92);
      g.fillCircle(0, 0, r);
      g.lineStyle(1, COLORS.gold, this.hovered ? 0.95 : 0.55);
      g.strokeCircle(0, 0, r);
      this.glyph.setColor("#f4e4b0");
    }
  }
}
