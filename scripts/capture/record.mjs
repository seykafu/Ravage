// Deterministic gameplay capture.
//
// Drives the real game in headless Chromium and writes one PNG per frame,
// then muxes them into an mp4 with ffmpeg.
//
// The whole thing hinges on owning the clock. Phaser's TimeStep.step(time)
// takes an explicit timestamp, so we stop the RAF loop and hand the game
// exactly 1/FPS of game-time per captured frame. Capture can then take as
// long as it likes — 80ms of wall time per screenshot still produces a
// perfectly paced 30fps video, and animations/tweens/delayedCalls all
// advance on our clock rather than the wall's.
//
// Usage:  node scripts/capture/record.mjs <shotlist> [outName]
//   e.g.  node scripts/capture/record.mjs proof ravage-proof

import { chromium } from "playwright";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { SHOTLISTS } from "./shots.mjs";

const FPS = 30;
// 127.0.0.1, not "localhost": Vite binds IPv4 only, and Chromium resolves
// localhost to ::1 first — which fails with ERR_CONNECTION_REFUSED even
// though the server is plainly up and serving on the same port.
const URL = process.env.CAP_URL ?? "http://127.0.0.1:5173/play/";
const ROOT = path.resolve("release/capture");

const listName = process.argv[2] ?? "proof";
const outName = process.argv[3] ?? `ravage-${listName}`;
const shots = SHOTLISTS[listName];
if (!shots) {
  console.error(`unknown shotlist "${listName}". known: ${Object.keys(SHOTLISTS).join(", ")}`);
  process.exit(1);
}

const framesDir = path.join(ROOT, "frames");
rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

const totalFrames = shots.reduce((n, s) => n + Math.round(s.seconds * FPS), 0);
console.log(`[cap] ${listName}: ${shots.length} shots, ${(totalFrames / FPS).toFixed(1)}s, ${totalFrames} frames`);

const browser = await chromium.launch({
  args: [
    // Phaser wants WebGL; SwiftShader gives headless a real GL context so
    // we get the shipped renderer rather than Phaser's canvas fallback.
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--hide-scrollbars",
    "--mute-audio"
  ]
});
const page = await browser.newPage({
  viewport: { width: 1280, height: 720 },
  deviceScaleFactor: 1
});

page.on("console", (m) => {
  if (m.type() === "error") console.log("  [page error]", m.text().slice(0, 140));
});

console.log("[cap] loading", URL);
await page.goto(URL, { waitUntil: "load" });

// Wait for the game object AND for boot/asset streaming to hand off.
await page.waitForFunction(() => {
  const g = window.__RAVAGE_GAME__;
  if (!g) return false;
  return g.scene.scenes.some((s) => s.scene.isActive() && s.scene.key !== "BootScene");
}, null, { timeout: 60_000 });
console.log("[cap] game up");

// Install the capture control surface in the page. Module handles come
// through dynamic import so shots can seed saves and drive combat with
// the game's own code rather than re-implementing any of it.
await page.evaluate(async (fps) => {
  const g = window.__RAVAGE_GAME__;
  const [save, items, arcs, unitApi, battles] = await Promise.all([
    import("/src/util/save.ts"),
    import("/src/combat/items.ts"),
    import("/src/story/beats.ts"),
    import("/src/combat/Unit.ts"),
    import("/src/data/battles.ts")
  ]);
  // Own the clock.
  g.loop.stop();
  g.loop.smoothStep = false;
  // Silence music — frames carry no audio, and the reel is scored in
  // ffmpeg from the real mp3s afterward.
  const silent = new Proxy({}, { get: () => () => {} });
  g.registry.set("ravage:music", silent);

  // Strip the DOM chrome that isn't part of the game: the analytics
  // consent banner is an HTML overlay and would sit in every frame.
  // Removed rather than answered — this is a capture rig, and recording
  // a consent choice on the user's behalf isn't ours to make.
  const dropBanner = () => {
    for (const el of document.querySelectorAll("body > *")) {
      if (el.id === "app" || el.tagName === "SCRIPT" || el.tagName === "STYLE") continue;
      const txt = (el.textContent || "").toLowerCase();
      if (txt.includes("cookie") || txt.includes("analytics")) el.remove();
    }
  };
  dropBanner();
  setInterval(dropBanner, 250);

  window.__cap = {
    t: performance.now(),
    dt: 1000 / fps,
    step() {
      this.t += this.dt;
      g.loop.step(this.t);
    },
    game: g,
    scene(key) { return g.scene.getScene(key); },
    activeKeys() {
      return g.scene.scenes.filter((s) => s.scene.isActive()).map((s) => s.scene.key);
    },
    // Hard cut to a scene. scene.start() alone leaves the PREVIOUS scene
    // running — the first proof had the title screen's logo and buttons
    // rendering straight through the battle board. Stop everything that
    // isn't infrastructure, then start the one we want.
    save, items, arcs, unitApi, battles,
    goto(key, data) {
      const keep = new Set(["BootScene", "AssetStreamScene", key]);
      for (const s of [...g.scene.scenes]) {
        if (!keep.has(s.scene.key) && (s.scene.isActive() || s.scene.isPaused())) {
          g.scene.stop(s.scene.key);
        }
      }
      g.scene.start(key, data);
    }
  };
}, FPS);

let frame = 0;
const t0 = Date.now();

for (const [si, shot] of shots.entries()) {
  const n = Math.round(shot.seconds * FPS);
  process.stdout.write(`[cap] shot ${si + 1}/${shots.length} ${shot.name} (${shot.seconds}s)`);

  if (shot.setup) {
    await page.evaluate(shot.setup, shot.args ?? null);
    // Settle: let the scene build without recording, so we never open on
    // a half-constructed frame.
    const settle = shot.settleFrames ?? 6;
    for (let i = 0; i < settle; i++) await page.evaluate(() => window.__cap.step());
  }

  for (let i = 0; i < n; i++) {
    if (shot.each) {
      await page.evaluate(shot.each, { i, n, args: shot.args ?? null });
    }
    await page.evaluate(() => window.__cap.step());
    await page.screenshot({
      path: path.join(framesDir, `f${String(frame).padStart(5, "0")}.png`),
      type: "png",
      animations: "allow"
    });
    frame++;
  }
  process.stdout.write(` ✓\n`);
}

const secs = ((Date.now() - t0) / 1000).toFixed(0);
console.log(`[cap] ${frame} frames in ${secs}s wall`);
await browser.close();

// ---- encode -------------------------------------------------------------
const silentMp4 = path.join(ROOT, `${outName}-silent.mp4`);
const enc = spawnSync("ffmpeg", [
  "-y", "-framerate", String(FPS),
  "-i", path.join(framesDir, "f%05d.png"),
  "-c:v", "libx264", "-preset", "slow", "-crf", "18",
  "-pix_fmt", "yuv420p",
  "-movflags", "+faststart",
  silentMp4
], { stdio: ["ignore", "ignore", "pipe"] });
if (enc.status !== 0) {
  console.error(enc.stderr.toString().split("\n").slice(-15).join("\n"));
  process.exit(1);
}
console.log("[cap] encoded", silentMp4);
writeFileSync(path.join(ROOT, `${outName}.frames.txt`), String(frame));
if (!existsSync(silentMp4)) process.exit(1);
