import type Phaser from "phaser";
import { BATTLES } from "../data/battles";
import type { SevenPath } from "../data/contentIds";
import { createItem } from "../combat/items";
import { createUnit } from "../combat/Unit";
import { catchUpToSquad, promoteCharacter } from "../combat/Progression";
import { LEVEL_CAP } from "../combat/types";
import { ROSTER_ORDER } from "../data/activeRoster";
import { PROMOTIONS } from "../data/promotions";
import { POST_ARC } from "../data/postArcs";
import { ARCS } from "../story/beats";
import { defaultSave, setCharacterRecord, setCurrentSlot, setSevenPath, writeSave, type CharacterRecord } from "../util/save";

// Dev-only: open one chapter on one road straight from the URL, with the
// campaign before it already walked.
//
//   /play/?test=b28&path=vengeance             B28's prep screen, on that road
//   /play/?test=b28&path=vengeance&finale=1    B28 won on the spot, to watch
//                                              its finale (after its closing
//                                              dialogue)
//
// `test` takes a battle id or its number prefix (b28, b19_path_opener_exile,
// ...); `path` is any of the seven roads (vengeance by default once a
// chapter is past the fork); `level` sets the squad's level (20 by
// default), with the promotions the story would have granted by then.
//
// The save it seeds is a throwaway: it lives in the active mirror only.
// No slot is selected, so none of the three save slots is written — pick a
// slot as usual afterwards to get back to a real save. Imported by main.ts
// only in dev builds.

const SEVEN: SevenPath[] = ["vengeance", "restoration", "revolution", "duty", "exile", "mercy", "forgetting"];

interface BattleInternals {
  scene: Phaser.Scenes.ScenePlugin;
  state: { units: { id: string; faction: string; state: { hp: number; secondWindUsed?: boolean } }[] };
  unitViews: Map<string, { sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Ellipse }>;
  finalBlow: { attacker: string; target: string } | null;
  checkEnd(): boolean;
}

export const runTestRoute = (game: Phaser.Game): void => {
  const q = new URLSearchParams(window.location.search);
  const want = q.get("test");
  if (!want) return;
  const node = BATTLES.find((b) => b.id === want) ?? BATTLES.find((b) => b.id.startsWith(`${want}_`));
  if (!node) {
    console.warn(`[test] no battle "${want}"`);
    return;
  }
  const askedPath = q.get("path") as SevenPath | null;
  const path: SevenPath | null = askedPath && SEVEN.includes(askedPath) ? askedPath : null;
  const finale = q.get("finale") === "1";

  // The campaign up to this chapter, on the chosen road (one B19: its own).
  const road = node.id.startsWith("b19_") ? node.id.slice("b19_path_opener_".length) : path ?? "vengeance";
  const order = BATTLES.map((b) => b.id).filter((id) => !id.startsWith("b19_") || id === `b19_path_opener_${road}`);
  const done = order.slice(0, order.indexOf(node.id));
  let s = defaultSave();
  s.completedBattles = done;
  s.unlockedBattles = [...done, node.id];
  s.squadInventory = ["potion", "potion", "potion", "elixir", "elixir", "elixir", "royal_lens", "mask", "fang"].map((k) => createItem(k as Parameters<typeof createItem>[0]));
  if (done.includes("b18_path_chosen") || node.id.startsWith("b19_")) s = setSevenPath(s, road as SevenPath);

  // The squad as the campaign would have left it: everyone at `level`
  // (20 by default, or ?level=N), grown by the same expected-value rule the
  // game uses to catch a rejoining veteran up, and promoted wherever a
  // story arc already played has promoted them.
  const level = Math.max(1, Math.min(LEVEL_CAP, Number(q.get("level") ?? LEVEL_CAP) || LEVEL_CAP));
  const promoted = new Set<string>();
  for (const id of done) {
    const arc = POST_ARC[id as keyof typeof POST_ARC];
    for (const beat of arc ? ARCS[arc]?.beats ?? [] : []) {
      if (beat.promote) promoted.add(beat.promote);
    }
  }
  for (const { recordId, factory } of ROSTER_ORDER) {
    const u = createUnit(factory(), { x: 0, y: 0 });
    catchUpToSquad(u, level);
    let rec: CharacterRecord = { level: u.level, xp: 0, stats: { ...u.stats } };
    const promo = PROMOTIONS[recordId];
    if (promo && promoted.has(recordId)) rec = promoteCharacter(rec, promo);
    s = setCharacterRecord(s, recordId, rec);
  }
  setCurrentSlot(null);
  writeSave(s);
  console.info(`[test] ${node.id}${path ? ` on ${road}` : ""}${finale ? " — finale" : ""}`);

  // Once the art has streamed in (so the board isn't drawn with stand-ins).
  const go = (): void => {
    const stream = game.scene.getScene("AssetStreamScene");
    if (!stream || stream.load.isLoading() || stream.load.totalComplete === 0) {
      window.setTimeout(go, 300);
      return;
    }
    for (const sc of [...game.scene.scenes]) {
      const key = sc.scene.key;
      if (key !== "BootScene" && key !== "AssetStreamScene" && (sc.scene.isActive() || sc.scene.isPaused())) game.scene.stop(key);
    }
    if (!finale) {
      game.scene.start("BattlePrepScene", { battleId: node.id });
      return;
    }
    game.scene.start("BattleScene", { battleId: node.id });
    // When the opening has played, win it: everyone across the board down,
    // the boss (or the last of them) taking the final blow from Amar.
    const win = (): void => {
      const b = game.scene.getScene("BattleScene") as unknown as BattleInternals;
      const dlg = game.scene.getScene("BattleDialogueScene");
      if (!b.scene.isActive() || dlg.scene.isActive()) { window.setTimeout(win, 300); return; }
      const foes = b.state.units.filter((u) => u.faction === "enemy");
      const boss = foes.find((u) => ["archbold", "dawn_boss", "ravage_commander"].includes(u.id)) ?? foes[foes.length - 1];
      if (!boss) return;
      for (const u of foes) {
        u.state.secondWindUsed = true;
        u.state.hp = 0;
        const v = b.unitViews.get(u.id);
        if (v && u !== boss) { v.sprite.setVisible(false); v.shadow.setVisible(false); }
      }
      b.finalBlow = { attacker: "amar", target: boss.id };
      b.checkEnd();
    };
    window.setTimeout(win, 1500);
  };
  go();
};
