// Authoritative combat domain types for Ravage.
// Per spec: Speed-based initiative, Action Points, Ready stance, weapon triangle.

export type Faction = "player" | "enemy" | "ally";

export type WeaponKind = "sword" | "spear" | "shield" | "bow" | "wyvern";

export type ClassKind =
  | "swordsman"
  | "spearton"
  | "knight"
  | "archer"
  | "shinobi"
  | "sentinel"
  | "wyvern_rider"
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
  // Optional tag set used by AI scoring (e.g., "boss" forces the AI to be more aggressive).
  tags?: ReadonlySet<string>;
  // Up to MAX_ABILITIES special abilities granted at unit creation.
  abilities?: Ability[];
}

export interface UnitState {
  hp: number;
  apRemaining: number;
  stance: Stance;
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
  | "grass"
  | "stone"
  | "dirt"
  | "wood"
  | "water"
  | "carpet"
  | "snow"
  | "mud";

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
