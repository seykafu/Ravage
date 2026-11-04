// Performance probe: play a battle in real time on the machine's real GPU
// and report frame times (median, p95, p99, worst, and how many frames ran
// long), the long main-thread tasks with the BattleScene methods inside
// them, and what saving costs (JSON + localStorage time per write).
//
// Usage: node scripts/capture/perfProbe.mjs <battleId> [seconds=60] [rs=auto] [gpu=real|soft]
//   rs   the game's render scale (?rs=1..2), or "auto": what the game picks for
//        the window (PERF_VIEWPORT=1835x1032, PERF_DPR=1 set the window)
//   gpu  "real" asks Chromium for the hardware GPU (reported back as the
//        WebGL renderer string); "soft" is SwiftShader, like the other probes
//
// The squad passes each turn and the enemy acts, so every attack, death,
// counter and cut-in the AI produces is timed; dialogue is closed as it opens.
import { chromium } from "playwright";

const BASE = process.env.CAP_URL ?? "http://127.0.0.1:5173/play/";
const id = process.argv[2] ?? "b20_dawn_war";
const SECONDS = Number(process.argv[3] ?? 60);
const RS = process.argv[4] ?? "auto";
const GPU = process.argv[5] ?? "real";

const args = GPU === "real"
  ? ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu-rasterization", "--mute-audio"]
  : ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--mute-audio"];
const browser = await chromium.launch({ channel: GPU === "real" ? "chromium" : undefined, args });
const [VW, VH] = (process.env.PERF_VIEWPORT ?? "1280x720").split("x").map(Number);
const page = await browser.newPage({ viewport: { width: VW, height: VH }, deviceScaleFactor: Number(process.env.PERF_DPR ?? 1) });
page.on("pageerror", (e) => console.log("PAGE ERROR", String(e.message).slice(0, 200)));
page.on("console", (m) => { if (m.text().startsWith("[render]")) console.log("  " + m.text()); });
await page.goto(RS === "auto" ? BASE : `${BASE}?rs=${RS}`, { waitUntil: "load" });
await page.waitForFunction(() => {
  const s = window.__RAVAGE_GAME__?.scene.getScene("AssetStreamScene");
  return !!s && s.load.totalComplete > 0 && !s.load.isLoading();
}, null, { timeout: 240_000 });

const scale = await page.evaluate(() => ({ w: window.__RAVAGE_GAME__.config.width, h: window.__RAVAGE_GAME__.config.height }));
const renderer = await page.evaluate(() => {
  const gl = document.createElement("canvas").getContext("webgl");
  const ext = gl?.getExtension("WEBGL_debug_renderer_info");
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown";
});

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

  // Saving: time every JSON round-trip of a big string and every storage write.
  window.__io = [];
  const S = Storage.prototype, J = JSON;
  const setItem = S.setItem, stringify = J.stringify, parse = J.parse;
  S.setItem = function (k, v) { const t = performance.now(); const r = setItem.call(this, k, v); window.__io.push({ op: "setItem", ms: performance.now() - t, kb: String(v).length / 1024 }); return r; };
  J.stringify = function (...a) { const t = performance.now(); const r = stringify.apply(J, a); if (r && r.length > 20000) window.__io.push({ op: "stringify", ms: performance.now() - t, kb: r.length / 1024 }); return r; };
  J.parse = function (...a) { const t = performance.now(); const r = parse.apply(J, a); if (typeof a[0] === "string" && a[0].length > 20000) window.__io.push({ op: "parse", ms: performance.now() - t, kb: a[0].length / 1024 }); return r; };

  const g = window.__RAVAGE_GAME__;
  for (const sc of [...g.scene.scenes]) {
    if (!["BootScene", "AssetStreamScene"].includes(sc.scene.key) && (sc.scene.isActive() || sc.scene.isPaused())) g.scene.stop(sc.scene.key);
  }
  g.scene.start("BattleScene", { battleId: target });

  // BattleScene methods over 16ms, to name what's inside a long task.
  const b = g.scene.getScene("BattleScene");
  window.__slow = [];
  const proto = Object.getPrototypeOf(b);
  for (const name of Object.getOwnPropertyNames(proto)) {
    const fn = proto[name];
    if (typeof fn !== "function" || name === "constructor") continue;
    proto[name] = function (...a) {
      const t0 = performance.now();
      const r = fn.apply(this, a);
      const dt = performance.now() - t0;
      if (dt > 16) window.__slow.push({ name, ms: Math.round(dt), at: Math.round(t0) });
      return r;
    };
  }
  window.__long = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__long.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) }); })
    .observe({ type: "longtask", buffered: false });
  // Every frame's time, tagged with who is acting.
  window.__frames = [];
  let last = performance.now();
  const tick = (now) => {
    const bb = g.scene.getScene("BattleScene");
    const u = bb?.initiative?.current?.();
    window.__frames.push({ dt: now - last, side: u ? u.faction : "-" });
    last = now;
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}, id);

const t0 = Date.now();
await page.waitForTimeout(4000);
console.log("  effects:", await page.evaluate(() => {
  const g = window.__RAVAGE_GAME__;
  return g.scene.getScenes(true).flatMap((sc) => sc.cameras.cameras.map((c, i) =>
    `${sc.scene.key}#${i}[${(c.postPipelines ?? []).map((p) => p.name).join("+")}${c.postFX?.list?.length ? " fx:" + c.postFX.list.map((f) => f.constructor?.name ?? f.type).join("+") : ""}]`
  )).join("  ");
}));
// PERF_STRIP=bloom,color,tilt switches battle effects off, to measure each one's cost.
const strip = (process.env.PERF_STRIP ?? "").split(",").filter(Boolean);
if (strip.length) {
  console.log("  (stripped:", strip.join(", ") + ")");
  await page.evaluate((strip) => {
    const cam = window.__RAVAGE_GAME__.scene.getScene("BattleScene").cameras.main;
    if (strip.includes("bloom")) cam.removePostPipeline("RavageBloom");
    if (strip.includes("color")) cam.postFX.clear();
    if (strip.includes("tilt")) cam.removePostPipeline("RavagePerspective");
  }, strip);
  console.log("  after strip:", await page.evaluate(() => (window.__RAVAGE_GAME__.scene.getScene("BattleScene").cameras.main.postPipelines ?? []).map((p) => p.name).join("+") || "(none)"));
}
await page.evaluate(() => { window.__frames.length = 0; window.__long.length = 0; window.__slow.length = 0; window.__io.length = 0; });
while (Date.now() - t0 < SECONDS * 1000) {
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    const g = window.__RAVAGE_GAME__;
    const b = g.scene.getScene("BattleScene");
    if (!b?.scene.isActive() && !b?.scene.isPaused()) return;
    if (g.scene.getScene("BattleDialogueScene").scene.isActive()) { g.scene.stop("BattleDialogueScene"); g.scene.resume("BattleScene"); return; }
    const u = b.initiative?.current?.();
    if (u && u.faction === "player" && b.fsm.current().tag !== "playerAnimating" && !b.spin) b.endCurrentTurn();
  });
}
const out = await page.evaluate(() => ({ frames: window.__frames, long: window.__long, slow: window.__slow, io: window.__io }));
await browser.close();

const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const f = (x) => x.toFixed(1);
const dts = out.frames.map((x) => x.dt);
console.log(`${id}  rs=${RS} (buffer ${scale.w}x${scale.h}, window ${VW}x${VH})  gpu=${GPU} (${renderer})`);
console.log(`  frames ${dts.length} in ~${SECONDS - 4}s → ${f(dts.length / (SECONDS - 4))} fps avg`);
console.log(`  frame ms: median ${f(pct(dts, 0.5))}  p95 ${f(pct(dts, 0.95))}  p99 ${f(pct(dts, 0.99))}  worst ${f(Math.max(...dts, 0))}`);
console.log(`  frames over 33ms: ${dts.filter((d) => d > 33.4).length}   over 50ms: ${dts.filter((d) => d > 50).length}   over 100ms: ${dts.filter((d) => d > 100).length}`);
for (const side of ["player", "enemy"]) {
  const s = out.frames.filter((x) => x.side === side).map((x) => x.dt);
  if (s.length) console.log(`  during ${side} turns: median ${f(pct(s, 0.5))}  p95 ${f(pct(s, 0.95))}  worst ${f(Math.max(...s))}`);
}
console.log(`  long tasks: ${out.long.length} (over 100ms: ${out.long.filter((l) => l.ms > 100).length})`);
for (const l of [...out.long].sort((a, b) => b.ms - a.ms).slice(0, 8)) {
  const inside = out.slow.filter((s) => s.at >= l.at - 5 && s.at <= l.at + l.ms).sort((a, b) => b.ms - a.ms).slice(0, 4);
  console.log(`    ${l.ms}ms  ←  ${inside.map((s) => `${s.name} ${s.ms}ms`).join(", ") || "(no BattleScene method over 16ms)"}`);
}
const byOp = {};
for (const e of out.io) { (byOp[e.op] ??= []).push(e); }
for (const [op, es] of Object.entries(byOp)) {
  console.log(`  ${op}: ${es.length}×  total ${f(es.reduce((a, e) => a + e.ms, 0))}ms  worst ${f(Math.max(...es.map((e) => e.ms)))}ms  size ${f(Math.max(...es.map((e) => e.kb)))}KB`);
}
