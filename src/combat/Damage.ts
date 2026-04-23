import type { AttackPreview, Tile, Unit, WeaponKind } from "./types";
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

// Stance modifiers as documented in spec.
export const attackerStanceModifier = (attacker: Unit, isCounter: boolean): number => {
  if (isCounter && attacker.state.stance === "ready") return 1.25;
  return 1.0;
};

export const defenderStanceModifier = (defender: Unit): number => {
  if (defender.state.stance === "defensive") return 0.5;
  return 1.0;
};

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
    case "wyvern":
      return 80;
  }
};

export const previewAttack = (
  attacker: Unit,
  defender: Unit,
  defenderTile: Tile,
  isCounter = false
): AttackPreview => {
  const weaponMod = weaponModifier(attacker.weapon, defender.weapon);
  const terrainMod = defenderTile.defendBonus;
  const stanceMod = attackerStanceModifier(attacker, isCounter) * defenderStanceModifier(defender);
  const baseDamage =
    attacker.stats.power * weaponMod * terrainMod * stanceMod - defender.stats.armor;
  const damage = Math.max(1, Math.round(baseDamage));

  let hit = baseHitForWeapon(attacker.weapon) + (attacker.stats.speed - defender.stats.speed) * 2;
  hit -= defenderTile.hitPenalty;
  const hitRate = clamp(Math.round(hit), 50, 99);

  let crit = 10 + (attacker.stats.speed - defender.stats.speed) * 0.5;
  if (isCounter && attacker.state.stance === "ready") crit += 5;
  const critRate = clamp(Math.round(crit), 0, 60);

  return { damage, hitRate, critRate, weaponMod, terrainMod, stanceMod };
};
