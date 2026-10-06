// First-battle tutorial probe: opens B1 on a fresh save, steps the virtual
// clock, and clicks through the tips with the real mouse — "Got it", the
// ✕, and "Skip tutorial" — screenshotting each, and checks that a click on
// the card never reaches the board under it (the active unit must not move).
//
// Usage: node scripts/capture/tutorialProbe.mjs
// Frames land in release/capture/tutorial/.

import { chromium } from "playwright";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const FPS = 30;
const URL = process.env.CAP_URL ?? "http://127.0.0.1:5173/play/";
const out = path.resolve("release/capture/tutorial");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--mute-audio"]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("  [page exception]", String(e).slice(0, 300)));
await page.goto(URL, { waitUntil: "load" });
await page.waitForFunction(() => {
  const g = window.__RAVAGE_GAME__;
  return !!g && g.scene.scenes.some((s) => s.scene.isActive() && s.scene.key !== "BootScene");
}, null, { timeout: 60_000 });
await page.waitForFunction(() => {
  const s = window.__RAVAGE_GAME__?.scene.getScene("AssetStreamScene");
  return !!s && s.load.totalComplete > 0 && !s.load.isLoading();
}, null, { timeout: 180_000 });

await page.evaluate(async (fps) => {
  const g = window.__RAVAGE_GAME__;
  const save = await import("/src/util/save.ts");
  g.loop.stop();
  g.loop.smoothStep = false;
  const wallBase = Date.now() + 1000;
  const perfBase = performance.now();
  Date.now = () => Math.round(wallBase + (window.__cap ? window.__cap.t - perfBase : 0));
  g.registry.set("ravage:music", new Proxy({}, { get: () => () => {} }));
  for (const el of document.querySelectorAll("body > *")) {
    if (el.id === "app" || el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
    const txt = (el.textContent || "").toLowerCase();
    if (txt.includes("cookie") || txt.includes("analytics")) el.remove();
  }
  window.__cap = { t: performance.now(), dt: 1000 / fps, step() { this.t += this.dt; g.loop.step(this.t); } };
  save.setCurrentSlot(1);
  save.writeSave(save.defaultSave());
  for (const s of [...g.scene.scenes]) {
    if (!["BootScene", "AssetStreamScene"].includes(s.scene.key) && (s.scene.isActive() || s.scene.isPaused())) g.scene.stop(s.scene.key);
  }
  g.scene.start("BattleScene", { battleId: "b01_palace_coup" });
}, FPS);

const step = (n) => page.evaluate((k) => { for (let i = 0; i < k; i++) window.__cap.step(); }, n);
const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
// Close any story dialogue the battle opens with, so the board has the input.
const closeDialogue = () => page.evaluate(() => {
  const g = window.__RAVAGE_GAME__;
  const d = g.scene.getScene("BattleDialogueScene");
  if (d && d.scene.isActive()) d.scene.stop();
  const b = g.scene.getScene("BattleScene");
  if (b && b.scene.isPaused()) b.scene.resume();
});
const tip = () => page.evaluate(() => {
  const t = window.__RAVAGE_GAME__.scene.getScene("BattleScene").tutorial;
  return t ? { idx: t.idx, showing: t.showing, done: t.done, card: t.card ? { x: t.card.x, y: t.card.y, w: t.card.width, h: t.card.height } : null } : null;
});
const where = () => page.evaluate(() => {
  const b = window.__RAVAGE_GAME__.scene.getScene("BattleScene");
  const u = b.initiative.current();
  return u ? `${u.id}@${u.state.position.x},${u.state.position.y}` : "-";
});
// Click in design px (the canvas fills the 1280×720 viewport), then let
// the click play out.
const click = async (x, y) => {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await step(2);
  await page.mouse.up();
  await step(8);
};

await step(150);
await closeDialogue();
await step(30);
console.log("tip 1", JSON.stringify(await tip()));
await shot("01_first_tip");
let t = await tip();
// "Got it" (bottom right of the card).
await click(t.card.x + t.card.w - 70, t.card.y + t.card.h - 28);
console.log("after Got it", JSON.stringify(await tip()));
await shot("02_second_tip");
// The ✕ closes the second tip.
t = await tip();
await click(t.card.x + t.card.w - 22, t.card.y + 22);
await step(60);
await closeDialogue();
await step(60);
console.log("after ✕", JSON.stringify(await tip()), await where());
await shot("03_move_tip");
// A click on the card's body must not reach the board under it.
t = await tip();
const before = await where();
if (t?.card) await click(t.card.x + 120, t.card.y + 60);
await step(40);
const after = await where();
console.log("card body click:", before, "->", after, before === after ? "OK (board untouched)" : "MOVED — click leaked");
// Skip tutorial ends the run.
t = await tip();
if (t?.card) await click(t.card.x + 90, t.card.y + t.card.h - 28);
await step(20);
console.log("after Skip", JSON.stringify(await tip()));
await shot("04_skipped");
const flag = await page.evaluate(async () => (await import("/src/util/save.ts")).loadSave().flags["tutorial_b01_done"]);
console.log("tutorial_b01_done =", flag);
await browser.close();
