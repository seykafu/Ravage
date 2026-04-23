import Phaser from "phaser";
import { MUSIC_FILES } from "../audio/Music";
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";

// Loads music files (the only large external assets) then hands off to TitleScene.
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

    for (const f of MUSIC_FILES) this.load.audio(f.key, f.src);
  }

  create(): void {
    this.scene.start("TitleScene");
  }
}
