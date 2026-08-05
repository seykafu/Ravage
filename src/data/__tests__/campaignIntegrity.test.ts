// Campaign integrity: a headless, data-level walk of the ENTIRE game.
//
// 28 playable battles, 7 endings, path-dependent rosters and win
// conditions, unlock chains, and arc routing — verified structurally on
// every test run so a content edit that breaks the campaign's spine
// (a stale unlock, a boss id typo in a victory condition, a start
// position on a wall, a dialogue referencing a unit not on the field)
// fails CI instead of stranding a player forty battles into a run.

import { describe, it, expect } from "vitest";
import { BATTLES, battleById, resolveBattleForPath, type BattleNode } from "../battles";
import type { BattleId, SevenPath } from "../contentIds";
import { ARCS } from "../../story/beats";
import { Grid } from "../../combat/Grid";
import { createUnit } from "../../combat/Unit";
import { applyDifficultyToEnemy } from "../../combat/Difficulty";
import { routEnemies } from "../../combat/Victory";
import { serializeUnit, deserializeUnit } from "../../combat/Suspend";
import { Rng } from "../../util/rng";
import type { Unit } from "../../combat/types";

const WAR_PATHS: SevenPath[] = ["vengeance", "restoration", "revolution", "duty", "mercy"];
const ENDING_PATHS: SevenPath[] = ["exile", "forgetting"];
const ALL_PATHS: SevenPath[] = [...WAR_PATHS, ...ENDING_PATHS];

// Mirrors ChoiceScene's path → opener routing.
const openerFor = (path: SevenPath): BattleId => `b19_path_opener_${path}` as BattleId;

// Mirrors BattleScene.checkEnd's unlock semantics.
const nextAfterVictory = (node: BattleNode): BattleId | null => {
  if (node.unlocks !== undefined) return node.unlocks;
  const idx = BATTLES.findIndex((b) => b.id === node.id);
  return idx >= 0 && idx + 1 < BATTLES.length ? BATTLES[idx + 1]!.id : null;
};

// Every (battle, path) pairing that can occur in a run.
const resolvedVariants = (node: BattleNode): Array<{ label: string; node: BattleNode }> => {
  const out: Array<{ label: string; node: BattleNode }> = [{ label: node.id, node }];
  if (node.pathOverrides) {
    for (const path of ALL_PATHS) {
      if (node.pathOverrides[path]) {
        out.push({ label: `${node.id}:${path}`, node: resolveBattleForPath(node, path) });
      }
    }
  }
  return out;
};

const buildRoster = (node: BattleNode): { players: Unit[]; enemies: Unit[] } => {
  const map = node.map!;
  const players = node.buildPlayers!().map((d, i) =>
    createUnit(d, map.startPositions.player[i] ?? { x: -1, y: -1 })
  );
  const enemies = node.buildEnemies!().map((d, i) =>
    createUnit(applyDifficultyToEnemy(d, node.id), map.startPositions.enemy[i] ?? { x: -1, y: -1 })
  );
  return { players, enemies };
};

describe("campaign integrity", () => {
  const playable = BATTLES.filter((b) => b.playable);

  it("every path's unlock chain runs from B1 to its true ending", () => {
    for (const path of ALL_PATHS) {
      const visited: string[] = [];
      let cur: BattleNode | undefined = battleById("b01_palace_coup");
      for (let hops = 0; hops < 60 && cur; hops++) {
        visited.push(cur.id);
        expect(cur.playable, `${path}: reached unplayable ${cur.id}`).toBe(true);
        // B18's unlock is owned by ChoiceScene — follow the chosen path.
        const nextId: BattleId | null =
          cur.id === "b18_path_chosen" ? openerFor(path) : nextAfterVictory(cur);
        cur = nextId ? battleById(nextId) : undefined;
        expect(nextId === null || cur !== undefined, `${path}: ${nextId} does not exist`).toBe(true);
      }
      const last = visited[visited.length - 1];
      if (ENDING_PATHS.includes(path)) {
        expect(last, `${path} should end at its opener`).toBe(openerFor(path));
      } else {
        expect(last, `${path} should run the full campaign`).toBe("b29_aftermath");
        expect(visited, `${path} must pass through the war arc`).toContain("b20_dawn_war");
        expect(visited).toContain("b28_path_final");
      }
    }
  });

  it("every playable battle (and every path variant) fields a valid board", () => {
    for (const base of playable) {
      for (const { label, node } of resolvedVariants(base)) {
        expect(node.map, `${label}: no map`).toBeDefined();
        expect(node.buildPlayers, `${label}: no player roster`).toBeDefined();
        expect(node.buildEnemies, `${label}: no enemy roster`).toBeDefined();
        const map = node.map!;
        const grid = new Grid(map);
        const { players, enemies } = buildRoster(node);
        expect(players.length, `${label}: empty player roster`).toBeGreaterThan(0);
        expect(enemies.length, `${label}: empty enemy roster`).toBeGreaterThan(0);
        expect(
          map.startPositions.player.length,
          `${label}: fewer player start slots than units`
        ).toBeGreaterThanOrEqual(players.length);
        expect(
          map.startPositions.enemy.length,
          `${label}: fewer enemy start slots than units`
        ).toBeGreaterThanOrEqual(enemies.length);
        // Every fielded unit stands on a real, walkable tile.
        for (const u of [...players, ...enemies]) {
          const p = u.state.position;
          const inBounds = p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height;
          expect(inBounds, `${label}: ${u.id} starts off-map at ${p.x},${p.y}`).toBe(true);
          expect(
            grid.tileAt(p).blocksMovement,
            `${label}: ${u.id} starts inside blocking terrain at ${p.x},${p.y}`
          ).toBe(false);
        }
        // No duplicate unit ids on one field.
        const ids = [...players, ...enemies].map((u) => u.id);
        expect(new Set(ids).size, `${label}: duplicate unit ids`).toBe(ids.length);
      }
    }
  });

  it("every victory condition actually resolves, both ways", () => {
    for (const base of playable) {
      for (const { label, node } of resolvedVariants(base)) {
        const { players, enemies } = buildRoster(node);
        const grid = new Grid(node.map!);
        const victory = node.victory ?? routEnemies;
        const state = { units: [...players, ...enemies], grid, rng: new Rng(7) };
        // All enemies down + the clock exhausted ⇒ the player MUST win.
        // Catches defeatUnit targets that aren't on the field (an id typo
        // would make the battle unwinnable).
        for (const e of enemies) { e.state.hp = 0; e.state.alive = false; }
        expect(victory.evaluate({ state, round: 99 }), `${label}: unwinnable`).toBe("player");
        // All players down ⇒ the enemy must win.
        for (const e of enemies) { e.state.hp = 1; e.state.alive = true; }
        for (const p of players) { p.state.hp = 0; p.state.alive = false; }
        expect(victory.evaluate({ state, round: 1 }), `${label}: unlosable`).toBe("enemy");
      }
    }
  });

  it("every mid-battle dialogue references units that are on the field", () => {
    for (const base of playable) {
      for (const { label, node } of resolvedVariants(base)) {
        if (!node.dialogues) continue;
        const { players, enemies } = buildRoster(node);
        const ids = new Set([...players, ...enemies].map((u) => u.id));
        for (const dlg of node.dialogues) {
          const t = dlg.trigger;
          if (t.kind === "adjacent_eot") {
            expect(ids.has(t.unitA), `${label}/${dlg.id}: unitA "${t.unitA}" not fielded`).toBe(true);
            expect(ids.has(t.unitB), `${label}/${dlg.id}: unitB "${t.unitB}" not fielded`).toBe(true);
          } else if (t.kind === "ally_attacks") {
            expect(ids.has(t.allyId), `${label}/${dlg.id}: allyId "${t.allyId}" not fielded`).toBe(true);
          } else if (t.kind === "ally_killed_target") {
            expect(ids.has(t.allyId), `${label}/${dlg.id}: allyId "${t.allyId}" not fielded`).toBe(true);
            expect(ids.has(t.targetId), `${label}/${dlg.id}: targetId "${t.targetId}" not fielded`).toBe(true);
          }
        }
      }
    }
  });

  it("every arc's prep route points at a playable battle", () => {
    for (const arc of Object.values(ARCS)) {
      if (typeof arc.next === "string" && arc.next.startsWith("prep:")) {
        const id = arc.next.slice("prep:".length);
        const node = battleById(id);
        expect(node, `${arc.id}: prep target ${id} missing`).toBeDefined();
        expect(node!.playable, `${arc.id}: prep target ${id} not playable`).toBe(true);
      }
    }
  });

  it("every fielded roster survives the suspend save round-trip", () => {
    for (const base of playable) {
      for (const { label, node } of resolvedVariants(base)) {
        const { players, enemies } = buildRoster(node);
        for (const u of [...players, ...enemies]) {
          const back = deserializeUnit(JSON.parse(JSON.stringify(serializeUnit(u))));
          expect(back.id, label).toBe(u.id);
          expect(back.stats, `${label}: ${u.id} stats drift`).toEqual(u.stats);
          expect(back.state.position, label).toEqual(u.state.position);
          if (u.tags) {
            expect(back.tags, `${label}: ${u.id} tags lost`).toBeInstanceOf(Set);
            expect([...back.tags!].sort()).toEqual([...u.tags].sort());
          }
        }
      }
    }
  });
});
