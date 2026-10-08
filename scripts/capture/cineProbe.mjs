// Story cinematic probe: plays one story arc on the virtual clock and saves
// a frame every `every` frames, so a cinematic or stage can be checked
// shot by shot without recording a whole video.
//
// Usage:
//   node scripts/capture/cineProbe.mjs <arcId> <seconds> [every=15] [mode]
//     mode "start"       from the arc's first frame (its opening cinematic)
//     mode "stage:<id>"  skip any opening film, jump to the beat raising <id>
//     mode "beat:<n>"    skip any opening film, show beat n (0-based)
//     mode "end"         jump to the last beat and close the arc (its end film)
// Frames land in release/capture/cine/<arcId>-<mode>/.

import { chromium } from "playwright";
import { mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const FPS = 30;
const URL = process.env.CAP_URL ?? "http://127.0.0.1:5173/play/";
const [arcId, secondsArg, everyArg, mode = "start"] = process.argv.slice(2);
const seconds = Number(secondsArg ?? 10);
const every = Number(everyArg ?? 15);
const out = path.resolve("release/capture/cine", `${arcId}-${mode.replace(":", "_")}`);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--hide-scrollbars", "--mute-audio"]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
page.on("console", (m) => { if (m.type() === "error") console.log("  [page error]", m.text().slice(0, 200)); });
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

await page.evaluate(async ({ fps, arcId }) => {
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
  g.scene.start("StoryScene", { arcId });
}, { fps: FPS, arcId });

const step = (n) => page.evaluate((k) => { for (let i = 0; i < k; i++) window.__cap.step(); }, n);
await step(4);

if (mode.startsWith("stage:")) {
  const id = mode.slice("stage:".length);
  await page.keyboard.press("Escape");
  await step(90);
  await page.evaluate((id) => {
    const st = window.__RAVAGE_GAME__.scene.getScene("StoryScene");
    const i = st.beats.findIndex((b) => b.stage === id);
    // Raised fresh, from its first frame (a first-beat stage has been
    // running through the wait above).
    st.stage?.destroy(0); st.stage = undefined; st.stageId = undefined;
    st.idx = i;
    st.showBeat(st.beats[i]);
  }, id);
} else if (mode.startsWith("beat:")) {
  // A beat's text on screen (the script, as the player reads it).
  const n = Number(mode.slice("beat:".length));
  await page.keyboard.press("Escape");
  await step(90);
  await page.evaluate((n) => {
    const st = window.__RAVAGE_GAME__.scene.getScene("StoryScene");
    st.idx = n;
    st.showBeat(st.beats[n]);
  }, n);
} else if (mode === "end") {
  await page.keyboard.press("Escape");
  await step(90);
  await page.evaluate(() => {
    const st = window.__RAVAGE_GAME__.scene.getScene("StoryScene");
    st.idx = st.beats.length - 1;
    st.showBeat(st.beats[st.idx]);
    st.revealing = false;
    st.finishArc();
  });
}

const total = Math.round(seconds * FPS);
for (let f = 0; f < total; f += every) {
  await step(every);
  await page.screenshot({ path: path.join(out, `t${String(Math.round(((f + every) / FPS) * 10)).padStart(4, "0")}.png`) });
}
console.log("[cine] frames in", out);
await browser.close();
