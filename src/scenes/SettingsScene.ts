import Phaser from "phaser";
import { COLORS, FAMILY_BODY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { Button } from "../ui/Button";
import { applySettings, loadSettings, saveSettings, type Settings } from "../util/settings";
import { sfxClick } from "../audio/Sfx";

interface SettingsArgs {
  // Scene that launched us — we resume it on close. May be omitted when
  // launched from a place where pausing isn't meaningful (e.g., title).
  from?: string;
}

// Modal overlay launched on top of any scene. The launching scene is paused;
// closing the modal resumes it. Built as a Phaser Scene rather than HTML so
// it inherits the Phaser scaler and looks consistent with the rest of the UI.
export class SettingsScene extends Phaser.Scene {
  private fromKey?: string;
  private settings!: Settings;

  constructor() { super("SettingsScene"); }

  init(data: SettingsArgs): void {
    this.fromKey = data?.from;
    this.settings = { ...loadSettings() };
  }

  create(): void {
    // Dim the scene below.
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65);
    dim.setInteractive(); // swallow clicks so they don't fall through to the paused scene

    // Modal panel
    const panelW = 520;
    const panelH = 380;
    const panelX = GAME_WIDTH / 2 - panelW / 2;
    const panelY = GAME_HEIGHT / 2 - panelH / 2;
    const panel = this.add.graphics();
    panel.fillStyle(0x0d111c, 0.98);
    panel.fillRect(panelX, panelY, panelW, panelH);
    panel.lineStyle(1, COLORS.gold, 0.85);
    panel.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);
    panel.lineStyle(1, COLORS.goldBright, 0.25);
    panel.strokeRect(panelX + 2.5, panelY + 2.5, panelW - 5, panelH - 5);

    this.add.text(GAME_WIDTH / 2, panelY + 28, "Settings", {
      fontFamily: FAMILY_HEADING,
      fontSize: "28px",
      color: "#f4e4b0",
      stroke: "#000",
      strokeThickness: 2
    }).setOrigin(0.5);

    // Sliders
    const sliderX = panelX + 40;
    const sliderW = panelW - 80;
    let row = panelY + 90;
    const rowH = 64;

    this.makeSlider(sliderX, row, sliderW, "Master Volume", this.settings.masterVol, (v) => {
      this.settings.masterVol = v;
      this.commit();
    });
    row += rowH;
    this.makeSlider(sliderX, row, sliderW, "Music", this.settings.musicVol, (v) => {
      this.settings.musicVol = v;
      this.commit();
    });
    row += rowH;
    this.makeSlider(sliderX, row, sliderW, "Sound Effects", this.settings.sfxVol, (v) => {
      this.settings.sfxVol = v;
      this.commit();
    });

    // Resume / Close button
    const closeW = 180;
    const closeH = 44;
    new Button(this, {
      x: GAME_WIDTH / 2 - closeW / 2,
      y: panelY + panelH - 64,
      w: closeW,
      h: closeH,
      label: "Resume",
      primary: true,
      fontSize: 16,
      onClick: () => { sfxClick(); this.close(); }
    });

    this.input.keyboard?.on("keydown-ESC", () => this.close());
    this.input.keyboard?.on("keydown-ENTER", () => this.close());
  }

  private commit(): void {
    saveSettings(this.settings);
    // Apply against the parent scene if we were launched from one — that's
    // where the live MusicManager is bound. Falls back to self if standalone.
    const target = this.fromKey ? this.scene.get(this.fromKey) : this;
    applySettings(target ?? this, this.settings);
  }

  private close(): void {
    if (this.fromKey) {
      this.scene.resume(this.fromKey);
      this.scene.stop();
    } else {
      this.scene.stop();
    }
  }

  private makeSlider(
    x: number,
    y: number,
    w: number,
    label: string,
    initial: number,
    onChange: (v: number) => void
  ): void {
    // Label + percentage readout
    this.add.text(x, y, label, {
      fontFamily: FAMILY_BODY,
      fontSize: "16px",
      color: "#dde6ef"
    });
    const pctText = this.add.text(x + w, y, `${Math.round(initial * 100)}%`, {
      fontFamily: FAMILY_BODY,
      fontSize: "14px",
      color: "#c9b07a"
    }).setOrigin(1, 0);

    // Track
    const trackY = y + 30;
    const trackH = 6;
    const track = this.add.graphics();
    const drawTrack = (frac: number): void => {
      track.clear();
      track.fillStyle(0x1d212c, 1);
      track.fillRect(x, trackY, w, trackH);
      track.fillStyle(COLORS.gold, 1);
      track.fillRect(x, trackY, w * frac, trackH);
    };
    drawTrack(initial);

    // Knob
    const knobR = 9;
    const knob = this.add.circle(x + w * initial, trackY + trackH / 2, knobR, 0xf4e4b0)
      .setStrokeStyle(2, 0x1a0e04);

    // Hit zone covers the full row so clicks anywhere on the row register.
    // 44px tall meets the standard touch-target minimum.
    const zone = this.add.zone(x, y + 12, w, 44).setOrigin(0, 0).setInteractive({ useHandCursor: true });

    let dragging = false;
    const updateFromX = (px: number): void => {
      const frac = Math.max(0, Math.min(1, (px - x) / w));
      knob.x = x + w * frac;
      drawTrack(frac);
      pctText.setText(`${Math.round(frac * 100)}%`);
      onChange(frac);
    };
    zone.on("pointerdown", (p: Phaser.Input.Pointer) => { dragging = true; updateFromX(p.x); });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => { if (dragging) updateFromX(p.x); });
    this.input.on("pointerup", () => { dragging = false; });
  }
}
