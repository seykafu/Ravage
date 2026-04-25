import Phaser from "phaser";
import { COLORS, FAMILY_HEADING } from "../util/constants";
import { sfxClick, sfxHover } from "../audio/Sfx";

export interface ButtonOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  onClick: () => void;
  enabled?: boolean;
  primary?: boolean; // gold accent vs steel
  fontSize?: number;
}

// Pixels of forgiveness around every visible edge. Kept ≤ half the smallest
// gap between adjacent buttons (4px in BattleScene) so neighbours don't
// overlap and steal each other's clicks.
const HIT_PAD = 2;

export class Button extends Phaser.GameObjects.Container {
  private bg: Phaser.GameObjects.Graphics;
  private text: Phaser.GameObjects.Text;
  private opts: ButtonOpts;
  private hovered = false;
  private pressed = false;
  private enabledFlag = true;

  constructor(scene: Phaser.Scene, opts: ButtonOpts) {
    // Shift the container origin up-and-left by HIT_PAD so the visible button
    // rect lives at container-local (HIT_PAD, HIT_PAD)…(HIT_PAD+w, HIT_PAD+h)
    // and the hit area is a positive-coord Rectangle(0, 0, w+pad*2, h+pad*2).
    // Earlier we used a negative-origin Rectangle(-pad, -pad, …) but that
    // misaligned with the container's setSize bounds — Phaser's hit-test ran
    // the geometry callback in container-local space, but the LEFT edge
    // (x < 0) overlapped the container's transform origin in a way that ate
    // hover events on the right portion of the visible rect, forcing the
    // pointer to be left of centre to register.
    super(scene, opts.x - HIT_PAD, opts.y - HIT_PAD);
    this.opts = opts;
    this.enabledFlag = opts.enabled ?? true;
    this.bg = scene.add.graphics();
    this.text = scene.add.text(HIT_PAD + opts.w / 2, HIT_PAD + opts.h / 2, opts.label, {
      fontFamily: FAMILY_HEADING,
      fontSize: `${opts.fontSize ?? 16}px`,
      color: "#f4e4b0",
      stroke: "#000",
      strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 2, color: "#000", blur: 4, fill: true }
    }).setOrigin(0.5).setLetterSpacing(0.5);
    this.add([this.bg, this.text]);

    const fullW = opts.w + HIT_PAD * 2;
    const fullH = opts.h + HIT_PAD * 2;
    this.setSize(fullW, fullH);
    this.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, fullW, fullH),
      Phaser.Geom.Rectangle.Contains
    );
    this.on("pointerover", () => {
      if (!this.enabledFlag) return;
      this.hovered = true;
      sfxHover();
      this.redraw();
    });
    // IMPORTANT: do not clear `pressed` here. Sub-pixel cursor jitter during a
    // click can fire pointerout/over rapidly, and clearing pressed would cancel
    // the click. A global pointerup listener below resets `pressed` cleanly.
    this.on("pointerout", () => {
      this.hovered = false;
      this.redraw();
    });
    this.on("pointerdown", () => {
      if (!this.enabledFlag) return;
      this.pressed = true;
      this.redraw();
    });
    this.on("pointerup", () => {
      if (!this.enabledFlag) return;
      const wasPressed = this.pressed;
      this.pressed = false;
      this.redraw();
      if (wasPressed) {
        sfxClick();
        opts.onClick();
      }
    });
    // If the user releases outside the button after pressing on it, drop the
    // pressed visual state so it doesn't get stuck.
    const onGlobalUp = (): void => {
      if (this.pressed) {
        this.pressed = false;
        this.redraw();
      }
    };
    scene.input.on("pointerup", onGlobalUp);
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.input.off("pointerup", onGlobalUp);
    });

    this.redraw();
    scene.add.existing(this);
  }

  setEnabled(b: boolean): void {
    this.enabledFlag = b;
    this.redraw();
  }

  setLabel(s: string): void {
    this.text.setText(s);
  }

  private redraw(): void {
    const { w, h, primary } = this.opts;
    const g = this.bg;
    g.clear();
    const accent = primary ? COLORS.gold : COLORS.steel;
    const fillTop = this.enabledFlag ? (this.pressed ? 0x0a0c14 : this.hovered ? 0x1c2032 : 0x131724) : 0x0a0c14;
    const fillBot = this.enabledFlag ? (this.pressed ? 0x05060a : 0x0a0c14) : 0x05060a;
    g.fillGradientStyle(fillTop, fillTop, fillBot, fillBot, 1);
    g.fillRect(HIT_PAD, HIT_PAD, w, h);
    g.lineStyle(1, accent, this.enabledFlag ? 0.85 : 0.3);
    g.strokeRect(HIT_PAD + 0.5, HIT_PAD + 0.5, w - 1, h - 1);
    g.lineStyle(1, primary ? 0xffd97a : 0xb6c2d6, this.enabledFlag ? (this.hovered ? 0.6 : 0.25) : 0.1);
    g.strokeRect(HIT_PAD + 2.5, HIT_PAD + 2.5, w - 5, h - 5);
    this.text.setColor(this.enabledFlag ? (primary ? "#fff2c0" : "#dde6ef") : "#5a5a60");
  }
}
