// Authoritative combat domain types for Ravage.
// Per spec: Speed-based initiative, Action Points, Ready stance, weapon triangle.

export type Faction = "player" | "enemy" | "ally";

export type WeaponKind = "sword" | "spear" | "shield" | "bow" | "dactyl";

export type ClassKind =
  | "swordsman"
  | "spearton"
  | "knight"
  | "archer"
  | "shinobi"
  | "sentinel"
  | "dactyl_rider"
  | "swordmaster"
  | "boss";

export type Stance = "none" | "defensive" | "ready";

// Special abilities. A unit may have at most MAX_ABILITIES (2).
//   BossFighter: 2× damage vs. boss-class enemies.
//   Aide:        2× defense (incoming dmg ×0.5) when adjacent to another ally.
//   Destruct:    on death, the killing blow's attacker also dies.
//   Roam:        once per turn, after AP is spent, the unit may consume 1 extra
//                AP to make a single additional Move.
export type Ability = "BossFighter" | "Aide" | "Destruct" | "Roam";
export const MAX_ABILITIES = 2;

// Battle inventory. Capped at MAX_INVENTORY (5) per unit.
export type ItemKind = "potion";
export interface Item {
  id: string;       // unique per-unit instance id
  kind: ItemKind;
  name: string;
  uses: number;     // remaining uses (potion = 1)
}
export const MAX_INVENTORY = 5;
export const POTION_HEAL = 10;

export interface UnitStats {
  hp: number;
  power: number;
  armor: number;
  speed: number;
  movement: number;
  ap: number;
}

// Per-stat % chance to gain +1 on level up. See src/combat/Progression.ts and
// the "Stat Growths" table in docs/RAVAGE_DESIGN.md. Each field is a 0–100
// integer; a value of 0 means the stat will never grow naturally.
//
// Movement growth is intentionally rare across all characters — speed already
// scales tactical reach, and movement creep breaks map design.
export interface GrowthTable {
  hp: number;
  power: number;
  armor: number;
  speed: number;
  movement: number;
}

// Levels and XP. Cap, threshold, and reward formulas live in Progression.ts.
// `level` is required on every UnitDef so the level-difference XP modifier
// works without scattered fallbacks. `growths` is optional — enemies and
// units who don't progress (bosses) leave it undefined and are treated as
// non-growing for level-up purposes.
export const LEVEL_CAP = 20;
export const XP_PER_LEVEL = 100;

export interface UnitDef {
  id: string;
  name: string;
  shortName: string; // 2 letters for tile label
  faction: Faction;
  classKind: ClassKind;
  weapon: WeaponKind;
  stats: UnitStats;
  // Procedural-art seed: visual deterministically generated from this number.
  artSeed: number;
  // Optional palette override (hex 0xRRGGBB).
  palette?: { primary: number; secondary: number; accent: number };
  // Boss / named unit gets a portrait.
  portrait?: boolean;
  // Optional override for the portrait asset key. Use this when a unit's `id`
  // is an alias of a canonical character (e.g. "amar_true" in Battle 1 is the
  // same character as "amar" but with a different statline) so the side-panel
  // avatar still routes to the right portrait file.
  portraitId?: string;
  // Optional override for the in-battle sprite class. Use this when a unit's
  // `classKind` (which drives mechanics — mountBonus, AP, etc.) doesn't
  // have a shipped sprite folder under public/assets/sprites/. Without this,
  // ensureUnitTexture in UnitArt.ts silently falls back to the procedural
  // pixel-art generator, which looks notably worse than the asset sprites.
  // E.g., Kian is class "knight" mechanically (gets the +2 mount bonus) but
  // renders as "swordmaster" until knight sprites ship.
  spriteClassOverride?: ClassKind;
  // Optional tag set used by AI scoring (e.g., "boss" forces the AI to be more aggressive).
  tags?: ReadonlySet<string>;
  // Up to MAX_ABILITIES special abilities granted at unit creation.
  abilities?: Ability[];
  // Progression. Required field; the XP reward formula needs both attacker
  // and defender level to compute the level-diff modifier without fallbacks.
  // Player factories set their character's narratively-correct starting
  // level (e.g., post-amnesia Amar = 3, original-8 Amar = 10). Enemy
  // factories take a `level` parameter so battle authors can tune
  // difficulty per fight (cap is LEVEL_CAP = 20).
  level: number;
  // Per-stat % chance to gain +1 on level up. Optional; units without a
  // growths table simply don't roll new stats on level up (used for
  // single-encounter bosses and the like).
  growths?: GrowthTable;
}

export interface UnitState {
  hp: number;
  apRemaining: number;
  stance: Stance;
  // Cumulative XP earned at this unit's CURRENT level. Drains by XP_PER_LEVEL
  // each time the unit levels up; capped implicitly when level == LEVEL_CAP
  // (no further XP is awarded). Persisted across battles via SaveState.
  xp: number;
  hasUsedRepositionStep: boolean;
  hasActedThisRound: boolean;
  // Set true the first time beginUnitTurn runs for this unit in a round, and
  // cleared on round advance. Guards against AP being refilled when the
  // player swaps off a partially-used unit and clicks back to it.
  hasStartedTurnThisRound: boolean;
  position: TilePos;
  facingX: 1 | -1;
  alive: boolean;
  inventory: Item[];
  // Roam tracks per-turn use: reset at the start of each turn.
  roamUsedThisTurn: boolean;
}

export type Unit = UnitDef & { state: UnitState };

export interface TilePos {
  x: number;
  y: number;
}

export type TerrainKind =
  // Core 8 — the original procedural set
  | "grass"
  | "stone"
  | "dirt"
  | "wood"
  | "water"
  | "carpet"
  | "snow"
  | "mud"
  // Main asset set — real PNGs in public/assets/tiles/
  | "marble"
  | "sand"
  | "forest"
  | "wall"
  | "door"
  | "rubble"
  // Bonus asset set — additional environment variety
  | "cobblestone"
  | "cracked_earth"
  | "ice"
  | "lava"
  | "moss_stone";

export type ObstacleKind =
  | "none"
  | "hay"
  | "fence"
  | "wagon"
  | "barricade"
  | "pillar"
  | "throne"
  | "tree"
  | "rock"
  | "torch";

export interface Tile {
  pos: TilePos;
  terrain: TerrainKind;
  obstacle: ObstacleKind;
  defendBonus: number; // Extra defender mod (e.g. fence = 0.85x damage taken)
  blocksMovement: boolean;
  blocksLineOfSight: boolean;
  hitPenalty: number; // Subtracted from attacker's hit rate when defender stands here.
}

export interface MapDef {
  id: string;
  name: string;
  width: number;
  height: number;
  // Row-major tile data: width*height entries.
  tiles: ReadonlyArray<{
    terrain: TerrainKind;
    obstacle?: ObstacleKind;
  }>;
  ambientPalette?: { sky: number; ground: number; tint: number };
  startPositions: { player: TilePos[]; enemy: TilePos[]; ally?: TilePos[] };
}

export interface AttackPreview {
  damage: number;
  hitRate: number;
  critRate: number;
  weaponMod: number;
  terrainMod: number;
  stanceMod: number;
}

export interface AttackResult {
  hit: boolean;
  crit: boolean;
  damage: number;
  attackerId: string;
  defenderId: string;
  defenderRemainingHp: number;
  defenderKilled: boolean;
  counterTriggered: boolean;
  counterResult?: AttackResult;
  // Destruct ability: defender's death also killed the attacker.
  destructTriggered?: boolean;
  attackerKilled?: boolean;
}
