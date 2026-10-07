// Recruit-level probe: starts a battle on a save whose squad is at a given
// level and prints every player unit's level as the battle fields them —
// how a newcomer (Veya at B14, Corin at B17) arrives.
//
// Usage: node scripts/capture/joinProbe.mjs <battleId> [squadLevel=13] [stale=id:level,...]
//   stale: characters whose record is left at an old level (Selene and
//   Ranatoli carry their B1 records to B23: selene:10,ranatoli:10).

import { chromium } from "playwright";

const URL = process.env.CAP_URL ?? "http://127.0.0.1:5173/play/";
const [battleId = "b14_origin", lvArg = "13", staleArg = ""] = process.argv.slice(2);
const stale = Object.fromEntries(staleArg.split(",").filter(Boolean).map((kv) => { const [k, v] = kv.split(":"); return [k, Number(v)]; }));

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--mute-audio"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.log("  [page exception]", String(e).slice(0, 300)));
await page.goto(URL, { waitUntil: "load" });
await page.waitForFunction(() => {
  const g = window.__RAVAGE_GAME__;
  return !!g && g.scene.scenes.some((s) => s.scene.isActive() && s.scene.key !== "BootScene");
}, null, { timeout: 60_000 });

const result = await page.evaluate(async ({ battleId, level, stale }) => {
  const g = window.__RAVAGE_GAME__;
  const save = await import("/src/util/save.ts");
  const { BATTLES } = await import("/src/data/battles.ts");
  const { createUnit } = await import("/src/combat/Unit.ts");
  const { catchUpToSquad } = await import("/src/combat/Progression.ts");
  const { ROSTER_ORDER } = await import("/src/data/activeRoster.ts");
  const order = BATTLES.map((b) => b.id).filter((id) => !id.startsWith("b19_") || id === "b19_path_opener_vengeance");
  const done = order.slice(0, order.indexOf(battleId));
  let s = save.defaultSave();
  s.completedBattles = done;
  s.unlockedBattles = [...done, battleId];
  // Everyone who has fought so far, at `level` (or their stale level).
  const fought = new Set(done.flatMap((b) => BATTLES.find((x) => x.id === b)?.buildPlayers().map((d) => d.id) ?? []));
  for (const { recordId, factory } of ROSTER_ORDER) {
    if (!fought.has(recordId)) continue;
    const u = createUnit(factory(), { x: 0, y: 0 });
    catchUpToSquad(u, stale[recordId] ?? level);
    s = save.setCharacterRecord(s, recordId, { level: u.level, xp: 0, stats: { ...u.stats } });
  }
  save.setCurrentSlot(1);
  save.writeSave(s);
  for (const sc of [...g.scene.scenes]) {
    if (!["BootScene", "AssetStreamScene"].includes(sc.scene.key) && (sc.scene.isActive() || sc.scene.isPaused())) g.scene.stop(sc.scene.key);
  }
  g.scene.start("BattleScene", { battleId });
  await new Promise((r) => setTimeout(r, 2500));
  const b = g.scene.getScene("BattleScene");
  return {
    players: b.state.units.filter((u) => u.faction === "player").map((u) => `${u.id} L${u.level} hp${u.stats.hp}`),
    enemies: b.state.units.filter((u) => u.faction === "enemy").map((u) => `${u.id} L${u.level}`)
  };
}, { battleId, level: Number(lvArg), stale });
console.log(battleId, "squad at L" + lvArg);
console.log("  players:", result.players.join(", "));
console.log("  enemies:", result.enemies.join(", "));
await browser.close();
