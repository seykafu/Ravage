import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { IntroVideoScene } from "./scenes/IntroVideoScene";
import { StoryScene } from "./scenes/StoryScene";
import { OverworldScene } from "./scenes/OverworldScene";
import { BattlePrepScene } from "./scenes/BattlePrepScene";
import { BattleScene } from "./scenes/BattleScene";
import { EndScene } from "./scenes/EndScene";
import { CreditsScene } from "./scenes/CreditsScene";
import { AuthScene } from "./scenes/AuthScene";
import { SaveSlotScene } from "./scenes/SaveSlotScene";
import { SettingsScene } from "./scenes/SettingsScene";
import { PromotionScene } from "./scenes/PromotionScene";
import { BattleDialogueScene } from "./scenes/BattleDialogueScene";
import { RosterScene } from "./scenes/RosterScene";
import { GAME_WIDTH, GAME_HEIGHT } from "./util/constants";
import { installCrispText } from "./util/crispText";

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
    IntroVideoScene,
    AuthScene,
    SaveSlotScene,
    StoryScene,
    OverworldScene,
    BattlePrepScene,
    BattleScene,
    EndScene,
    CreditsScene,
    SettingsScene,
    PromotionScene,
    BattleDialogueScene,
    RosterScene
  ]
};

// Patch Phaser's text factory BEFORE game construction so every
// scene.add.text(...) call across the game gets crisp 2x/3x density
// glyphs sampled with LINEAR instead of nearest-neighbor. See
// src/util/crispText.ts for the full rationale. No-op on 1x displays.
installCrispText();

const game = new Phaser.Game(config);

const loader = document.getElementById("loader");
if (loader) {
  setTimeout(() => loader.classList.add("hidden"), 600);
}

// ---- Dev-only battle/arc warp panel --------------------------------------
// Press backquote (`) anywhere in the game to open DevJumpScene as a modal
// overlay. Press ` again or click Cancel to return to whatever scene was
// running. The scene class itself is dynamically imported so it's tree-
// shaken out of production builds along with this whole block. See
// src/scenes/DevJumpScene.ts for the panel implementation.
//
// Uses event.code === "Backquote" (physical key, layout-independent) so it
// works on non-US keyboards where ` lives elsewhere.
if (import.meta.env.DEV) {
  void import("./scenes/DevJumpScene").then(({ DevJumpScene }) => {
    game.scene.add("DevJumpScene", DevJumpScene, false);
  });

  let pausedKey: string | null = null;

  window.addEventListener("keydown", (e) => {
    if (e.code !== "Backquote") return;
    // Don't hijack the key while typing into a real input (e.g., Vite error
    // overlay search box, future debug textboxes).
    const t = e.target;
    if (t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement) return;
    e.preventDefault();

    // Toggle: ` while open closes the panel.
    if (game.scene.isActive("DevJumpScene")) {
      game.scene.stop("DevJumpScene");
      if (pausedKey) {
        game.scene.resume(pausedKey);
        pausedKey = null;
      }
      return;
    }

    // Find the topmost active scene to pause. Skip overlay-style scenes
    // (SettingsScene) and our own — they shouldn't be the pause target.
    const active = game.scene.getScenes(true)
      .filter((s) => s.scene.key !== "DevJumpScene" && s.scene.key !== "SettingsScene");
    const target = active[0];
    if (!target) return;

    pausedKey = target.scene.key;
    game.scene.pause(pausedKey);
    game.scene.run("DevJumpScene", { resumeKey: pausedKey });
  });
}
