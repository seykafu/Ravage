// Shared loader wiring for the two-stage asset pipeline.
//
// Stage 1 (BootScene): the handful of files the title screen actually
// needs. Stage 2 (AssetStreamScene): everything else, streaming in the
// background while the player reads the menu. Both stages need identical
// bookkeeping — mark successes for hasAsset(), swallow 404s (every asset
// has a procedural fallback), and flip the painted high-res art to
// LINEAR filtering (the global pixelArt config would otherwise sample it
// NEAREST and posterize the downscales).

import Phaser from "phaser";
import { markFailed, markLoaded } from "./manifest";

export const wireLoaderBookkeeping = (scene: Phaser.Scene): void => {
  scene.load.setBaseURL("/");
  scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
    markLoaded(key);
    if (
      key.startsWith("portrait:") ||
      key.startsWith("backdrop:") ||
      key.startsWith("tile:") ||
      key.startsWith("obstacle:")
    ) {
      const tex = scene.textures.get(key);
      if (tex) tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  });
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
    markFailed(file.key);
  });
};
