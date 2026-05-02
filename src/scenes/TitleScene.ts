import Phaser from "phaser";
import { Button } from "../ui/Button";
import { SettingsButton } from "../ui/SettingsButton";
import { COLORS, FAMILY_BODY, FAMILY_DISPLAY, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
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
      fontFamily: FAMILY_DISPLAY,
      fontSize: "132px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 10,
      shadow: { offsetX: 0, offsetY: 6, color: "#000", blur: 22, fill: true, stroke: true }
    }).setOrigin(0.5).setLetterSpacing(8);

    this.add.text(GAME_WIDTH / 2, 296, "A Tactical Story of Anthros", {
      fontFamily: FAMILY_BODY,
      fontSize: "22px",
      color: "#d9bf85",
      fontStyle: "italic",
      shadow: { offsetX: 0, offsetY: 2, color: "#000", blur: 8, fill: true }
    }).setOrigin(0.5).setLetterSpacing(6);

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
        // Longer fade so the title music + image gracefully recede into the
        // black frame the intro video opens on.
        this.cameras.main.fadeOut(700, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
          // Title → Intro Video → Menu (auth or save slot picker).
          const next = isAuthEnabled() ? "AuthScene" : "SaveSlotScene";
          this.scene.start("IntroVideoScene", { next });
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
        // Route into the camp (the new home base), not directly to
        // the world map. CampScene's "Where to Next?" hotspot opens
        // the world map one click in.
        this.cameras.main.once("camerafadeoutcomplete", () =>
          this.scene.start("CampScene")
        );
      }
    });

    // Tap-to-start hint
    const hint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 36, "click anywhere — and the world begins to listen", {
      fontFamily: FAMILY_BODY,
      fontSize: "14px",
      color: "#8a7d68",
      fontStyle: "italic"
    }).setOrigin(0.5).setLetterSpacing(1);
    this.tweens.add({ targets: hint, alpha: { from: 0.5, to: 1 }, yoyo: true, repeat: -1, duration: 1600 });

    // Music — Spine of the World, the main leitmotif
    getMusic(this).play(MUSIC.mainTheme, { fadeMs: 1200 });

    // Settings opener (top-right gear icon)
    new SettingsButton(this, GAME_WIDTH - 32, 32);

    // Suppress unused vars (TS strict)
    void playBtn; void resumeBtn;
  }
}
