import type { GrowthTable, UnitDef } from "../combat/types";
import { ENEMY_PALETTES, PLAYER_PALETTES } from "../art/palettes";

// ---- Player growth tables -----------------------------------------------
// Each value is the % chance for that stat to gain +1 on level up. See
// docs/RAVAGE_DESIGN.md §4.3 for the per-character philosophy. Hero
// characters (Amar) get the highest totals; supports (Ranatoli, Ning)
// trade total points for specialization.
//
// Co-located here rather than scattered into each factory so cross-unit
// balance is comparable at a glance.

const G_AMAR:     GrowthTable = { hp: 70, power: 60, armor: 40, speed: 50, movement: 10 };
const G_LUCIAN:   GrowthTable = { hp: 75, power: 50, armor: 60, speed: 25, movement: 5 };
const G_NING:     GrowthTable = { hp: 50, power: 60, armor: 25, speed: 60, movement: 15 };
const G_MAYA:     GrowthTable = { hp: 50, power: 55, armor: 30, speed: 70, movement: 20 };
const G_LEO:      GrowthTable = { hp: 65, power: 60, armor: 50, speed: 45, movement: 10 };
const G_RANATOLI: GrowthTable = { hp: 80, power: 40, armor: 70, speed: 25, movement: 5 };
const G_SELENE:   GrowthTable = { hp: 60, power: 70, armor: 35, speed: 65, movement: 15 };
const G_KIAN:     GrowthTable = { hp: 65, power: 55, armor: 55, speed: 50, movement: 10 };

// Generic enemy growth tables. Used when a battle author actively chooses
// to give an enemy growths (rare — most enemies are single-encounter). The
// rank-and-file enemy factories leave growths undefined so they don't
// level up mid-battle.
const G_BANDIT:   GrowthTable = { hp: 55, power: 50, armor: 30, speed: 40, movement: 5 };
const G_ROYAL:    GrowthTable = { hp: 65, power: 55, armor: 60, speed: 45, movement: 5 };

export const PLAYERS = {
  amar: (): UnitDef => ({
    id: "amar",
    name: "Amar",
    shortName: "Am",
    faction: "player",
    classKind: "swordsman",
    weapon: "sword",
    // Hero-of-the-story bump: a touch more HP, hit, and footwork than the rest.
    // Post-amnesia statline (see amarHidden for the original-coup version).
    stats: { hp: 38, power: 12, armor: 5, speed: 9, movement: 5, ap: 3 },
    artSeed: 1,
    palette: PLAYER_PALETTES.amar,
    portrait: true,
    abilities: ["BossFighter"],
    // Post-amnesia Amar starts at L1 — the script's "muscle memory intact,
    // raw stats reset" is now a true reset. The player's progression,
    // not the factory default, decides how strong he is. The save's
    // CharacterRecord overrides this on every battle after his first.
    level: 1,
    growths: G_AMAR
  }),
  amarHidden: (): UnitDef => ({
    // Same Amar, but with the "true" combat statline (used in Battle 1 — pre-amnesia).
    id: "amar_true",
    name: "Amar",
    shortName: "Am",
    faction: "player",
    classKind: "swordsman",
    weapon: "sword",
    stats: { hp: 44, power: 15, armor: 6, speed: 11, movement: 5, ap: 3 },
    artSeed: 1,
    palette: PLAYER_PALETTES.amar,
    portrait: true,
    portraitId: "amar",
    abilities: ["BossFighter"],
    // Pre-amnesia Amar is a level-10 veteran — same as the rest of the
    // original coup squad. Doesn't matter for B1 progression (the coup
    // is scripted to fail) but enforces the lore baseline.
    level: 10,
    growths: G_AMAR
  }),
  lucian: (): UnitDef => ({
    id: "lucian",
    name: "Lucian",
    shortName: "Lu",
    faction: "player",
    classKind: "spearton",
    weapon: "spear",
    stats: { hp: 36, power: 11, armor: 6, speed: 5, movement: 3, ap: 2 },
    artSeed: 2,
    palette: PLAYER_PALETTES.lucian,
    portrait: true,
    abilities: ["Aide"],
    level: 1,
    growths: G_LUCIAN
  }),
  ning: (): UnitDef => ({
    id: "ning",
    name: "Ning",
    shortName: "Ni",
    faction: "player",
    classKind: "archer",
    weapon: "bow",
    stats: { hp: 22, power: 9, armor: 3, speed: 9, movement: 4, ap: 2 },
    artSeed: 3,
    palette: PLAYER_PALETTES.ning,
    portrait: true,
    abilities: ["Aide"],
    level: 1,
    growths: G_NING
  }),
  maya: (): UnitDef => ({
    id: "maya",
    name: "Maya",
    shortName: "Ma",
    faction: "player",
    classKind: "shinobi",
    weapon: "sword",
    stats: { hp: 26, power: 10, armor: 3, speed: 11, movement: 5, ap: 3 },
    artSeed: 4,
    palette: PLAYER_PALETTES.maya,
    portrait: true,
    abilities: ["Aide"],
    // Maya joins at L1 — the player's progression decides her curve, not
    // a factory bump. (Earlier versions started her at L2 to reflect her
    // narrative training under Dawn; that's now expressed via the
    // catch-up rule when she joins late, not via the factory.)
    level: 1,
    growths: G_MAYA
  }),
  leo: (): UnitDef => ({
    id: "leo",
    name: "Leo",
    shortName: "Le",
    faction: "player",
    classKind: "dactyl_rider",
    weapon: "dactyl",
    stats: { hp: 30, power: 11, armor: 5, speed: 8, movement: 5, ap: 3 },
    artSeed: 5,
    palette: PLAYER_PALETTES.leo,
    portrait: true,
    abilities: ["Destruct", "Roam"],
    // Leo joins at L1. The script casts him as Fergus's trained son but
    // mechanically he starts where every other post-amnesia recruit
    // starts — the player's level curve decides how strong he gets,
    // not a factory bump. The catch-up rule applies if he joins late
    // relative to the squad's average.
    level: 1,
    growths: G_LEO
  }),
  ranatoli: (): UnitDef => ({
    id: "ranatoli",
    name: "Ranatoli",
    shortName: "Ra",
    faction: "player",
    classKind: "sentinel",
    weapon: "shield",
    stats: { hp: 40, power: 8, armor: 8, speed: 4, movement: 3, ap: 2 },
    artSeed: 6,
    palette: PLAYER_PALETTES.ranatoli,
    portrait: true,
    abilities: ["Destruct"],
    // Original-8 coup veteran. Uses L10 baseline; the catch-up rule in
    // Progression.catchUpToSquad will fast-forward him further if the
    // squad has out-leveled L10 by the time he rejoins.
    level: 10,
    growths: G_RANATOLI
  }),
  selene: (): UnitDef => ({
    id: "selene",
    name: "Selene",
    shortName: "Se",
    faction: "player",
    classKind: "swordmaster",
    weapon: "sword",
    stats: { hp: 30, power: 13, armor: 4, speed: 12, movement: 4, ap: 3 },
    artSeed: 7,
    palette: PLAYER_PALETTES.selene,
    portrait: true,
    // Selene is already a Swordmaster (Tier 2) when the squad meets her
    // at the monastery in B7. L10 baseline + catch-up rule applies.
    level: 10,
    growths: G_SELENE
  }),
  kian: (): UnitDef => ({
    id: "kian",
    name: "Kian",
    shortName: "Ki",
    faction: "player",
    classKind: "knight",
    // No knight sprite folder under public/assets/sprites/ yet. Render as
    // swordmaster (visually distinct from Amar's swordsman, fits Kian's
    // "elite blade in the king's service" framing) until proper knight
    // sprites ship. The "knight" classKind is preserved so Kian still
    // gets the +2 mountBonus from Actions.ts.
    spriteClassOverride: "swordmaster",
    weapon: "sword",
    stats: { hp: 32, power: 11, armor: 6, speed: 7, movement: 4, ap: 3 },
    artSeed: 8,
    palette: PLAYER_PALETTES.kian,
    portrait: true,
    // Kian joins at L1. Same reasoning as Maya/Leo — progression is
    // earned through play, not authored into the factory default.
    level: 1,
    growths: G_KIAN
  })
};

// ---- Enemy factories ----------------------------------------------------
// Every enemy factory takes an explicit `level` parameter so per-battle
// authors can tune difficulty in the call site. The level feeds the XP
// reward formula (level diff modifier in Progression.xpRewardFor) and is
// the hook the future stat-scaling pass will multiply against. For the
// v1 system stats are still hand-authored — battle authors override the
// `stats` field on the returned object if they want a tougher specimen.

// Generic enemy classes share a single portrait per class — every Bandit
// instance shows the same `bandit.png`, every Royal Guard the same
// `royal_guard.png`, etc. portraitId routes the per-instance unit.id
// (e.g., "dawn_sw1") to the shared portrait file via PortraitArt's
// resolution path. portrait: true marks them as eligible for portrait
// rendering at all (the side panel checks this).
export const ENEMIES = {
  banditSwordsman: (id: string, seed: number, level = 2): UnitDef => ({
    id,
    name: "Bandit",
    shortName: "Bd",
    faction: "enemy",
    classKind: "swordsman",
    weapon: "sword",
    stats: { hp: 22, power: 8, armor: 3, speed: 6, movement: 4, ap: 3 },
    artSeed: seed,
    palette: ENEMY_PALETTES.bandit,
    portrait: true,
    portraitId: "bandit",
    level,
    growths: G_BANDIT
  }),
  banditArcher: (id: string, seed: number, level = 2): UnitDef => ({
    id,
    name: "Raider",
    shortName: "Rd",
    faction: "enemy",
    classKind: "archer",
    weapon: "bow",
    stats: { hp: 18, power: 7, armor: 2, speed: 7, movement: 4, ap: 2 },
    artSeed: seed,
    palette: ENEMY_PALETTES.bandit_archer,
    portrait: true,
    portraitId: "raider",
    level,
    growths: G_BANDIT
  }),
  banditSpearton: (id: string, seed: number, level = 3): UnitDef => ({
    id,
    name: "Reaver",
    shortName: "Rv",
    faction: "enemy",
    classKind: "spearton",
    weapon: "spear",
    stats: { hp: 26, power: 10, armor: 5, speed: 5, movement: 3, ap: 2 },
    artSeed: seed,
    palette: ENEMY_PALETTES.bandit,
    portrait: true,
    portraitId: "reaver",
    level,
    growths: G_BANDIT
  }),
  // Royal classes are tagged "elite" — Progression.xpRewardFor treats
  // elite kills as 50 XP base instead of the default 30.
  royalGuard: (id: string, seed: number, level = 6): UnitDef => ({
    id,
    name: "Royal Guard",
    shortName: "RG",
    faction: "enemy",
    classKind: "spearton",
    weapon: "spear",
    stats: { hp: 30, power: 11, armor: 7, speed: 6, movement: 3, ap: 2 },
    artSeed: seed,
    palette: ENEMY_PALETTES.royal_guard,
    portrait: true,
    portraitId: "royal_guard",
    tags: new Set(["elite"]),
    level,
    growths: G_ROYAL
  }),
  royalArcher: (id: string, seed: number, level = 6): UnitDef => ({
    id,
    name: "Crown Archer",
    shortName: "Ca",
    faction: "enemy",
    classKind: "archer",
    weapon: "bow",
    stats: { hp: 22, power: 9, armor: 3, speed: 8, movement: 4, ap: 2 },
    artSeed: seed,
    palette: ENEMY_PALETTES.royal_guard,
    portrait: true,
    portraitId: "crown_archer",
    tags: new Set(["elite"]),
    level,
    growths: G_ROYAL
  }),
  // Bosses don't have growths — they're single-encounter. Battle authors
  // pass an explicit level if they want to override the default.
  ndari: (level = 7): UnitDef => ({
    id: "ndari",
    name: "Ndari",
    shortName: "Nd",
    faction: "enemy",
    classKind: "boss",
    weapon: "sword",
    stats: { hp: 56, power: 13, armor: 6, speed: 9, movement: 4, ap: 3 },
    artSeed: 99,
    palette: ENEMY_PALETTES.ndari,
    portrait: true,
    tags: new Set(["boss"]),
    level
  }),
  kingNebu: (level = 12): UnitDef => ({
    id: "nebu",
    name: "King Nebu IV",
    shortName: "Ne",
    faction: "enemy",
    classKind: "boss",
    weapon: "sword",
    stats: { hp: 70, power: 14, armor: 8, speed: 7, movement: 3, ap: 3 },
    artSeed: 88,
    palette: ENEMY_PALETTES.archbold,
    portrait: true,
    tags: new Set(["boss"]),
    level,
    // Sits on the throne and refuses to engage until only one of his
    // guards remains alive. Reflects the script's framing of B1: the
    // King doesn't expect to need to fight — he expects his guard to
    // repel the assault, and only stirs once the line is nearly broken.
    // The AI early-returns "end" until the threshold is crossed.
    holdPositionUntil: { allyCount: 1 }
  }),
  // Selene as antagonist in Battle 7 (the monastery). She's one of Amar's
  // original coup comrades from B1, surfaced here on a King's wanted poster
  // and leading raiders out of an abandoned monastery in the high passes.
  // Mechanically a swordmaster (Tier 2 already — she joined the original
  // coup pre-promotion-system, narratively a veteran). Tagged "boss" so she
  // gives 100 base XP and triggers the BossFighter bonus when applicable.
  //
  // Distinct unit id ("selene_enemy") so progression saved here doesn't
  // collide with PLAYERS.selene if she's recruited in a future battle —
  // they're the same character fictionally but separate save records.
  // Shares the player portrait via portraitId so the side-panel avatar
  // and dialog scenes route to the same artwork.
  selene: (level = 11): UnitDef => ({
    id: "selene_enemy",
    name: "Selene",
    shortName: "Se",
    faction: "enemy",
    classKind: "swordmaster",
    weapon: "sword",
    stats: { hp: 48, power: 14, armor: 5, speed: 13, movement: 5, ap: 3 },
    artSeed: 7,
    palette: PLAYER_PALETTES.selene,
    portrait: true,
    portraitId: "selene",
    tags: new Set(["boss"]),
    level
  })
};
