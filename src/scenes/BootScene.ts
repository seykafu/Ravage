import Phaser from "phaser";
import { MUSIC_FILES } from "../audio/Music";
import { COLORS, FAMILY_BODY, FAMILY_DISPLAY, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { MANIFEST, markFailed, markLoaded } from "../assets/manifest";
import { registerUnitAnimations } from "../assets/animations";
import { applySettings } from "../util/settings";

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
      fontFamily: FAMILY_DISPLAY,
      fontSize: "72px",
      color: "#c9b07a",
      stroke: "#1a1208",
      strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(cx, cy + 4, "loading the spine of the world…", {
      fontFamily: FAMILY_BODY,
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

    // Pin every asset path to the site root. Manifest entries store paths
    // like "assets/foo.png" / "audio/bar.mp3" without a leading slash, so
    // by default Phaser would resolve them relative to the page's URL. Once
    // the game is hosted at /play/, that turns into /play/assets/... which
    // 404s (the assets are at /assets/). Setting the loader baseURL to "/"
    // makes every subsequent load fetch from the site root regardless of
    // which route hosts the game shell.
    this.load.setBaseURL("/");

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
    // Apply persisted audio preferences before any music plays.
    applySettings(this);
    this.scene.start("TitleScene");
  }
}
