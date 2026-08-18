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
import { nextAfterVictory, reconcileUnlocks } from "../unlocks";
import { defaultSave } from "../../util/save";
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
          cur.id === "b18_path_chosen" ? openerFor(path) : nextAfterVictory(cur.id);
        cur = nextId ? battleById(nextId) : undefined;
        expect(nextId === null || cur !== undefined, `${path}: ${nextId} does not exist`).toBe(true);
      }
      const last = visited[visited.length - 1];
      if (ENDING_PATHS.includes(path)) {
        expect(last, `${path} should end at its opener`).toBe(openerFor(path));
      } else {
        expect(last, `${path} should run the full campaign`).toBe("b29_epilogue");
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

  it("the final battle routes through post_path_final into the per-path codas", () => {
    // B28 is the campaign's last battle: its shared epilogue must end in
    // the dynamic "ending" route, and every war path must have a coda
    // waiting on the other side of it.
    expect(resolvePostArc("b28_path_final", "vengeance")).toBe("post_path_final");
    expect(ARCS.post_path_final.next).toBe("ending");
    for (const path of WAR_PATHS) {
      expect(ARCS[`post_ending_${path}` as keyof typeof ARCS], `missing coda for ${path}`).toBeTruthy();
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
      ["b27_orbital_descent", "b28_path_final"]
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

describe("story arcs terminate", () => {
  // Caught a real self-loop: where_they_went was authored with
  // next: "story:where_they_went" by a careless bulk rewrite, which
  // traps the player in the ending forever with no way to the credits.
  // Any arc-to-arc chain has to reach a non-arc destination.
  it("no arc chain loops — every story: route reaches credits or gameplay", () => {
    for (const start of Object.values(ARCS)) {
      const seen: string[] = [start.id];
      let cur = start;
      while (typeof cur.next === "string" && cur.next.startsWith("story:")) {
        const nextId = cur.next.slice("story:".length) as keyof typeof ARCS;
        const next = ARCS[nextId];
        expect(next, `${cur.id} -> ${nextId}: arc does not exist`).toBeTruthy();
        expect(
          seen.includes(nextId),
          `arc cycle: ${[...seen, nextId].join(" -> ")}`
        ).toBe(false);
        seen.push(nextId);
        cur = next;
      }
    }
  });

  it("every wedding coda and end_alone close through the shared farewell", () => {
    // The wedding closes Amar's story; where_they_went closes everyone
    // else's. A coda wired straight to the credits would silently skip
    // the entire cast farewell for that partner.
    const codas = Object.values(ARCS).filter((a) => a.id.startsWith("wed_"));
    expect(codas.length, "expected one coda per romance option").toBe(7);
    for (const a of [...codas, ARCS.end_alone]) {
      expect(a.next, `${a.id} must route through the farewell`).toBe("story:where_they_went");
    }
    expect(ARCS.where_they_went.next, "the farewell ends the game").toBe("credits");
  });

  it("the walk-away endings do NOT route through the squad farewell", () => {
    // Exile and forgetting end at B19: Amar leaves before the squad
    // exists as the thing where_they_went says goodbye to.
    for (const id of ["post_path_opener_exile", "post_path_opener_forgetting"] as const) {
      expect(ARCS[id].next, `${id} should go straight to credits`).toBe("credits");
    }
  });
});

describe("reinforcement wave schema", () => {
  // Applies to EVERY battle and every path variant, not just the
  // survive-the-clock ones. A wave with neither trigger never lands; a
  // wave with both is ambiguous; a wave keyed to a boss with no second
  // wind is a reserve that can never arrive. All three fail silently in
  // play — the battle just quietly lacks the fight it was authored to
  // have — so they get caught here instead.
  const PATHS: SevenPath[] = ["vengeance", "restoration", "revolution", "duty", "mercy"];
  const variants: Array<[string, BattleNode]> = [];
  for (const node of BATTLES) {
    variants.push([node.id, node]);
    for (const path of PATHS) {
      const r = resolveBattleForPath(node, path);
      if (r !== node) variants.push([`${node.id}:${path}`, r]);
    }
  }

  it("every wave lands on exactly one trigger, on valid tiles, with unique ids", () => {
    for (const [label, node] of variants) {
      const waves = node.reinforcements ?? [];
      if (waves.length === 0) continue;
      const grid = node.map ? new Grid(node.map) : null;
      const roster = node.buildEnemies ? node.buildEnemies() : [];
      const ids = new Set(roster.map((u) => u.id));
      const keys = new Set<string>();
      for (const w of waves) {
        const hasRound = w.round !== undefined;
        const hasEvent = w.onSecondWindOf !== undefined;
        expect(hasRound !== hasEvent, `${label}: wave must set exactly one of round / onSecondWindOf`).toBe(true);

        if (hasEvent) {
          const boss = roster.find((u) => u.id === w.onSecondWindOf);
          expect(boss, `${label}: reserve keyed to absent unit ${w.onSecondWindOf}`).toBeDefined();
          expect(
            boss!.secondWind,
            `${label}: reserve keyed to ${w.onSecondWindOf}, which has no second wind — it could never land`
          ).toBeDefined();
        }

        const key = w.id ?? (w.onSecondWindOf ? `sw:${w.onSecondWindOf}` : `r${w.round}`);
        expect(keys.has(key), `${label}: two waves share the dedup key ${key} — one would never land`).toBe(false);
        keys.add(key);

        const defs = w.units();
        expect(defs.length, `${label}: empty wave`).toBeGreaterThan(0);
        expect(w.at.length, `${label}: fewer entry tiles than units`).toBeGreaterThanOrEqual(defs.length);
        if (grid) {
          for (const pos of w.at) {
            expect(grid.inBounds(pos), `${label}: entry (${pos.x},${pos.y}) out of bounds`).toBe(true);
            expect(grid.tileAt(pos).blocksMovement, `${label}: entry (${pos.x},${pos.y}) impassable`).toBe(false);
          }
        }
        for (const d of defs) {
          expect(d.faction, `${label}: wave unit ${d.id} is not enemy faction`).toBe("enemy");
          expect(ids.has(d.id), `${label}: duplicate unit id ${d.id} would corrupt views/serialization`).toBe(false);
          ids.add(d.id);
        }
      }
    }
  });

  it("every second_wind dialogue names a unit in its own roster that actually has one", () => {
    // A trigger pointed at a unit this variant does not field (or fields
    // without a phase two) is a beat the player can never see. Easy to
    // introduce: the path overrides swap the boss, and B28's Archbold
    // roads and Dawn road each need their own line.
    for (const [label, node] of variants) {
      const roster = node.buildEnemies ? node.buildEnemies() : [];
      for (const dlg of node.dialogues ?? []) {
        // Bound to a local so the narrowing survives into the closure
        // below — re-reading dlg.trigger widens back to the union.
        const trig = dlg.trigger;
        if (trig.kind !== "second_wind") continue;
        const target = roster.find((u) => u.id === trig.unitId);
        expect(target, `${label}/${dlg.id}: second_wind names ${trig.unitId}, absent from this roster`).toBeDefined();
        expect(
          target!.secondWind,
          `${label}/${dlg.id}: ${trig.unitId} has no second wind, so this beat can never fire`
        ).toBeDefined();
      }
    }
  });

  it("every boss with a second wind has a beat and a reserve on every road that fields it", () => {
    for (const [label, node] of variants) {
      const roster = node.buildEnemies ? node.buildEnemies() : [];
      for (const boss of roster.filter((u) => u.secondWind)) {
        const hasBeat = (node.dialogues ?? []).some(
          (d) => d.trigger.kind === "second_wind" && d.trigger.unitId === boss.id
        );
        expect(hasBeat, `${label}: ${boss.id} stands back up with nothing to say`).toBe(true);
        const hasReserve = (node.reinforcements ?? []).some((w) => w.onSecondWindOf === boss.id);
        expect(hasReserve, `${label}: ${boss.id} stands back up with no reserve`).toBe(true);
      }
    }
  });
});

describe("battle dialogue portraits", () => {
  it("every speaking beat carries a portraitId — no faceless dialogue panels", () => {
    // A beat with a speaker but no portraitId renders an empty space next
    // to the chat (BattleDialogueScene only draws when portraitId is set).
    // Named bosses without painted art must use the generic enemy
    // portraits (bandit/raider/reaver/royal_guard/crown_archer).
    for (const base of BATTLES) {
      for (const { label, node } of [{ label: base.id, node: base }]) {
        const allDialogues = [
          ...(node.dialogues ?? []),
          ...Object.values(node.pathOverrides ?? {}).flatMap((o) => [
            ...(o.dialogues ?? []),
            ...(o.extraDialogues ?? [])
          ])
        ];
        for (const d of allDialogues) {
          for (const b of d.beats) {
            if (!b.speaker) continue;
            expect(
              b.portraitId,
              `${label}/${d.id}: "${b.speaker}" speaks with no portraitId — assign a real or generic portrait`
            ).toBeTruthy();
          }
        }
      }
    }
  });
});

describe("unlock reconciliation", () => {
  it("backfills unlocks a save has earned but never received", () => {
    // Exactly the shipped-save case: B28 beaten before it unlocked the
    // epilogue, so unlockedBattles never got b29_epilogue.
    const stale = {
      ...defaultSave(),
      completedBattles: ["b01_palace_coup", "b18_path_chosen", "b19_path_opener_mercy", "b28_path_final"],
      unlockedBattles: ["b01_palace_coup", "b28_path_final"]
    };
    const healed = reconcileUnlocks(stale, "mercy");
    expect(healed.unlockedBattles, "the epilogue is earned by beating B28").toContain("b29_epilogue");
    // B18's opener is ChoiceScene's job — reconcile has to know the path.
    expect(healed.unlockedBattles).toContain("b19_path_opener_mercy");
    // Never removes anything.
    for (const id of stale.unlockedBattles) expect(healed.unlockedBattles).toContain(id);
  });

  it("is a no-op for a save that's already consistent", () => {
    const fresh = defaultSave();
    expect(reconcileUnlocks(fresh, null)).toBe(fresh);
  });

  it("every battle in the campaign is reachable — no orphan cards in the chapter select", () => {
    // b30 was a vertical-slice scaffold that nothing unlocked and
    // nothing referenced: a permanently locked card at the end of the
    // list. Nothing should be able to sit there again.
    const reachable = new Set<string>(["b01_palace_coup"]);
    for (const b of BATTLES) {
      const next = nextAfterVictory(b.id);
      if (next) reachable.add(next);
      if (b.id === "b18_path_chosen") for (const p of ALL_PATHS) reachable.add(openerFor(p));
    }
    for (const b of BATTLES) {
      expect(reachable.has(b.id), `${b.id} is in the battle list but nothing unlocks it`).toBe(true);
    }
  });
});

describe("hold battles end when the field is cleared", () => {
  // Reported: B21 kept going after every wave was dead, forcing the
  // player to End Turn through empty rounds until the clock ran out.
  const HOLD_BATTLES: BattleId[] = ["b19_path_opener_duty", "b21_archbold_advances", "b26_coastal_hold"];

  it("clearing every enemy wins once the last wave has landed", () => {
    for (const id of HOLD_BATTLES) {
      const node = battleById(id)!;
      const { players, enemies } = buildRoster(node);
      const grid = new Grid(node.map!);
      const state = { units: [...players, ...enemies], grid, rng: new Rng(3) };
      // Round-scheduled waves only — an event wave (onSecondWindOf)
      // has no round and can't be part of a clock argument.
      const lastWave = Math.max(
        ...(node.reinforcements ?? []).map((w) => w.round ?? 0),
        0
      );
      for (const e of enemies) { e.state.hp = 0; e.state.alive = false; }
      // Before the last wave, an empty field proves nothing — the waves
      // are still coming, and skipping them would skip the battle.
      expect(
        node.victory!.evaluate({ state, round: lastWave - 1 }),
        `${id}: cleared field before the last wave must NOT win`
      ).toBeNull();
      // From the last wave onward, everything that will ever spawn has.
      expect(
        node.victory!.evaluate({ state, round: lastWave }),
        `${id}: cleared field after the last wave must win immediately`
      ).toBe("player");
    }
  });

  it("still wins on the clock with enemies alive, and still loses on a wipe", () => {
    for (const id of HOLD_BATTLES) {
      const node = battleById(id)!;
      const { players, enemies } = buildRoster(node);
      const grid = new Grid(node.map!);
      const state = { units: [...players, ...enemies], grid, rng: new Rng(3) };
      expect(node.victory!.evaluate({ state, round: 99 }), `${id}: the clock must still win it`).toBe("player");
      for (const p of players) { p.state.hp = 0; p.state.alive = false; }
      expect(node.victory!.evaluate({ state, round: 2 }), `${id}: a wipe must still lose`).toBe("enemy");
    }
  });
});
