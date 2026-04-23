import Phaser from "phaser";

// Music identifiers map 1:1 to files in /public/audio/.
// Every track in the user's Music folder is referenced at least once across the game.
export const MUSIC = {
  enteringStronghold: "music_entering_stronghold", // Battle 1: Palace Coup
  strongholdMemories: "music_stronghold_memories", // First boss (Battle 3 Ndari)
  finalBoss: "music_final_boss",                   // Final battle
  adventure1: "music_adventure_1",                 // Title / opening adventure
  adventureAnthros: "music_adventure_anthros",     // Overworld / world map (Anthros side)
  battlePrep: "music_battle_prep",                 // Battle preparation screen
  danger: "music_danger",                          // Battle 2 (farmland) and ambushes
  everydayAnthros: "music_everyday_anthros",       // Story scenes in Thuling
  lifeInGrude: "music_life_grude"                  // Act 2 (Gruge sections, placeholders)
} as const;
export type MusicKey = (typeof MUSIC)[keyof typeof MUSIC];

interface AudioFile { key: MusicKey; src: string; }
export const MUSIC_FILES: AudioFile[] = [
  { key: MUSIC.enteringStronghold, src: "audio/entering_the_stronghold.mp3" },
  { key: MUSIC.strongholdMemories, src: "audio/stronghold_of_memories.mp3" },
  { key: MUSIC.finalBoss,          src: "audio/final_boss_battle.mp3" },
  { key: MUSIC.adventure1,         src: "audio/adventure_1.mp3" },
  { key: MUSIC.adventureAnthros,   src: "audio/adventure_in_anthros.mp3" },
  { key: MUSIC.battlePrep,         src: "audio/battle_preparation.mp3" },
  { key: MUSIC.danger,             src: "audio/danger.mp3" },
  { key: MUSIC.everydayAnthros,    src: "audio/everyday_in_anthros.mp3" },
  { key: MUSIC.lifeInGrude,        src: "audio/life_in_grude.mp3" }
];

// Singleton-ish music manager. Lives across scenes via game.registry.
// Tweens require a Scene context, so we re-bind to the latest scene on each
// getMusic() call (see bottom of file).
export class MusicManager {
  private scene: Phaser.Scene;
  private current: Phaser.Sound.BaseSound | null = null;
  private currentKey: MusicKey | null = null;
  private targetVolume = 0.55;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  bindScene(scene: Phaser.Scene): void {
    this.scene = scene;
  }

  setVolume(v: number): void {
    this.targetVolume = Phaser.Math.Clamp(v, 0, 1);
    if (this.current && "setVolume" in this.current) {
      (this.current as Phaser.Sound.WebAudioSound).setVolume(this.targetVolume);
    }
  }

  isPlaying(key: MusicKey): boolean {
    return this.currentKey === key && !!this.current && this.current.isPlaying;
  }

  // Force-destroy a sound. Safe to call repeatedly. Survives scene shutdown
  // because it doesn't rely on the bound scene's tween manager.
  private retireSound(s: Phaser.Sound.BaseSound, fadeMs: number): void {
    // Tween fade for smoothness — may die if the bound scene shuts down.
    try {
      this.scene.tweens.addCounter({
        from: this.targetVolume,
        to: 0,
        duration: fadeMs,
        onUpdate: (t: Phaser.Tweens.Tween) => {
          try {
            if ("setVolume" in s) (s as Phaser.Sound.WebAudioSound).setVolume(t.getValue() ?? 0);
          } catch { /* sound already destroyed */ }
        }
      });
    } catch { /* scene without tweens */ }
    // setTimeout backup — runs even if the scene is gone.
    setTimeout(() => {
      try {
        if ("setVolume" in s) (s as Phaser.Sound.WebAudioSound).setVolume(0);
        s.stop();
        s.destroy();
      } catch { /* already cleaned up */ }
    }, fadeMs + 120);
  }

  play(key: MusicKey, opts: { loop?: boolean; fadeMs?: number } = {}): void {
    const { loop = true, fadeMs = 700 } = opts;
    if (this.currentKey === key && this.current?.isPlaying) return;
    const sound = this.scene.sound.add(key, { loop, volume: 0 });
    sound.play();
    if (this.current) this.retireSound(this.current, fadeMs);
    this.scene.tweens.addCounter({
      from: 0,
      to: this.targetVolume,
      duration: fadeMs,
      onUpdate: (t: Phaser.Tweens.Tween) => {
        if ("setVolume" in sound) (sound as Phaser.Sound.WebAudioSound).setVolume(t.getValue() ?? 0);
      }
    });
    this.current = sound;
    this.currentKey = key;
  }

  stop(fadeMs = 500): void {
    if (!this.current) return;
    const old = this.current;
    this.current = null;
    this.currentKey = null;
    this.retireSound(old, fadeMs);
  }
}

const REGISTRY_KEY = "ravage:music";

export const getMusic = (scene: Phaser.Scene): MusicManager => {
  let m = scene.game.registry.get(REGISTRY_KEY) as MusicManager | undefined;
  if (!m) {
    m = new MusicManager(scene);
    scene.game.registry.set(REGISTRY_KEY, m);
  } else {
    m.bindScene(scene);
  }
  return m;
};
