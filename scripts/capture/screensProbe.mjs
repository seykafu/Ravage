// Screens probe: the title, the credits parade, the recap, the Seven Paths
// choice and its commit, the promotion transformation, and a won battle's
// cheer + best-of-the-battle card — each captured on the virtual clock.
//
// Usage: node scripts/capture/screensProbe.mjs [only=title,credits,recap,choice,promo,victory]
// Frames land in release/capture/screens/.

import { chromium } from "playwright";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const URL = process.env.CAP_URL ?? "http://127.0.0.1:5173/play/";
const only = (process.argv[2] ?? "title,credits,recap,choice,promo,victory").split(",");
const out = path.resolve("release/capture/screens");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--mute-audio"] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on("pageerror", (e) => console.log("  [page exception]", String(e).slice(0, 300)));
await page.goto(URL, { waitUntil: "load" });
await page.waitForFunction(() => { const s = window.__RAVAGE_GAME__?.scene.getScene("AssetStreamScene"); return !!s && s.load.totalComplete > 0 && !s.load.isLoading(); }, null, { timeout: 180000 });
await page.evaluate(async () => {
  const g = window.__RAVAGE_GAME__;
  g.loop.stop(); g.loop.smoothStep = false;
  const wallBase = Date.now() + 1000, perfBase = performance.now();
  Date.now = () => Math.round(wallBase + (window.__cap ? window.__cap.t - perfBase : 0));
  g.registry.set("ravage:music", new Proxy({}, { get: () => () => {} }));
  for (const el of document.querySelectorAll("body > *")) { if (el.id !== "app" && el.tagName !== "SCRIPT" && /cookie|analytics/i.test(el.textContent || "")) el.remove(); }
  window.__cap = { t: performance.now(), step() { this.t += 1000 / 30; g.loop.step(this.t); } };
  window.__go = (key, data) => {
    for (const s of [...g.scene.scenes]) if (!["BootScene", "AssetStreamScene"].includes(s.scene.key) && (s.scene.isActive() || s.scene.isPaused())) g.scene.stop(s.scene.key);
    g.scene.start(key, data);
  };
  // A save partway through the campaign, its squad at level 14.
  const save = await import("/src/util/save.ts");
  const { BATTLES } = await import("/src/data/battles.ts");
  const { createUnit } = await import("/src/combat/Unit.ts");
  const { catchUpToSquad } = await import("/src/combat/Progression.ts");
  const { ROSTER_ORDER } = await import("/src/data/activeRoster.ts");
  let s = save.defaultSave();
  const order = BATTLES.map((b) => b.id).filter((id) => !id.startsWith("b19_") || id === "b19_path_opener_vengeance");
  s.completedBattles = order.slice(0, order.indexOf("b15_inner_coup"));
  s.unlockedBattles = [...s.completedBattles, "b15_inner_coup"];
  for (const { recordId, factory } of ROSTER_ORDER) {
    const u = createUnit(factory(), { x: 0, y: 0 }); catchUpToSquad(u, 14);
    s = save.setCharacterRecord(s, recordId, { level: u.level, xp: 0, stats: { ...u.stats } });
  }
  save.setCurrentSlot(1); save.writeSave(s);
});
const step = (n) => page.evaluate((k) => { for (let i = 0; i < k; i++) window.__cap.step(); }, n);
const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
const go = (key, data) => page.evaluate(([k, d]) => window.__go(k, d), [key, data ?? {}]);

if (only.includes("title")) {
  await go("TitleScene"); await step(15); await shot("title_0_5s");
  await step(45); await shot("title_2s"); await step(40); await shot("title_3_3s");
}
if (only.includes("credits")) {
  await go("CreditsScene"); await step(240); await shot("credits_8s");
}
if (only.includes("recap")) {
  await go("RecapScene"); await step(110); await shot("recap_3_6s");
}
if (only.includes("choice")) {
  await go("ChoiceScene"); await step(20); await shot("choice_0_7s"); await step(40); await shot("choice_2s");
  await page.evaluate(() => {
    const c = window.__RAVAGE_GAME__.scene.getScene("ChoiceScene");
    c.selected = { path: "mercy", name: "Mercy", honors: "for Yul", blurb: "", full: "", openerBattle: "b19_path_opener_mercy" };
    c.commit();
  });
  await step(36); await shot("choice_commit");
}
if (only.includes("promo")) {
  await go("PromotionScene", { characterId: "veya", resumeKey: "" });
  for (const [n, name] of [[18, "promo_0_6s"], [27, "promo_1_5s"], [9, "promo_flash"], [24, "promo_name"], [45, "promo_3s"]]) { await step(n); await shot(name); }
  // (The panel is made in a promise callback, after the step loop's last
  // frame: one more step draws it.)
  await step(2); await shot("promo_panel");
}
if (only.includes("victory")) {
  await go("BattleScene", { battleId: "b12_ravage" });
  for (let i = 0; i < 14; i++) {
    await step(20);
    await page.evaluate(() => {
      const g = window.__RAVAGE_GAME__;
      const d = g.scene.getScene("BattleDialogueScene");
      if (d && d.scene.isActive()) d.scene.stop();
      const b = g.scene.getScene("BattleScene");
      if (b && b.scene.isPaused()) b.scene.resume();
    });
  }
  await page.evaluate(() => {
    const b = window.__RAVAGE_GAME__.scene.getScene("BattleScene");
    b.tally.set("maya", { damage: 74, kills: 3, heals: 0 });
    b.tally.set("amar", { damage: 40, kills: 1, heals: 0 });
    for (const u of b.state.units.filter((u) => u.faction === "enemy")) {
      u.state.hp = 0; u.state.alive = false; const v = b.unitViews.get(u.id); if (v) { v.sprite.setVisible(false); v.shadow.setVisible(false); }
    }
    b.checkEnd();
  });
  for (let i = 0; i < 2; i++) {
    await step(6);
    await page.evaluate(() => {
      const g = window.__RAVAGE_GAME__;
      const d = g.scene.getScene("BattleDialogueScene");
      if (d && d.scene.isActive()) d.scene.stop();
      const b = g.scene.getScene("BattleScene");
      if (b && b.scene.isPaused()) b.scene.resume();
    });
  }
  await shot("victory_cheer"); await step(8); await shot("victory_cheer_b");
  for (let i = 0; i < 40; i++) {
    await step(20);
    const k = await page.evaluate(() => {
      const g = window.__RAVAGE_GAME__;
      const d = g.scene.getScene("BattleDialogueScene");
      if (d && d.scene.isActive()) d.scene.stop();
      const b = g.scene.getScene("BattleScene");
      if (b && b.scene.isPaused()) b.scene.resume();
      return g.scene.getScene("EndScene").scene.isActive();
    });
    if (k) break;
  }
  await step(60); await shot("victory_endscene");
}
console.log("[screens] frames in", out);
await browser.close();
