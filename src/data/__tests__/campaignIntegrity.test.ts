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
import { FINAL_PLAYABLE, resolvePostArc } from "../postArcs";
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

describe("war-arc path flavor (B20-B22)", () => {
  const WAR_BATTLES: BattleId[] = ["b20_dawn_war", "b21_archbold_advances", "b22_grude_burns"];

  it("every war path speaks exactly once per shared war battle, additively", () => {
    for (const bid of WAR_BATTLES) {
      const node = battleById(bid)!;
      const base = node.dialogues?.length ?? 0;
      expect(base, `${bid} lost its shared script`).toBeGreaterThan(0);
      for (const path of WAR_PATHS) {
        const extra = node.pathOverrides?.[path]?.extraDialogues;
        expect(extra?.length, `${bid}:${path} must add exactly one flavor beat`).toBe(1);
        const resolved = resolveBattleForPath(node, path);
        expect(resolved.dialogues?.length, `${bid}:${path} must keep the shared script AND the flavor beat`).toBe(base + 1);
        // The appended beat is the path's own, not a replacement of a shared one.
        expect(resolved.dialogues?.at(-1)?.id).toBe(`${bid}_path_${path}`);
      }
      // No path chosen (should be impossible past B19, but the resolver must not invent dialogue).
      expect(resolveBattleForPath(node, null).dialogues?.length).toBe(base);
    }
  });
});

describe("post-battle story routing", () => {
  it("every non-terminal playable battle routes into a real story arc — no silent camp fall-through", () => {
    for (const node of BATTLES) {
      if (!node.playable || FINAL_PLAYABLE.has(node.id)) continue;
      const arc = resolvePostArc(node.id, "vengeance");
      expect(arc, `${node.id}: victory falls through to camp with no story`).toBeTruthy();
      expect(ARCS[arc!], `${node.id} -> ${arc}: arc does not exist`).toBeTruthy();
    }
  });

  it("b29 routes to the chosen path's ending coda", () => {
    for (const path of WAR_PATHS) {
      expect(resolvePostArc("b29_aftermath", path)).toBe(`post_ending_${path}`);
    }
  });

  it("endgame epilogues chain each battle into the next battle's prep", () => {
    const chain: Array<[BattleId, BattleId]> = [
      ["b20_dawn_war", "b21_archbold_advances"],
      ["b21_archbold_advances", "b22_grude_burns"],
      ["b22_grude_burns", "b23_path_climax_a"],
      ["b23_path_climax_a", "b24_path_climax_b"],
      ["b24_path_climax_b", "b25_fleet_arrival"],
      ["b25_fleet_arrival", "b26_coastal_hold"],
      ["b26_coastal_hold", "b27_orbital_descent"],
      ["b27_orbital_descent", "b28_path_final"],
      ["b28_path_final", "b29_aftermath"]
    ];
    for (const [from, to] of chain) {
      const arcId = resolvePostArc(from, "vengeance")!;
      expect(ARCS[arcId].next, `${arcId} must bridge into ${to}`).toBe(`prep:${to}`);
    }
  });
});

describe("survive-battle reinforcement waves", () => {
  // Pure surviveRounds battles MUST field waves: without them a strong
  // squad routs the opening roster and spends the rest of the battle
  // ending turns at an empty field (the B26 empty-beach bug).
  const SURVIVE_WAVE_BATTLES: Array<[BattleId, number]> = [
    ["b19_path_opener_duty", 6],
    ["b21_archbold_advances", 6],
    ["b26_coastal_hold", 6]
  ];

  it("every pure-survive battle has waves on valid tiles with unique unit ids", () => {
    for (const [bid, holdRounds] of SURVIVE_WAVE_BATTLES) {
      const node = battleById(bid)!;
      const waves = node.reinforcements ?? [];
      expect(waves.length, `${bid}: survive battle with no reinforcements`).toBeGreaterThan(0);
      const grid = new Grid(node.map!);
      const ids = new Set(node.buildEnemies!().map((u) => u.id));
      for (const w of waves) {
        // Round 1 waves would never fire (the wrap hook spawns them);
        // waves past the hold would spawn into an already-won battle.
        expect(w.round, `${bid}: wave round too early`).toBeGreaterThanOrEqual(2);
        expect(w.round, `${bid}: wave lands after victory`).toBeLessThanOrEqual(holdRounds);
        const defs = w.units();
        expect(defs.length, `${bid} r${w.round}: empty wave`).toBeGreaterThan(0);
        expect(w.at.length, `${bid} r${w.round}: fewer entry tiles than units`).toBeGreaterThanOrEqual(defs.length);
        for (const p of w.at) {
          expect(grid.inBounds(p), `${bid} r${w.round}: (${p.x},${p.y}) out of bounds`).toBe(true);
          expect(grid.tileAt(p).blocksMovement, `${bid} r${w.round}: (${p.x},${p.y}) is impassable`).toBe(false);
        }
        for (const d of defs) {
          expect(d.faction, `${bid}: wave unit ${d.id} not enemy faction`).toBe("enemy");
          expect(ids.has(d.id), `${bid}: duplicate unit id ${d.id} would corrupt views/serialization`).toBe(false);
          ids.add(d.id);
        }
      }
    }
  });
});
