import Phaser from "phaser";
import { Button } from "../ui/Button";
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { getMusic, MUSIC } from "../audio/Music";
import { installAudioUnlock, sfxConfirm, unlockAudio } from "../audio/Sfx";
import { ensureBackdropTexture, BACKDROPS } from "../art/BackdropArt";
import { getCurrentSlot } from "../util/save";
import { isAuthEnabled } from "../auth/session";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("TitleScene");
  }

  create(): void {
    installAudioUnlock(this);

    const bgKey = ensureBackdropTexture(this, "bg_title", BACKDROPS.thuling);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);

    // Title overlay vignette
    const v = this.add.graphics();
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0.85, 0.85);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Title typography
    const title = this.add.text(GAME_WIDTH / 2, 200, "RAVAGE", {
      fontFamily: "Cinzel, Trajan Pro, Times New Roman, serif",
      fontSize: "120px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 4, color: "#000", blur: 16, fill: true }
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 286, "A Tactical Story of Anthros", {
      fontFamily: "Georgia, serif",
      fontSize: "20px",
      color: "#c9b07a",
      letterSpacing: 4
    }).setOrigin(0.5);

    // Soft pulsing glow under the title
    this.tweens.add({
      targets: title,
      alpha: { from: 0.92, to: 1 },
      yoyo: true,
      repeat: -1,
      duration: 2000,
      ease: "Sine.easeInOut"
    });

    // CTA buttons. The actual save-slot picking and (optional) auth happens
    // in the next scenes — Title is just a single "Play" button now.
    const hasActiveSlot = getCurrentSlot() !== null;
    const cy = 470;
    const btnW = 280;
    const btnH = 56;
    const gap = 18;
    const startY = cy;

    const playBtn = new Button(this, {
      x: GAME_WIDTH / 2 - btnW / 2,
      y: startY,
      w: btnW,
      h: btnH,
      label: "Play",
      primary: true,
      fontSize: 22,
      onClick: () => {
        sfxConfirm();
        unlockAudio();
        this.cameras.main.fadeOut(450, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
          // If Supabase is configured and the user isn't signed in, AuthScene
          // handles routing. If unconfigured, AuthScene immediately forwards
          // to SaveSlotScene.
          this.scene.start(isAuthEnabled() ? "AuthScene" : "SaveSlotScene");
        });
      }
    });

    // "Resume" only appears when a slot is currently active (loaded into the
    // active mirror). It skips the slot picker.
    const resumeBtn = new Button(this, {
      x: GAME_WIDTH / 2 - btnW / 2,
      y: startY + btnH + gap,
      w: btnW,
      h: btnH,
      label: "Resume Last Slot",
      primary: false,
      enabled: hasActiveSlot,
      fontSize: 18,
      onClick: () => {
        sfxConfirm();
        unlockAudio();
        this.cameras.main.fadeOut(450, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () =>
          this.scene.start("OverworldScene")
        );
      }
    });

    // Tap-to-start hint
    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 36, "click anywhere — and the world begins to listen", {
      fontFamily: "Georgia, serif",
      fontSize: "13px",
      color: "#7a7165"
    }).setOrigin(0.5);
    this.tweens.add({ targets: hint, alpha: { from: 0.5, to: 1 }, yoyo: true, repeat: -1, duration: 1600 });

    // Music — opening adventure track
    getMusic(this).play(MUSIC.adventure1, { fadeMs: 1200 });

    // Suppress unused vars (TS strict)
    void playBtn; void resumeBtn;
  }
}
