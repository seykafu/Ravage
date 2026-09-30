import Phaser from "phaser";
import { COLORS } from "../util/constants";
import { sfxClick, sfxHover } from "../audio/Sfx";

// Momentary circular glyph button for the battle top bar — the same look
// as IconToggleButton / FastForwardButton, but it fires on each press
// instead of holding an on/off state (turn the board, reset the view).
//
// Hit zone is a transparent Rectangle child, as in the other top-bar
// buttons: Container-level Circle hit areas have intermittently failed.
export class IconButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private glyph: Phaser.GameObjects.Text;
  private hovered = false;
  private pressed = false;

  constructor(scene: Phaser.Scene, x: number, y: number, glyphChar: string, onPress: () => void) {
    super(scene, x, y);
    const hitR = 22;
    this.bg = scene.add.graphics();
    this.add(this.bg);
    this.glyph = scene.add.text(0, 0, glyphChar, {
      fontFamily: "Segoe UI Symbol, Apple Symbols, Symbola, sans-serif",
      fontSize: "18px",
      color: "#f4e4b0"
    }).setOrigin(0.5);
    this.add(this.glyph);

    const hitZone = scene.add.rectangle(0, 0, hitR * 2, hitR * 2, 0x000000, 0).setOrigin(0.5);
    hitZone.setInteractive({ useHandCursor: true });
    this.add(hitZone);

    hitZone.on("pointerover", () => { this.hovered = true; sfxHover(); this.redraw(); });
    hitZone.on("pointerout", () => { this.hovered = false; this.pressed = false; this.redraw(); });
    hitZone.on("pointerdown", () => { this.pressed = true; this.redraw(); });
    hitZone.on("pointerup", () => {
      if (!this.pressed) return;
      this.pressed = false;
      sfxClick();
      this.redraw();
      onPress();
    });
    this.setDepth(1000);
    this.redraw();
    scene.add.existing(this);
  }

  private redraw(): void {
    const r = 18;
    const g = this.bg;
    g.clear();
    g.fillStyle(this.pressed ? COLORS.gold : this.hovered ? 0x1c2032 : 0x131724, this.pressed ? 0.9 : 0.92);
    g.fillCircle(0, 0, r);
    g.lineStyle(1, COLORS.gold, this.hovered ? 0.95 : 0.55);
    g.strokeCircle(0, 0, r);
    this.glyph.setColor(this.pressed ? "#1a1408" : "#f4e4b0");
  }
}
