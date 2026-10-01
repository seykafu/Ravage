import Phaser from "phaser";
import { COLORS, FAMILY_BODY, FAMILY_HEADING } from "../util/constants";
import { sfxClick, sfxHover } from "../audio/Sfx";

// A large call-to-action: the camp's "Start Next Chapter" and "Go to Map".
// Button's house style at a size meant to be found at a glance, with an
// optional second line (which chapter) and an optional slow glow that
// draws the eye to it.
//
// Positioned by its CENTRE, so the hover lift scales about the middle.
// Input is a transparent Rectangle child, for the reasons given in
// Button.ts.

export interface CtaOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sublabel?: string;
  primary?: boolean;
  fontSize?: number;
  /** Breathe a glow round the button until it is used. */
  pulse?: boolean;
  onClick: () => void;
}

const HIT_PAD = 3;

export class CtaButton extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private glow: Phaser.GameObjects.Graphics;
  private title: Phaser.GameObjects.Text;
  private sub?: Phaser.GameObjects.Text;
  private hovered = false;
  private pressed = false;

  constructor(scene: Phaser.Scene, private opts: CtaOpts) {
    super(scene, opts.x, opts.y);
    const { w, h } = opts;
    this.glow = scene.add.graphics();
    this.bg = scene.add.graphics();
    const size = opts.fontSize ?? 20;
    const titleY = opts.sublabel ? -h * 0.14 : 0;
    this.title = scene.add.text(0, titleY, opts.label, {
      fontFamily: FAMILY_HEADING,
      fontSize: `${size}px`,
      color: opts.primary ? "#fff2c0" : "#e6edf5",
      stroke: "#000",
      strokeThickness: 3,
      shadow: { offsetX: 0, offsetY: 2, color: "#000", blur: 6, fill: true }
    }).setOrigin(0.5).setLetterSpacing(1);
    const parts: Phaser.GameObjects.GameObject[] = [this.glow, this.bg, this.title];
    if (opts.sublabel) {
      this.sub = scene.add.text(0, h * 0.24, opts.sublabel, {
        fontFamily: FAMILY_BODY,
        fontSize: "13px",
        color: opts.primary ? "#e8cf8e" : "#aab6c4",
        fontStyle: "italic"
      }).setOrigin(0.5);
      // Long chapter names shrink to fit rather than spill over the frame.
      const room = w - 28;
      if (this.sub.width > room) this.sub.setScale(room / this.sub.width);
      parts.push(this.sub);
    }
    if (this.title.width > w - 24) this.title.setScale((w - 24) / this.title.width);
    const hit = scene.add.rectangle(0, 0, w + HIT_PAD * 2, h + HIT_PAD * 2, 0x000000, 0);
    hit.setInteractive({ useHandCursor: true });
    parts.push(hit);
    this.add(parts);

    hit.on("pointerover", () => { this.hovered = true; sfxHover(); this.redraw(); });
    hit.on("pointerout", () => { this.hovered = false; this.redraw(); });
    hit.on("pointerdown", () => { this.pressed = true; this.redraw(); });
    hit.on("pointerup", () => {
      const was = this.pressed;
      this.pressed = false;
      this.redraw();
      if (was) { sfxClick(); opts.onClick(); }
    });
    const onGlobalUp = (): void => { if (this.pressed) { this.pressed = false; this.redraw(); } };
    scene.input.on("pointerup", onGlobalUp);
    this.once(Phaser.GameObjects.Events.DESTROY, () => scene.input.off("pointerup", onGlobalUp));

    if (opts.pulse) {
      this.glow.setAlpha(0.25);
      scene.tweens.add({
        targets: this.glow,
        alpha: 1,
        duration: 1100,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
    } else {
      this.glow.setAlpha(0);
    }
    this.redraw();
    scene.add.existing(this);
  }

  private redraw(): void {
    const { w, h, primary } = this.opts;
    const x = -w / 2, y = -h / 2;
    const accent = primary ? COLORS.gold : COLORS.steel;
    const g = this.bg;
    g.clear();
    // Drop shadow: the button sits on the scene, not in it.
    g.fillStyle(0x000000, 0.5);
    g.fillRect(x + 2, y + 5, w, h);
    const [top, bot] = primary
      ? this.pressed ? [0x3a2408, 0x1e1204] : this.hovered ? [0x6e4818, 0x34200a] : [0x553612, 0x2a1806]
      : this.pressed ? [0x0a0c14, 0x05060a] : this.hovered ? [0x222840, 0x0e1120] : [0x161b2c, 0x0a0c14];
    g.fillGradientStyle(top, top, bot, bot, 1);
    g.fillRect(x, y, w, h);
    // A lit top edge, the way light catches a raised plate.
    g.fillStyle(0xffffff, this.hovered ? 0.12 : 0.07);
    g.fillRect(x + 2, y + 2, w - 4, Math.max(2, Math.round(h * 0.18)));
    g.lineStyle(2, accent, 1);
    g.strokeRect(x + 1, y + 1, w - 2, h - 2);
    g.lineStyle(1, primary ? 0xffe6a0 : 0xc6d0de, this.hovered ? 0.7 : 0.3);
    g.strokeRect(x + 5.5, y + 5.5, w - 11, h - 11);
    // Corner studs.
    g.fillStyle(primary ? 0xffe6a0 : 0xc6d0de, 0.9);
    for (const [cx, cy] of [[x + 5, y + 5], [x + w - 5, y + 5], [x + 5, y + h - 5], [x + w - 5, y + h - 5]] as const) {
      g.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }

    const gl = this.glow;
    gl.clear();
    for (let i = 1; i <= 4; i++) {
      gl.lineStyle(2, primary ? 0xffc85a : 0x9fb4d0, 0.34 - i * 0.07);
      gl.strokeRect(x - i * 2.5, y - i * 2.5, w + i * 5, h + i * 5);
    }
    if (!this.opts.pulse) gl.setAlpha(this.hovered ? 0.8 : 0);

    this.setScale(this.pressed ? 0.985 : this.hovered ? 1.025 : 1);
  }
}
