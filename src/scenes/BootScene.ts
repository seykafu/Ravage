import Phaser from "phaser";
import { MUSIC_FILES } from "../audio/Music";
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { MANIFEST, markFailed, markLoaded } from "../assets/manifest";
import { registerUnitAnimations } from "../assets/animations";

// Loads music + any manifest assets that exist on disk, then hands off to TitleScene.
//
// Manifest assets are optional — every entry has a procedural fallback. We
// suppress 404s and just don't mark missing files as loaded.
export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload(): void {
    // Background gradient + loading bar
    const g = this.add.graphics();
    g.fillGradientStyle(0x0a0c14, 0x0a0c14, 0x05060a, 0x05060a, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    this.add.text(cx, cy - 60, "RAVAGE", {
      fontFamily: "Cinzel, Trajan Pro, Times New Roman, serif",
      fontSize: "72px",
      color: "#c9b07a",
      stroke: "#1a1208",
      strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(cx, cy + 4, "loading the spine of the world…", {
      fontFamily: "Georgia, serif",
      fontSize: "16px",
      color: "#7a7165"
    }).setOrigin(0.5);

    // Progress bar
    const barW = 320;
    const barH = 8;
    const barX = cx - barW / 2;
    const barY = cy + 40;
    const back = this.add.graphics();
    back.fillStyle(0x1d1d24, 1);
    back.fillRect(barX, barY, barW, barH);

    const front = this.add.graphics();
    this.load.on("progress", (v: number) => {
      front.clear();
      front.fillStyle(COLORS.gold, 1);
      front.fillRect(barX, barY, barW * v, barH);
    });

    // Music — required.
    for (const f of MUSIC_FILES) this.load.audio(f.key, f.src);

    // Manifest — optional. Failed loads are silently dropped; the procedural
    // fallback handles missing assets. We mark each successful load so art
    // helpers know which entries are real.
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
      // Phaser uses the asset id as the texture key; mark it loaded.
      markLoaded(key);
    });
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      markFailed(file.key);
    });

    for (const entry of MANIFEST) {
      switch (entry.kind) {
        case "image":
          this.load.image(entry.id, entry.path);
          break;
        case "spritesheet":
          if (entry.frame) {
            this.load.spritesheet(entry.id, entry.path, {
              frameWidth: entry.frame.w,
              frameHeight: entry.frame.h
            });
          }
          break;
        case "audio":
          this.load.audio(entry.id, entry.path);
          break;
      }
    }
  }

  create(): void {
    // Build animations from any spritesheets that successfully loaded.
    registerUnitAnimations(this);
    this.scene.start("TitleScene");
  }
}
