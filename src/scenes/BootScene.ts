import Phaser from "phaser";
import { MUSIC, MUSIC_FILES } from "../audio/Music";
import { COLORS, FAMILY_BODY, FAMILY_DISPLAY, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { wireLoaderBookkeeping } from "../assets/streaming";
import { versionedPath } from "../assets/manifest";
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

    // Shared loader bookkeeping (baseURL pin, hasAsset marking, LINEAR
    // filter for painted art) — see src/assets/streaming.ts.
    wireLoaderBookkeeping(this);

    // STAGE 1: only what the title screen needs — the main theme. The
    // game's full payload is ~440MB of optional art and music; loading
    // it all here meant minutes of loading bar on cold caches, which
    // players reported as "the site doesn't load". Everything else
    // streams in the background via AssetStreamScene (launched in
    // create below) while the player sits on the menu. Every asset is
    // optional by architecture — whatever hasn't arrived when a scene
    // needs it falls back procedurally and pops in on the next lookup.
    const mainTheme = MUSIC_FILES.find((f) => f.key === MUSIC.mainTheme);
    if (mainTheme) this.load.audio(mainTheme.key, versionedPath(mainTheme.src));
  }

  create(): void {
    // Apply persisted audio preferences before any music plays.
    applySettings(this);
    // Background-stream the remaining ~440MB. Launched (not started) so
    // it coexists with every scene that follows and never stops.
    this.scene.launch("AssetStreamScene");
    this.scene.start("TitleScene");
  }
}
