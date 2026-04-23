import type { Unit } from "./types";
import { Grid } from "./Grid";

// Spec: Ready stance triggers on the first valid melee attacker until next-turn-start.
// MVP: melee classes counter when adjacent. Archers do NOT counter (their tier-2 interrupt is out of scope).
export const canTriggerReadyCounter = (
  defender: Unit,
  attacker: Unit,
  _grid: Grid
): boolean => {
  if (defender.state.stance !== "ready") return false;
  if (defender.weapon === "bow") return false; // archers don't counter in MVP
  // Defender must be in attack range of attacker for counter to make sense.
  const dx = Math.abs(defender.state.position.x - attacker.state.position.x);
  const dy = Math.abs(defender.state.position.y - attacker.state.position.y);
  const dist = dx + dy;
  if (defender.weapon === "spear") {
    return dist === 1 || dist === 2;
  }
  return dist === 1; // sword / shield / wyvern melee
};

// Tiles from which the defender can counter. Used to render the threat zone overlay.
export const counterZoneTiles = (defender: Unit): { x: number; y: number }[] => {
  const out: { x: number; y: number }[] = [];
  const reach = defender.weapon === "spear" ? 2 : 1;
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const d = Math.abs(dx) + Math.abs(dy);
      if (d === 0 || d > reach) continue;
      out.push({ x: defender.state.position.x + dx, y: defender.state.position.y + dy });
    }
  }
  return out;
};
