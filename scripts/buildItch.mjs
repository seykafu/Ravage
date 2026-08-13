// Build the itch.io package: a self-contained zip whose index.html sits at
// the archive root and loads everything by RELATIVE path (itch serves HTML
// games from a deep CDN path inside an iframe — absolute "/" URLs 404).
//
// How it works with the normal deploy:
//   * ravage.game build: `npm run build` — base "/", marketing page at /,
//     game at /play/. Unchanged.
//   * itch build: `npm run build:itch` — base "./", then the built game
//     page (dist-itch/play/index.html) is promoted to the archive root
//     with its ../ and /-absolute references rewritten, because at the
//     zip root it sits BESIDE assets/, audio/, fonts/ and video/.
//     Runtime fetches follow import.meta.env.BASE_URL ("./" here), so
//     the Phaser streamer and the intro video resolve relative to the
//     page. See src/assets/streaming.ts.
//
// Output: dist-itch/ (inspectable) and release/ravage-itch.zip (upload
// this to itch, ticked "This file will be played in the browser").

import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const out = join(root, "dist-itch");
const run = (cmd) => execSync(cmd, { cwd: root, stdio: "inherit" });

console.log("[itch] hashing assets…");
run("node scripts/hashAssets.mjs");
console.log("[itch] type-checking…");
run("npx tsc -b");
console.log("[itch] building with relative base…");
run('npx vite build --base=./ --outDir dist-itch --emptyOutDir');

console.log("[itch] promoting the game page to the archive root…");
const playHtml = join(out, "play", "index.html");
let html = readFileSync(playHtml, "utf-8");
// Built module/CSS refs point one level up from play/ — at the root they
// point straight in. Then flatten any remaining root-absolute references
// (self-hosted fonts in the inline stylesheet, favicons).
html = html.replaceAll("../", "");
html = html.replace(/(href|src)="\//g, '$1="');
html = html.replace(/url\('\//g, "url('");
writeFileSync(join(out, "index.html"), html);
rmSync(join(out, "play"), { recursive: true, force: true });

console.log("[itch] pruning non-shipped files…");
// The game plays video/intro_sound.* only. Everything else in video/ is
// marketing-page material (intro.*, poster) or raw editing sources
// (Footage.mp4, the .mov) that must not ship in the game package.
const PRUNE = [
  "video/Footage.mp4",
  "video/Ravage - Intro Video.mov",
  "video/intro.mp4",
  "video/intro.webm",
  "video/intro_poster.jpg"
];
for (const rel of PRUNE) rmSync(join(out, rel), { force: true });

console.log("[itch] zipping…");
const releaseDir = join(root, "release");
if (!existsSync(releaseDir)) mkdirSync(releaseDir);
const zipPath = join(releaseDir, "ravage-itch.zip");
rmSync(zipPath, { force: true });
if (process.platform === "win32") {
  run(`powershell -NoProfile -Command "Compress-Archive -Path 'dist-itch\\*' -DestinationPath 'release\\ravage-itch.zip'"`);
} else {
  execSync(`cd dist-itch && zip -qr ../release/ravage-itch.zip .`, { cwd: root, stdio: "inherit" });
}
const size = Math.round(readFileSync(zipPath).length / 1e6);
console.log(`[itch] done: release/ravage-itch.zip (${size}MB)`);
