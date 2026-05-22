import Phaser from "phaser";

// Music identifiers map 1:1 to files in /public/audio/.
// Every track in the user's Music folder is referenced at least once across the game.
export const MUSIC = {
  enteringStronghold: "music_entering_stronghold", // Battle 1: Palace Coup
  strongholdMemories: "music_stronghold_memories", // First boss (Battle 5 — Ndara & Ndari)
  finalBoss: "music_final_boss",                   // Final battle
  adventure1: "music_adventure_1",                 // Opening adventure flashback
  adventureAnthros: "music_adventure_anthros",     // Overworld / world map (Anthros side)
  battlePrep: "music_battle_prep",                 // Battle preparation screen
  danger: "music_danger",                          // Battle 2 (farmland) and ambushes
  everydayAnthros: "music_everyday_anthros",       // Story scenes in Thuling (legacy)
  lifeInGrude: "music_life_grude",                 // Act 2 (Grude sections, placeholders)

  // Spine of the World — original theme suite, recurring leitmotif
  mainTheme: "music_spine_main",                   // Title screen — the leitmotif
  battleTheme: "music_spine_battle",               // Non-boss battle (variant A)
  battleTheme2: "music_spine_battle2",             // Non-boss battle (variant B)
  emotional: "music_spine_emotional",              // Heavy story moments
  everydayLife: "music_spine_everyday",            // Light everyday story scenes
  trailer: "music_spine_trailer",                  // Epic story openings + credits finale

  // Standalone single — heist/coup energy, used for the night-of-the-coup
  // story arc that briefs Amar's vanguard right before Battle 1.
  ravageDaredevil: "music_ravage_daredevil",

  // Sadness palette — used for grief beats that need a different texture
  // than the broader "emotional" Spine cue. Sadness2 specifically scores
  // the B1 capture sequence (Selene injured, Ranatoli pinned, Amar
  // captured) — fades in when the before_victory dialogue starts and
  // fades back to the previous track when EndScene transitions in.
  sadness:  "music_sadness",
  sadness2: "music_sadness2",
  // Death — scores the actual death of a sympathetic character in the
  // latter half of the campaign: the moment a sacrifice lands or a
  // chosen path costs someone their life. Heavier + more final than
  // the sadness cues, which carry grief AFTER the fact. First used on
  // Rose's death (B13). Reserved for second-half (B12+) deaths.
  death:    "music_death",

  // Grude battle palette — first track in the second-half of the campaign
  // (B12+). Used for the Grude harbor district fight where the squad lands
  // in the empire's capital and Archbold's men intercept them on the dock.
  grudeBattle1: "music_grude_battle1"
} as const;
export type MusicKey = (typeof MUSIC)[keyof typeof MUSIC];

interface AudioFile { key: MusicKey; src: string; }
export const MUSIC_FILES: AudioFile[] = [
  { key: MUSIC.enteringStronghold, src: "audio/entering_the_stronghold.mp3" },
  { key: MUSIC.strongholdMemories, src: "audio/stronghold_of_memories.mp3" },
  { key: MUSIC.finalBoss,          src: "audio/final_boss1.mp3" },
  { key: MUSIC.adventure1,         src: "audio/adventure_1.mp3" },
  { key: MUSIC.adventureAnthros,   src: "audio/adventure_in_anthros.mp3" },
  { key: MUSIC.battlePrep,         src: "audio/battle_preparation.mp3" },
  { key: MUSIC.danger,             src: "audio/danger.mp3" },
  { key: MUSIC.everydayAnthros,    src: "audio/everyday_in_anthros.mp3" },
  { key: MUSIC.lifeInGrude,        src: "audio/life_in_grude.mp3" },
  { key: MUSIC.mainTheme,          src: "audio/Spine of the World - Main Game Theme.mp3" },
  { key: MUSIC.battleTheme,        src: "audio/Spine of the World - Battle.mp3" },
  { key: MUSIC.battleTheme2,       src: "audio/Spine of the World - Battle 2.mp3" },
  { key: MUSIC.emotional,          src: "audio/Spine of the World - Emotional Scenes.mp3" },
  { key: MUSIC.everydayLife,       src: "audio/Spine of the World - Everyday.mp3" },
  { key: MUSIC.trailer,            src: "audio/Spine of the World - Trailer.mp3" },
  { key: MUSIC.ravageDaredevil,    src: "audio/Ravage_Daredevil.mp3" },
  { key: MUSIC.sadness,            src: "audio/Sadness.mp3" },
  { key: MUSIC.sadness2,           src: "audio/Sadness2.mp3" },
  { key: MUSIC.grudeBattle1,       src: "audio/GrudeBattle1.mp3" },
  { key: MUSIC.death,              src: "audio/Death.mp3" }
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
    // setTimeout backup — runs even if the scene is gone. Each step in its own
    // try/catch so a thrown stop() can't skip destroy() and leak a looped sound.
    setTimeout(() => {
      try { if ("setVolume" in s) (s as Phaser.Sound.WebAudioSound).setVolume(0); } catch { /* */ }
      try { s.stop(); } catch { /* */ }
      try { s.destroy(); } catch { /* */ }
    }, fadeMs + 120);
  }

  // Belt-and-suspenders: stop any music-key sound still running in Phaser's
  // global sound manager that isn't the one we're about to keep.
  private killOrphans(keep: Phaser.Sound.BaseSound | null): void {
    const mgr = this.scene.sound as unknown as { sounds?: Phaser.Sound.BaseSound[] };
    const list = mgr.sounds;
    if (!list) return; // NoAudioSoundManager — nothing to sweep.
    const musicKeys = new Set<string>(Object.values(MUSIC));
    for (const s of [...list]) {
      if (s === keep) continue;
      if (!musicKeys.has(s.key)) continue;
      try { s.stop(); } catch { /* */ }
      try { s.destroy(); } catch { /* */ }
    }
  }

  play(key: MusicKey, opts: { loop?: boolean; fadeMs?: number } = {}): void {
    const { loop = true, fadeMs = 700 } = opts;

    // Ensure the WebAudio context is running BEFORE the same-key check
    // below. A scene transition can leave the context in "suspended" for
    // a few ms — during that window an existing sound's isPlaying flag
    // can lie (still true while actual audio is silent). Resuming here
    // first means the same-key short-circuit sees an honest state.
    const sm = this.scene.sound as unknown as { context?: AudioContext };
    if (sm.context && sm.context.state === "suspended") {
      void sm.context.resume();
    }

    // ---- Same-track continuity ----
    //
    // Load-bearing for seamless cross-scene audio. When two consecutive
    // scenes call play() with the same MusicKey, we DON'T restart the
    // track — the player should experience uninterrupted audio across
    // the transition. Examples this protects:
    //   * Two chained StoryScene arcs that share arc.music (e.g., a
    //     pre/post pair both using "danger")
    //   * Camp → BattlePrep → Battle when consecutive scenes happen
    //     to share a cue
    //   * Same battle re-loaded after a Try Again that didn't change
    //     the music underneath
    //
    // Three states the existing sound might be in:
    //   isPlaying           → no-op, just snap volume to target in case
    //                         a previous fade was interrupted
    //   isPaused            → resume() and return (Phaser can pause
    //                         sounds briefly on some scene transitions)
    //   neither / destroyed → stale reference; fall through to a fresh
    //                         play with the normal fade-in
    if (this.currentKey === key && this.current) {
      const s = this.current as Phaser.Sound.WebAudioSound;
      if (s.isPlaying) {
        // Snap volume so a half-finished prior fade doesn't leave the
        // track stuck quiet across the seam.
        if ("setVolume" in s) s.setVolume(this.targetVolume);
        return;
      }
      if (s.isPaused) {
        try { s.resume(); } catch { /* fall through to fresh play */ }
        if (s.isPlaying) {
          if ("setVolume" in s) s.setVolume(this.targetVolume);
          return;
        }
      }
      // Sound exists but isn't playing or paused — stale ref, fall
      // through. The retire below will clean it up before fresh play.
    }

    // Retire the tracked sound first so a play() failure below can't strand it.
    if (this.current) this.retireSound(this.current, fadeMs);

    const sound = this.scene.sound.add(key, { loop, volume: 0 });
    try { sound.play(); } catch { /* autoplay blocked — track anyway */ }
    // Sweep any orphaned music sounds we may have lost track of (e.g. across
    // scene transitions where a prior retire never completed).
    this.killOrphans(sound);
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

    // Retry-on-unlock: if context.resume() raced with play() and the sound
    // is still not playing 250ms in, force a second play() attempt now that
    // the context should be running. Most of the time this is a no-op (the
    // first play already worked); when it fires, it salvages the silent-arc
    // bug instead of leaving the player in eerie quiet.
    setTimeout(() => {
      if (this.current === sound && !sound.isPlaying) {
        try { sound.play(); } catch { /* */ }
        if (import.meta.env.DEV && !sound.isPlaying) {
          // eslint-disable-next-line no-console
          console.warn(`[MusicManager] Track "${key}" failed to start. AudioContext state: ${sm.context?.state ?? "n/a"}`);
        }
      }
    }, 250);
  }

  stop(fadeMs = 500): void {
    const old = this.current;
    this.current = null;
    this.currentKey = null;
    if (old) this.retireSound(old, fadeMs);
    // Sweep any orphan music sounds the manager may have lost track of.
    this.killOrphans(null);
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
