import type { AttackPreview, Tile, Unit, WeaponKind } from "./types";
import { RAVAGE_ARMOR_MULT, RAVAGE_POWER_MULT } from "./types";
import { hasAbility } from "./Unit";
import { clamp } from "../util/math";

// Weapon triangle: 1.15× favored, 0.85× unfavored, 1.0× neutral.
const FAVORED: Partial<Record<WeaponKind, WeaponKind>> = {
  sword: "spear",
  spear: "shield",
  shield: "sword"
};

export const weaponModifier = (attacker: WeaponKind, defender: WeaponKind): number => {
  if (attacker === defender) return 1.0;
  if (FAVORED[attacker] === defender) return 1.15;
  if (FAVORED[defender] === attacker) return 0.85;
  return 1.0;
};

// True if `attacker` weapon-triangle-favors `defender` (the attacker has the better matchup).
export const hasWeaponAdvantage = (attacker: WeaponKind, defender: WeaponKind): boolean =>
  FAVORED[attacker] === defender;

// Stance modifiers as documented in spec.
export const attackerStanceModifier = (attacker: Unit, isCounter: boolean): number => {
  if (isCounter && attacker.state.stance === "ready") return 1.25;
  return 1.0;
};

export const defenderStanceModifier = (defender: Unit): number => {
  if (defender.state.stance === "defensive") return 0.5;
  return 1.0;
};

// Whether `defender` has at least one adjacent ally (same faction, within 4-neighbour distance).
const hasAdjacentAlly = (defender: Unit, allUnits: Unit[]): boolean => {
  for (const u of allUnits) {
    if (u === defender) continue;
    if (!u.state.alive) continue;
    if (u.faction !== defender.faction) continue;
    const dx = Math.abs(u.state.position.x - defender.state.position.x);
    const dy = Math.abs(u.state.position.y - defender.state.position.y);
    if (dx + dy === 1) return true;
  }
  return false;
};

// Defender ability modifier: Aide halves incoming damage when adjacent to an ally.
export const defenderAbilityModifier = (defender: Unit, allUnits: Unit[]): number => {
  if (hasAbility(defender, "Aide") && hasAdjacentAlly(defender, allUnits)) return 0.5;
  return 1.0;
};

// Attacker ability modifier: BossFighter doubles damage vs. boss-class enemies.
export const attackerAbilityModifier = (attacker: Unit, defender: Unit): number => {
  if (hasAbility(attacker, "BossFighter") && defender.classKind === "boss") return 2.0;
  return 1.0;
};

// Ravage State multiplies the attacker's effective power for this swing
// when they entered the turn Ravaged (took ≥ RAVAGE_THRESHOLD_PCT of max
// HP since their last turn). The "wounded animal hits harder" loop.
export const attackerRavageModifier = (attacker: Unit): number =>
  attacker.state.ravagedActive ? RAVAGE_POWER_MULT : 1.0;

// Ravage State halves a defender's effective armor while they're in their
// Ravaged turn — they're committed forward and not blocking well. Combined
// with the attacker bonus, a Ravaged-vs-Ravaged trade is genuinely lethal.
export const effectiveArmor = (defender: Unit): number =>
  defender.state.ravagedActive
    ? Math.floor(defender.stats.armor * RAVAGE_ARMOR_MULT)
    : defender.stats.armor;

const baseHitForWeapon = (w: WeaponKind): number => {
  switch (w) {
    case "sword":
      return 85;
    case "spear":
      return 80;
    case "shield":
      return 80;
    case "bow":
      return 75;
    case "dactyl":
      return 80;
  }
};

export const previewAttack = (
  attacker: Unit,
  defender: Unit,
  defenderTile: Tile,
  isCounter = false,
  allUnits: Unit[] = []
): AttackPreview => {
  const weaponMod = weaponModifier(attacker.weapon, defender.weapon);
  const terrainMod = defenderTile.defendBonus;
  const stanceMod = attackerStanceModifier(attacker, isCounter) * defenderStanceModifier(defender);
  const abilityMod = attackerAbilityModifier(attacker, defender) * defenderAbilityModifier(defender, allUnits);
  const ravageAtkMod = attackerRavageModifier(attacker);
  const armor = effectiveArmor(defender);
  const baseDamage =
    attacker.stats.power * weaponMod * terrainMod * stanceMod * abilityMod * ravageAtkMod -
    armor;
  const damage = Math.max(1, Math.round(baseDamage));

  let hit = baseHitForWeapon(attacker.weapon) + (attacker.stats.speed - defender.stats.speed) * 2;
  hit -= defenderTile.hitPenalty;
  const hitRate = clamp(Math.round(hit), 50, 99);

  let crit = 10 + (attacker.stats.speed - defender.stats.speed) * 0.5;
  if (isCounter && attacker.state.stance === "ready") crit += 5;
  const critRate = clamp(Math.round(crit), 0, 60);

  return { damage, hitRate, critRate, weaponMod, terrainMod, stanceMod };
};
