import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { StoryScene } from "./scenes/StoryScene";
import { OverworldScene } from "./scenes/OverworldScene";
import { BattlePrepScene } from "./scenes/BattlePrepScene";
import { BattleScene } from "./scenes/BattleScene";
import { EndScene } from "./scenes/EndScene";
import { CreditsScene } from "./scenes/CreditsScene";
import { GAME_WIDTH, GAME_HEIGHT } from "./util/constants";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.WEBGL,
  parent: "app",
  backgroundColor: "#05060a",
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  pixelArt: true,
  roundPixels: true,
  antialias: false,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  fps: { target: 60, forceSetTimeOut: false },
  scene: [
    BootScene,
    TitleScene,
    StoryScene,
    OverworldScene,
    BattlePrepScene,
    BattleScene,
    EndScene,
    CreditsScene
  ]
};

new Phaser.Game(config);

const loader = document.getElementById("loader");
if (loader) {
  setTimeout(() => loader.classList.add("hidden"), 600);
}
