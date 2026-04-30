import type { Ability, ClassKind, UnitStats } from "../combat/types";

// Per-character promotion definition. The Tier 1 → Tier 2 mapping is fixed
// (see docs/RAVAGE_DESIGN.md §5.2 — there is no branching choice), but each
// character also gets a stat boost and a Tier 2 signature ability slotted
// into their second ability slot. The optional spriteClassOverride points
// at the Tier 1 sprite folder when the Tier 2 doesn't have its own assets
// yet — keeps the unit visually distinct from the procedural fallback
// while we wait on art.
export interface PromotionData {
  toClass: ClassKind;
  newAbility: Ability;
  // If set, the promoted unit renders as this class's sprite folder.
  // Use when toClass has no shipped sprites under public/assets/sprites/.
  spriteClassOverride?: ClassKind;
  // Stat additions applied at promotion. Default per design doc:
  // +5 HP / +2 PWR / +2 ARM / +2 SPD / +1 MOV.
  statBoost: Partial<UnitStats>;
}

// Standard promotion stat boost — used by every player character. Pulled
// out as a const so a future tuning pass can adjust one place. Movement is
// the most disruptive stat to bump (it changes positioning math), so the
// +1 default keeps the impact contained.
const STANDARD_BOOST: Partial<UnitStats> = {
  hp: 5,
  power: 2,
  armor: 2,
  speed: 2,
  movement: 1
};

// Per-character promotion table. Keyed by the character's UnitDef.id so
// the StoryScene's `promote: PortraitId` field looks up directly. Selene
// is omitted — she joins B7 already promoted (her base classKind is
// "swordmaster"). Kian is omitted — antagonist arc, never promotes.
//
// Sprite overrides: every Tier 2 except swordmaster routes back to its
// Tier 1 sprite folder via spriteClassOverride until proper assets ship.
// (Swordmaster has its own folder.) This keeps the promoted unit's
// silhouette stable through the upgrade rather than dropping to the
// procedural fallback (which would surface as a DEV warning per the
// Kian-was-crappy-sprite fix).
export const PROMOTIONS: Partial<Record<string, PromotionData>> = {
  amar: {
    toClass: "swordmaster",
    newAbility: "CritPlus",
    statBoost: STANDARD_BOOST
  },
  lucian: {
    toClass: "spearton_lord",
    newAbility: "Phalanx",
    spriteClassOverride: "spearton",
    statBoost: STANDARD_BOOST
  },
  ning: {
    toClass: "robinhelm",
    newAbility: "Pierce",
    spriteClassOverride: "archer",
    statBoost: STANDARD_BOOST
  },
  maya: {
    toClass: "shinobi_master",
    newAbility: "Vanish",
    spriteClassOverride: "shinobi",
    statBoost: STANDARD_BOOST
  },
  leo: {
    toClass: "dactyl_king",
    newAbility: "Stoop",
    spriteClassOverride: "dactyl_rider",
    statBoost: STANDARD_BOOST
  },
  ranatoli: {
    toClass: "guardian",
    newAbility: "Bulwark",
    spriteClassOverride: "sentinel",
    statBoost: STANDARD_BOOST
  }
  // kian: never promotes — turns hostile in B10 before any promotion beat fires.
  // selene: starts as "swordmaster" — already a Tier 2 at recruit (B7).
};

// Display labels for Tier 2 classes — used by PromotionScene's banner.
// Keep in sync with the ClassKind union and the PROMOTIONS table above.
export const CLASS_DISPLAY_NAMES: Partial<Record<ClassKind, string>> = {
  swordsman: "Swordsman",
  spearton: "Spearton",
  knight: "Knight",
  archer: "Archer",
  shinobi: "Shinobi",
  sentinel: "Sentinel",
  dactyl_rider: "Dactyl Rider",
  swordmaster: "Swordmaster",
  spearton_lord: "Spearton Lord",
  khan: "Khan",
  robinhelm: "Robinhelm",
  dactyl_king: "Dactyl King",
  shinobi_master: "Shinobi Master",
  guardian: "Guardian",
  boss: "Boss"
};

// Display labels for the Tier 2 signature abilities, with one-line
// descriptions for the PromotionScene's "new ability granted" panel.
export const ABILITY_DISPLAY: Partial<Record<Ability, { name: string; blurb: string }>> = {
  // Tier 1 (already in BattleScene's ABILITY_INFO; mirrored here for
  // PromotionScene's standalone use)
  BossFighter: { name: "Boss Fighter", blurb: "+100% damage vs boss-class enemies." },
  Aide:        { name: "Aide",         blurb: "Take half damage while adjacent to a friendly unit." },
  Destruct:    { name: "Destruct",     blurb: "On death, the killing-blow attacker also dies." },
  Roam:        { name: "Roam",         blurb: "Once per turn, spend 1 extra AP for one extra Move." },
  // Tier 2 signatures
  CritPlus:    { name: "Crit+",        blurb: "+15% crit rate on all attacks." },
  Phalanx:     { name: "Phalanx",      blurb: "Adjacent allies take −20% damage." },
  Charge:      { name: "Charge",       blurb: "First attack each turn does +25% damage." },
  Pierce:      { name: "Pierce",       blurb: "Bow attacks ignore 50% of target armor." },
  Stoop:       { name: "Stoop",        blurb: "Once per battle: free move + attack within 6 movement." },
  Vanish:      { name: "Vanish",       blurb: "After attacking, take −50% damage until next turn." },
  Bulwark:     { name: "Bulwark",      blurb: "Cannot be moved by enemy effects; +2 effective armor." }
};
