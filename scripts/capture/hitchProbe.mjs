// Hitch probe: play a battle in real time and time every long main-thread
// task (a frame the browser couldn't draw because script was running),
// with what the battle was doing at the time and which of its methods ran
// longest inside it.
//
// Usage: node scripts/capture/hitchProbe.mjs <battleId> [seconds]
import { chromium } from "playwright";

const URL = process.env.CAP_URL ?? "http://127.0.0.1:5173/play/";
const id = process.argv[2] ?? "b20_dawn_war";
const SECONDS = Number(process.argv[3] ?? 120);

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--mute-audio"]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on("pageerror", (e) => console.log("PAGE ERROR", String(e.message).slice(0, 200)));
await page.goto(URL, { waitUntil: "load" });
await page.waitForFunction(() => {
  const s = window.__RAVAGE_GAME__?.scene.getScene("AssetStreamScene");
  return !!s && s.load.totalComplete > 0 && !s.load.isLoading();
}, null, { timeout: 240_000 });

await page.evaluate(async (target) => {
  const save = await import("/src/util/save.ts");
  const { BATTLES } = await import("/src/data/battles.ts");
  const order = BATTLES.map((b) => b.id).filter((b) => !b.startsWith("b19_") || b === "b19_path_opener_vengeance");
  const done = order.slice(0, order.indexOf(target));
  let s = save.defaultSave();
  s.completedBattles = done;
  s.unlockedBattles = [...done, target];
  if (done.includes("b18_path_chosen")) s = save.setSevenPath(s, "vengeance");
  save.setCurrentSlot(1);
  save.writeSave(s);
  const g = window.__RAVAGE_GAME__;
  for (const sc of [...g.scene.scenes]) {
    if (!["BootScene", "AssetStreamScene"].includes(sc.scene.key) && (sc.scene.isActive() || sc.scene.isPaused())) g.scene.stop(sc.scene.key);
  }
  g.scene.start("BattleScene", { battleId: target });

  // Time every BattleScene method call; keep the slowest ones per long task.
  const b = g.scene.getScene("BattleScene");
  window.__slow = [];
  const proto = Object.getPrototypeOf(b);
  for (const name of Object.getOwnPropertyNames(proto)) {
    const fn = proto[name];
    if (typeof fn !== "function" || name === "constructor") continue;
    proto[name] = function (...args) {
      const t0 = performance.now();
      const r = fn.apply(this, args);
      const dt = performance.now() - t0;
      if (dt > 40) window.__slow.push({ name, ms: Math.round(dt), at: Math.round(t0) });
      return r;
    };
  }
  window.__long = [];
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      const bb = g.scene.getScene("BattleScene");
      const u = bb.initiative?.current?.();
      window.__long.push({ at: Math.round(e.startTime), ms: Math.round(e.duration), actor: u ? `${u.id}/${u.faction}` : null, fsm: bb.fsm?.current?.().tag });
    }
  }).observe({ type: "longtask", buffered: false });
}, id);

const t0 = Date.now();
while (Date.now() - t0 < SECONDS * 1000) {
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const g = window.__RAVAGE_GAME__;
    const b = g.scene.getScene("BattleScene");
    if (g.scene.getScene("BattleDialogueScene").scene.isActive()) { g.scene.stop("BattleDialogueScene"); g.scene.resume("BattleScene"); return; }
    const u = b.initiative?.current?.();
    if (u && u.faction === "player" && b.fsm.current().tag !== "playerAnimating" && !b.spin) b.endCurrentTurn();
  });
}
const out = await page.evaluate(() => ({ long: window.__long, slow: window.__slow }));
const big = out.long.filter((l) => l.ms > 250).sort((a, b) => b.ms - a.ms).slice(0, 15);
console.log(`${id}: ${out.long.length} long tasks; over 250ms: ${out.long.filter((l) => l.ms > 250).length}`);
for (const l of big) {
  const inside = out.slow.filter((s) => s.at >= l.at - 5 && s.at <= l.at + l.ms).sort((a, b) => b.ms - a.ms).slice(0, 6);
  console.log(`  ${l.ms}ms  ${l.actor} ${l.fsm}  ←  ${inside.map((s) => `${s.name} ${s.ms}ms`).join(", ")}`);
}
await browser.close();
