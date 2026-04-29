import type { UnitDef } from "../combat/types";
import { ENEMY_PALETTES, PLAYER_PALETTES } from "../art/palettes";

export const PLAYERS = {
  amar: (): UnitDef => ({
    id: "amar",
    name: "Amar",
    shortName: "Am",
    faction: "player",
    classKind: "swordsman",
    weapon: "sword",
    // Hero-of-the-story bump: a touch more HP, hit, and footwork than the rest.
    stats: { hp: 38, power: 12, armor: 5, speed: 9, movement: 5, ap: 3 },
    artSeed: 1,
    palette: PLAYER_PALETTES.amar,
    portrait: true,
    abilities: ["BossFighter"]
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
    abilities: ["BossFighter"]
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
    abilities: ["Aide"]
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
    abilities: ["Aide"]
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
    abilities: ["Aide"]
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
    abilities: ["Destruct", "Roam"]
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
    abilities: ["Destruct"]
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
    portrait: true
  }),
  // Kian rides with Amar's squad in early battles (b04 swamp ambush, b07
  // monastery, b08 Orinhal escort). Knight-class, mounted: gets the +2
  // movement bonus from Actions.mountBonus, so effective movement = 6 —
  // notably more mobile than Lucian (spearton, eff. mv 3) and on par with
  // Leo (dactyl_rider, eff. mv 7). Sword + decent armor makes him a
  // reliable melee anchor without overshadowing Amar's hero stat-line.
  // Same `id` ("kian") will be reused by an enemy factory once he turns
  // hostile in b10/b11 — palette already lives in both PLAYER_PALETTES
  // and ENEMY_PALETTES under the same key for that reason.
  kian: (): UnitDef => ({
    id: "kian",
    name: "Kian",
    shortName: "Ki",
    faction: "player",
    classKind: "knight",
    weapon: "sword",
    stats: { hp: 32, power: 11, armor: 6, speed: 7, movement: 4, ap: 3 },
    artSeed: 8,
    palette: PLAYER_PALETTES.kian,
    portrait: true
  })
};

export const ENEMIES = {
  banditSwordsman: (id: string, seed: number): UnitDef => ({
    id,
    name: "Bandit",
    shortName: "Bd",
    faction: "enemy",
    classKind: "swordsman",
    weapon: "sword",
    stats: { hp: 22, power: 8, armor: 3, speed: 6, movement: 4, ap: 3 },
    artSeed: seed,
    palette: ENEMY_PALETTES.bandit
  }),
  banditArcher: (id: string, seed: number): UnitDef => ({
    id,
    name: "Raider",
    shortName: "Rd",
    faction: "enemy",
    classKind: "archer",
    weapon: "bow",
    stats: { hp: 18, power: 7, armor: 2, speed: 7, movement: 4, ap: 2 },
    artSeed: seed,
    palette: ENEMY_PALETTES.bandit_archer
  }),
  banditSpearton: (id: string, seed: number): UnitDef => ({
    id,
    name: "Reaver",
    shortName: "Rv",
    faction: "enemy",
    classKind: "spearton",
    weapon: "spear",
    stats: { hp: 26, power: 10, armor: 5, speed: 5, movement: 3, ap: 2 },
    artSeed: seed,
    palette: ENEMY_PALETTES.bandit
  }),
  royalGuard: (id: string, seed: number): UnitDef => ({
    id,
    name: "Royal Guard",
    shortName: "RG",
    faction: "enemy",
    classKind: "spearton",
    weapon: "spear",
    stats: { hp: 30, power: 11, armor: 7, speed: 6, movement: 3, ap: 2 },
    artSeed: seed,
    palette: ENEMY_PALETTES.royal_guard
  }),
  royalArcher: (id: string, seed: number): UnitDef => ({
    id,
    name: "Crown Archer",
    shortName: "Ca",
    faction: "enemy",
    classKind: "archer",
    weapon: "bow",
    stats: { hp: 22, power: 9, armor: 3, speed: 8, movement: 4, ap: 2 },
    artSeed: seed,
    palette: ENEMY_PALETTES.royal_guard
  }),
  ndari: (): UnitDef => ({
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
    tags: new Set(["boss"])
  }),
  kingNebu: (): UnitDef => ({
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
    tags: new Set(["boss"])
  })
};
