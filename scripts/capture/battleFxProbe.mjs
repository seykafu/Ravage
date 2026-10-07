// Battle-impact probe: opens a battle on the campaign before it, and on the
// virtual clock captures the boss's entrance card, a critical-hit cut-in,
// and a painted slash + impact.
//
// Usage: node scripts/capture/battleFxProbe.mjs [battleId=b14_origin] [attacker=amar]
// Frames land in release/capture/battlefx/.

import { chromium } from "playwright";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const URL = process.env.CAP_URL ?? "http://127.0.0.1:5173/play/";
const [battleId = "b14_origin", attacker = "amar"] = process.argv.slice(2);
const out = path.resolve("release/capture/battlefx");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--mute-audio"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.log("  [page exception]", String(e).slice(0, 300)));
await page.goto(URL, { waitUntil: "load" });
await page.waitForFunction(() => { const s = window.__RAVAGE_GAME__?.scene.getScene("AssetStreamScene"); return !!s && s.load.totalComplete > 0 && !s.load.isLoading(); }, null, { timeout: 180000 });

await page.evaluate(async (battleId) => {
  const g = window.__RAVAGE_GAME__;
  const save = await import("/src/util/save.ts");
  const { BATTLES } = await import("/src/data/battles.ts");
  g.loop.stop(); g.loop.smoothStep = false;
  const wallBase = Date.now() + 1000, perfBase = performance.now();
  Date.now = () => Math.round(wallBase + (window.__cap ? window.__cap.t - perfBase : 0));
  g.registry.set("ravage:music", new Proxy({}, { get: () => () => {} }));
  for (const el of document.querySelectorAll("body > *")) { if (el.id !== "app" && el.tagName !== "SCRIPT" && /cookie|analytics/i.test(el.textContent || "")) el.remove(); }
  window.__cap = { t: performance.now(), step() { this.t += 1000 / 30; g.loop.step(this.t); } };
  const order = BATTLES.map((b) => b.id).filter((id) => !id.startsWith("b19_") || id === "b19_path_opener_vengeance");
  const s = save.defaultSave(); s.completedBattles = order.slice(0, order.indexOf(battleId)); s.unlockedBattles = [...s.completedBattles, battleId];
  save.setCurrentSlot(1); save.writeSave(s);
  for (const sc of [...g.scene.scenes]) if (!["BootScene", "AssetStreamScene"].includes(sc.scene.key) && (sc.scene.isActive() || sc.scene.isPaused())) g.scene.stop(sc.scene.key);
  g.scene.start("BattleScene", { battleId });
}, battleId);

const step = (n) => page.evaluate((k) => { for (let i = 0; i < k; i++) window.__cap.step(); }, n);
const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
const closeDialogue = () => page.evaluate(() => {
  const g = window.__RAVAGE_GAME__;
  const d = g.scene.getScene("BattleDialogueScene");
  if (d && d.scene.isActive()) d.scene.stop();
  const b = g.scene.getScene("BattleScene");
  if (b && b.scene.isPaused()) b.scene.resume();
});

await step(75); await shot("01_title");
await step(25); await shot("02_boss_intro");
await step(30); await shot("03_boss_intro_held");
// Past the entrance and the phase banner; close the chapter's opening
// lines whenever they come up.
for (let i = 0; i < 12; i++) { await step(20); await closeDialogue(); }
await shot("04_board");

// A critical-hit cut-in for the attacker, then a painted slash and impact
// on the nearest enemy.
await page.evaluate(async (id) => {
  const g = window.__RAVAGE_GAME__;
  const b = g.scene.getScene("BattleScene");
  const { critCutIn } = await import("/src/scenes/battle/CutIn.ts");
  const u = b.state.units.find((x) => x.id === id) ?? b.state.units.find((x) => x.faction === "player");
  window.__cut = critCutIn(b, (o) => b.pin(o), u);
}, attacker);
await step(6); await shot("05_cutin_open");
await step(10); await shot("06_cutin_cry");
await step(20); await shot("07_cutin_end");
await page.evaluate(async () => {
  const g = window.__RAVAGE_GAME__;
  const b = g.scene.getScene("BattleScene");
  const { slashArc, hitSpark, healGlow } = await import("/src/scenes/battle/CombatVfx.ts");
  const foe = b.state.units.find((x) => x.faction === "enemy" && x.state.alive);
  const v = b.unitViews.get(foe.id);
  slashArc(b, (o) => b.addWorld(o), v.sprite.x, v.sprite.y, 0, true);
  hitSpark(b, (o) => b.addWorld(o), v.sprite.x, v.sprite.y, true);
  const ally = b.state.units.find((x) => x.faction === "player" && x.state.alive);
  const av = b.unitViews.get(ally.id);
  healGlow(b, (o) => b.addWorld(o), av.sprite.x, av.sprite.y);
  b.cameras.main.setZoom(b.cameras.main.zoom * 1.8);
  b.focusUnit(foe);
});
for (let i = 0; i < 5; i++) { await step(3); await shot(`08_fx_${i}`); }
console.log("[battlefx] frames in", out);
await browser.close();
