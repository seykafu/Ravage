import Phaser from "phaser";
import { MUSIC, MUSIC_FILES, getMusic, type MusicKey } from "../audio/Music";
import { MANIFEST, versionedPath } from "../assets/manifest";
import { wireLoaderBookkeeping } from "../assets/streaming";
import { registerUnitAnimations } from "../assets/animations";

// AssetStreamScene — the invisible background half of the two-stage
// asset pipeline.
//
// The game ships ~440MB of optional art and music (300MB of portraits
// alone). BootScene used to front-load ALL of it before the title
// screen could appear — on anything slower than warm-cache broadband,
// "ravage.game/play" sat on the loading bar for minutes and read as
// simply broken. Boot now loads only the title theme; this scene is
// launched alongside TitleScene and streams everything else while the
// player reads the menu, picks a slot, and plays the opening scenes.
//
// Nothing waits on this scene. Every asset in the game is optional by
// architecture: art helpers check hasAsset()/textures.exists() at USE
// time and fall back procedurally, dialogue portraits fall back to base
// then to the painter, and MusicManager.play() now holds a pending key
// until the track lands (see Music.ts). Whatever hasn't arrived when a
// scene needs it simply pops in on the next lookup.
//
// Queue order is priority order:
//   1. remaining music (battle prep + the early-game themes first in
//      file order; a silent first battle is the most noticeable gap)
//   2. board art: tiles, obstacles, sprites, backdrops, vfx, ui, camp
//   3. portrait BASES (one per character — dialogue renders correctly
//      with these alone; expressions refine later)
//   4. portrait EXPRESSIONS (the 300MB tail)
export class AssetStreamScene extends Phaser.Scene {
  constructor() { super("AssetStreamScene"); }

  create(): void {
    wireLoaderBookkeeping(this);

    // Wake the music manager the moment its pending track arrives.
    const musicKeys = new Set<string>(MUSIC_FILES.map((f) => f.key));
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
      if (musicKeys.has(key)) {
        getMusic(this).onTrackLoaded(key as MusicKey);
      }
    });

    // 1. Music (minus the title theme BootScene already fetched).
    for (const f of MUSIC_FILES) {
      if (f.key === MUSIC.mainTheme) continue;
      this.load.audio(f.key, versionedPath(f.src));
    }

    // 2-4. Manifest, partitioned so the heavy portrait tail goes last.
    const isPortrait = (id: string): boolean => id.startsWith("portrait:");
    const isExpression = (id: string): boolean => isPortrait(id) && id.split(":").length === 3;
    const ordered = [
      ...MANIFEST.filter((e) => !isPortrait(e.id)),
      ...MANIFEST.filter((e) => isPortrait(e.id) && !isExpression(e.id)),
      ...MANIFEST.filter((e) => isExpression(e.id))
    ];
    for (const entry of ordered) {
      switch (entry.kind) {
        case "image":
          this.load.image(entry.id, versionedPath(entry.path));
          break;
        case "spritesheet":
          if (entry.frame) {
            this.load.spritesheet(entry.id, versionedPath(entry.path), {
              frameWidth: entry.frame.w,
              frameHeight: entry.frame.h
            });
          }
          break;
        case "audio":
          this.load.audio(entry.id, versionedPath(entry.path));
          break;
      }
    }

    // Register animations as sheets arrive (idempotent — existing keys
    // skip), and once more at the end for stragglers.
    this.load.on(Phaser.Loader.Events.FILE_COMPLETE, (key: string) => {
      if (key.startsWith("unit:")) registerUnitAnimations(this);
    });
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      registerUnitAnimations(this);
    });

    this.load.start();
  }
}
