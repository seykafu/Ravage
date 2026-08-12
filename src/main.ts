import Phaser from "phaser";
import { BootScene } from "./scenes/BootScene";
import { AssetStreamScene } from "./scenes/AssetStreamScene";
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
import { InterposeScene } from "./scenes/InterposeScene";
import { InventoryScene } from "./scenes/InventoryScene";
import { CampScene } from "./scenes/CampScene";
import { GameOverScene } from "./scenes/GameOverScene";
import { ChoiceScene } from "./scenes/ChoiceScene";
import { GAME_WIDTH, GAME_HEIGHT, RENDER_SCALE } from "./util/constants";
import { installCrispText } from "./util/crispText";
import { installRenderScale } from "./util/renderScale";

const config: Phaser.Types.Core.GameConfig = {
  // AUTO, not WEBGL: on machines where WebGL context creation is refused
  // (driver blocklists, exhausted contexts, remote desktops), strict
  // WEBGL made the Game constructor THROW — main.ts died before the
  // loader-hide ever ran and the player sat on "Ravage — loading…"
  // forever. AUTO falls back to the Canvas renderer: no post-FX, but a
  // playable game (every postFX call site guards on renderer type).
  type: Phaser.AUTO,
  parent: "app",
  backgroundColor: "#05060a",
  // Backing buffer = design size x RENDER_SCALE (native-resolution render).
  // The logical/design space stays GAME_WIDTH x GAME_HEIGHT everywhere; the
  // camera patch in installRenderScale() maps it onto this bigger buffer.
  // RENDER_SCALE === 1 → unchanged 1280x720.
  width: GAME_WIDTH * RENDER_SCALE,
  height: GAME_HEIGHT * RENDER_SCALE,
  // NOTE: when a `render` block exists, Phaser's Config reads ALL render
  // settings from it and ignores same-named top-level keys — so the
  // pixelArt/roundPixels/antialias trio lives inside it, not beside it.
  render: {
    pixelArt: true,
    roundPixels: true,
    antialias: false,
    // Dual-GPU laptops default WebGL to the battery-saving integrated
    // chip; at a 2560×1440 native-res buffer with post-FX that's the
    // difference between 60fps and a slideshow. Ask for the real GPU.
    powerPreference: "high-performance"
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  fps: { target: 60, forceSetTimeOut: false },
  scene: [
    // Page scenes — register first so overlay scenes (added below)
    // render ON TOP of them. Phaser draws scenes in array order;
    // later-added scenes have higher render priority. Camp Hub
    // commit shipped CampScene at the END of the array, which made
    // its overlay launches (BattleDialogueScene for character idle
    // talk, RosterScene, InventoryScene) render BEHIND the camp
    // and disappear. Fixed by moving CampScene up here with the
    // other "page" scenes.
    BootScene,
    // Invisible background asset streamer — launched by BootScene at
    // title handoff, never stopped. See scenes/AssetStreamScene.ts.
    AssetStreamScene,
    TitleScene,
    IntroVideoScene,
    AuthScene,
    SaveSlotScene,
    StoryScene,
    OverworldScene,
    CampScene,
    BattlePrepScene,
    BattleScene,
    EndScene,
    GameOverScene,
    ChoiceScene,
    CreditsScene,
    // Overlay scenes — register last so they render ON TOP of any
    // active page scene. Each is launched via scene.run() while the
    // launcher is paused via scene.pause().
    SettingsScene,
    PromotionScene,
    BattleDialogueScene,
    RosterScene,
    InterposeScene,
    InventoryScene
  ]
};

// Patch Phaser's text factory BEFORE game construction so every
// scene.add.text(...) call across the game gets crisp 2x/3x density
// glyphs sampled with LINEAR instead of nearest-neighbor — on every
// display, including ordinary 1x monitors where the blur was worst.
// See src/util/crispText.ts for the full rationale.
installCrispText();

// EXPERIMENTAL native-resolution rendering — zooms every camera by
// RENDER_SCALE so the 1280x720 design maps onto the enlarged backing
// buffer. No-op when RENDER_SCALE === 1. Must run before game construction
// (it patches CameraManager, which every scene's boot uses). See
// src/util/renderScale.ts.
installRenderScale();

// Wait for the self-hosted fonts BEFORE constructing the game. Phaser
// measures every Text object against whatever font is available at
// creation time and never re-measures — when the web fonts hadn't
// arrived yet (or, before self-hosting, when fonts.googleapis.com was
// blocked outright), the whole UI was laid out against a fallback
// serif: the title overflowed the screen, labels spilled out of their
// buttons. The 3s race means a missing font file can only ever delay
// boot, never prevent it.
const fontsReady = (): Promise<unknown> => {
  try {
    const probes = [
      "700 40px 'Cinzel Decorative'",
      "600 20px 'Cinzel'",
      "400 16px 'EB Garamond'",
      "400 16px 'Inter'"
    ].map((f) => document.fonts.load(f));
    return Promise.race([
      Promise.all([...probes, document.fonts.ready]),
      new Promise((r) => setTimeout(r, 3000))
    ]);
  } catch {
    return Promise.resolve();
  }
};

// If construction still throws (no renderer at all), say so on the
// loader instead of leaving "loading…" up forever — the failure text is
// what turns a dead-site report into a fixable bug report.
const constructGame = (): Phaser.Game => {
  try {
    return new Phaser.Game(config);
  } catch (err) {
    const loaderEl = document.getElementById("loader");
    if (loaderEl) {
      loaderEl.innerHTML =
        "Ravage — failed to start.<br><small style=\"text-transform:none;letter-spacing:normal\">" +
        String(err instanceof Error ? err.message : err).replace(/</g, "&lt;") +
        "<br>Please report this — a screenshot of this message is enough.</small>";
    }
    throw err;
  }
};

// Detect canvas-fingerprint defenses. Privacy extensions (CanvasBlocker,
// JShelter, hardened profiles) add random noise to canvas text metrics —
// and Phaser lays out every Text object from exactly those metrics, so a
// poisoned profile renders oversized, overflowing text no matter which
// fonts loaded. Honest browsers return IDENTICAL widths for identical
// measureText calls; spoofers don't. Measuring the same string repeatedly
// is therefore an exact, zero-false-positive detector. We still boot —
// the game is degraded, not dead — but the player learns WHY it looks
// wrong and how to fix it, instead of blaming the game.
const detectCanvasInterference = (): boolean => {
  try {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    if (!ctx) return false;
    ctx.font = "32px 'Cinzel', serif";
    const widths = new Set<number>();
    for (let i = 0; i < 6; i++) {
      widths.add(ctx.measureText("Ravage — the spine of the world").width);
    }
    return widths.size > 1;
  } catch {
    return false;
  }
};

void fontsReady().then(() => {
  if (detectCanvasInterference()) {
    const note = document.createElement("div");
    note.style.cssText =
      "position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:9998;" +
      "max-width:640px;background:#0d111c;border:1px solid #c9b07a;color:#e8eaf2;" +
      "padding:12px 40px 12px 16px;font:14px/1.45 'EB Garamond',Georgia,serif;" +
      "box-shadow:0 8px 32px rgba(0,0,0,.6)";
    note.innerHTML =
      "A browser extension appears to be altering canvas rendering (anti-fingerprinting). " +
      "Ravage draws everything on canvas, so text and layout will look wrong. " +
      "Allow canvas access for this site, or try another browser/profile." +
      "<span style=\"position:absolute;top:6px;right:12px;cursor:pointer;font-size:18px\" " +
      "onclick=\"this.parentElement.remove()\">×</span>";
    document.body.appendChild(note);
  }
  const game = constructGame();
  wireGame(game);
});

function wireGame(game: Phaser.Game): void {

// With RENDER_SCALE > 1 the backing buffer is LARGER than the window on
// typical displays, so the browser's final canvas scale is a downscale.
// `pixelArt: true` puts `image-rendering: pixelated` on the canvas, which
// makes that downscale nearest-neighbor — shimmering, aliased, and the
// exact blur/crunch this pivot removes. Override to smooth interpolation;
// texture sampling INSIDE the buffer keeps its pixelArt NEAREST default,
// so sprite art stays chunky where it should. No-op at RENDER_SCALE 1.
if (RENDER_SCALE > 1) {
  game.events.once(Phaser.Core.Events.READY, () => {
    game.canvas.style.imageRendering = "auto";
  });
}

// Dev-only: expose the game instance so the browser console (and automated
// preview harnesses) can inspect scene state / warp directly. Stripped from
// production builds by the import.meta.env.DEV guard.
if (import.meta.env.DEV) {
  (window as unknown as { __RAVAGE_GAME__?: Phaser.Game }).__RAVAGE_GAME__ = game;
}

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
}
