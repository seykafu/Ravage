// Music identifiers + file manifest — the Phaser-FREE half of the audio layer.
//
// Why this is split out from Music.ts: the MusicManager class in Music.ts
// imports Phaser (it drives Phaser.Sound + tweens at runtime). Static content
// data — battles.ts, story/beats.ts — references the MUSIC *constants* to tag
// which track a scene/battle plays, and nothing more. Keeping those constants
// here, in a module with NO Phaser import, means the content graph never pulls
// Phaser transitively. That in turn lets content be unit-tested under the plain
// `node` vitest env (see src/data/__tests__/contentExpressions.test.ts) without
// stubbing a browser, and keeps the door open for any future content tooling
// that runs outside the game.
//
// Music.ts re-exports everything here, so existing `from "../audio/Music"`
// imports keep working unchanged — only content modules were repointed to
// import directly from this file.

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

export interface AudioFile { key: MusicKey; src: string; }
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
