// Headless campaign balance simulation.
//
// For every playable battle (and every path-divergent variant), models
// the expected exchange between the authored enemy roster and a squad
// at the battle's intended level, using the REAL damage pipeline
// (previewAttack) so the numbers can never drift from the game:
//
//   * squadLevel        — avg authored enemy level = the design's
//                         intended player level at that battle
//   * playerHtkMook     — expected swings for an average squad member
//                         to kill an average rank-and-file enemy
//   * enemyHtkPlayer    — expected swings for that enemy to kill an
//                         average squad member (the pressure number)
//   * bossHtkPlayer/... — same numbers vs the battle's boss
//
// Player stats are projected: authored base + growth% x levels gained,
// plus the standard promotion boost once the campaign passes the
// promotion era (assumed from level 12). Enemy stats go through
// applyDifficultyToEnemy exactly as BattleScene applies them.
//
// Consumed by __tests__/BalanceReport.test.ts, which prints the curve
// and enforces guardrail bounds so future stat edits that break the
// campaign's difficulty fail CI instead of shipping.

import { BATTLES, resolveBattleForPath, type BattleNode } from "../data/battles";
import type { SevenPath } from "../data/contentIds";
import { applyDifficultyToEnemy } from "./Difficulty";
import { previewAttack } from "./Damage";
import { createUnit } from "./Unit";
import type { Tile, Unit, UnitDef } from "./types";

const NEUTRAL_TILE = {
  terrain: "grass",
  obstacle: "none",
  defendBonus: 1,
  hitPenalty: 0,
  blocksMovement: false
} as unknown as Tile;

// Mirrors PROMOTIONS' STANDARD_BOOST — applied once past the promotion
// era. Movement omitted (irrelevant to exchange math).
const PROMO = { hp: 5, power: 2, armor: 2, speed: 2 };
const PROMO_LEVEL = 12;

// Project a player def to the battle's intended level: base stats plus
// expected growth gains (growth% x levels), plus the promotion boost
// once the campaign is past the promotion era.
//
// Exported so balance-sensitive tests outside this file (the B28
// second-wind guards) model a squad the same way the campaign curve
// does — two different notions of "what a player looks like at L20"
// would let one of them drift and quietly stop guarding anything.
export const projectPlayer = (def: UnitDef, level: number): Unit => {
  const gained = Math.max(0, level - def.level);
  const g = def.growths ?? { hp: 0, power: 0, armor: 0, speed: 0, movement: 0 };
  const promoted = level >= PROMO_LEVEL;
  const stats = {
    ...def.stats,
    hp: Math.round(def.stats.hp + (g.hp / 100) * gained + (promoted ? PROMO.hp : 0)),
    power: Math.round(def.stats.power + (g.power / 100) * gained + (promoted ? PROMO.power : 0)),
    armor: Math.round(def.stats.armor + (g.armor / 100) * gained + (promoted ? PROMO.armor : 0)),
    speed: Math.round(def.stats.speed + (g.speed / 100) * gained + (promoted ? PROMO.speed : 0))
  };
  return createUnit({ ...def, stats, level }, { x: 0, y: 0 });
};

// Expected damage per swing: hit% x damage, doubled on crits.
const expectedSwing = (attacker: Unit, defender: Unit): number => {
  const p = previewAttack(attacker, defender, NEUTRAL_TILE, false, []);
  return (p.hitRate / 100) * p.damage * (1 + p.critRate / 100);
};

const avg = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);

// Offense is measured over the STRIKE CORE — the squad's four best
// attackers against the target in question. The guardrail bounds were
// tuned when every roster was four attackers; the fleet arc fields six
// including a dedicated shieldbearer (Ranatoli), and a plain mean would
// let one low-offense tank read as "enemies too spongy" when the units
// that actually do the killing are on curve. The tank's contribution is
// survivability, which enemyHtkPlayer already measures.
const STRIKE_CORE = 4;
const coreAvg = (perPlayerHtk: number[]): number =>
  avg([...perPlayerHtk].sort((a, b) => a - b).slice(0, STRIKE_CORE));

export interface BalanceRow {
  label: string;
  index: number;
  squadLevel: number;
  mookCount: number;
  playerHtkMook: number;
  enemyHtkPlayer: number;
  bossHtkPlayer: number | null;   // swings for the BOSS to kill a player
  playerHtkBoss: number | null;   // swings for a player to kill the boss
}

const simulateNode = (node: BattleNode, label: string): BalanceRow | null => {
  if (!node.buildPlayers || !node.buildEnemies) return null;
  const enemyDefs = node.buildEnemies().map((d) => applyDifficultyToEnemy(d, node.id));
  const mookDefs = enemyDefs.filter((d) => d.classKind !== "boss");
  const bossDefs = enemyDefs.filter((d) => d.classKind === "boss");
  const squadLevel = Math.round(avg(enemyDefs.map((d) => d.level)));
  const players = node.buildPlayers().map((d) => projectPlayer(d, Math.max(d.level, squadLevel)));
  const mooks = mookDefs.map((d) => createUnit(d, { x: 0, y: 0 }));
  const bosses = bossDefs.map((d) => createUnit(d, { x: 0, y: 0 }));

  const pVsM = coreAvg(players.map((p) => avg(mooks.map((m) => m.stats.hp / expectedSwing(p, m)))));
  const mVsP = avg(mooks.flatMap((m) => players.map((p) => p.stats.hp / expectedSwing(m, p))));
  const bVsP = bosses.length
    ? avg(bosses.flatMap((b) => players.map((p) => p.stats.hp / expectedSwing(b, p))))
    : null;
  const pVsB = bosses.length
    ? coreAvg(players.map((p) => avg(bosses.map((b) => b.stats.hp / expectedSwing(p, b)))))
    : null;

  return {
    label,
    index: node.index,
    squadLevel,
    mookCount: mooks.length,
    playerHtkMook: pVsM,
    enemyHtkPlayer: mVsP,
    bossHtkPlayer: bVsP,
    playerHtkBoss: pVsB
  };
};

const PATHS: SevenPath[] = ["vengeance", "restoration", "revolution", "duty", "mercy"];

export const simulateCampaign = (): BalanceRow[] => {
  const rows: BalanceRow[] = [];
  for (const node of BATTLES) {
    if (!node.playable) continue;
    const base = simulateNode(node, node.id);
    if (base) rows.push(base);
    // Path-divergent variants with their own rosters get their own rows.
    if (node.pathOverrides) {
      for (const path of PATHS) {
        const o = node.pathOverrides[path];
        if (!o?.buildEnemies) continue;
        const variant = simulateNode(resolveBattleForPath(node, path), `${node.id}:${path}`);
        if (variant) rows.push(variant);
      }
    }
  }
  return rows;
};
