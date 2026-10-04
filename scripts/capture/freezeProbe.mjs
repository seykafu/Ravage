// Freeze probe: play the real route into every chapter — camp, "Start Next
// Chapter", prep, "March to Battle" — in real time, click through any
// opening dialogue, and report anything that stops the battle: page
// errors, a game loop that stops ticking, a battle left paused with no
// overlay up, or a player turn that never hands over control.
//
// Usage: node scripts/capture/freezeProbe.mjs [battleId,battleId,...]
import { chromium } from "playwright";

const URL = process.env.CAP_URL ?? "http://127.0.0.1:5173/play/";
const only = process.argv[2]?.split(",");

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--mute-audio"]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e.message).split("\n").slice(0, 4).join(" | ")));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 200)); });

await page.goto(URL, { waitUntil: "load" });
await page.waitForFunction(() => {
  const s = window.__RAVAGE_GAME__?.scene.getScene("AssetStreamScene");
  return !!s && s.load.totalComplete > 0 && !s.load.isLoading();
}, null, { timeout: 240_000 });
await page.evaluate(() => { try { localStorage.setItem("ravage.consent", "declined"); } catch { /* */ } });

const ids = await page.evaluate(async () => {
  const { BATTLES } = await import("/src/data/battles.ts");
  return BATTLES.filter((b) => b.playable).map((b) => b.id);
});

const canvasBox = async () => page.evaluate(() => {
  const r = window.__RAVAGE_GAME__.canvas.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
});
// Click at design coords (1280x720).
const click = async (x, y) => {
  const b = await canvasBox();
  await page.mouse.move(b.x + (x * b.w) / 1280, b.y + (y * b.h) / 720);
  await page.mouse.down();
  await page.waitForTimeout(40);
  await page.mouse.up();
};
const state = () => page.evaluate(() => {
  const g = window.__RAVAGE_GAME__;
  const b = g.scene.getScene("BattleScene");
  const running = g.scene.getScenes(true).map((s) => s.scene.key);
  const paused = g.scene.scenes.filter((s) => s.scene.isPaused()).map((s) => s.scene.key);
  const out = { frame: g.loop.frame, running, paused };
  if (b && (b.scene.isActive() || b.scene.isPaused())) {
    const u = b.initiative?.current?.();
    out.fsm = b.fsm?.current?.().tag;
    out.actor = u ? `${u.id}/${u.faction}` : null;
    out.buttons = b.actionButtons?.length ?? null;
    out.tweenScale = b.tweens.timeScale;
    out.timeScale = b.time.timeScale;
    out.banner = !!b.phaseBanner;
    out.spin = !!b.spin;
    out.inputEnabled = b.input.enabled;
  }
  return out;
});

const results = [];
for (const id of ids) {
  if (only && !only.includes(id)) continue;
  errors.length = 0;
  await page.evaluate(async (target) => {
    const save = await import("/src/util/save.ts");
    const { BATTLES } = await import("/src/data/battles.ts");
    const order = BATTLES.map((b) => b.id).filter((b) => !b.startsWith("b19_") || b === "b19_path_opener_vengeance" || b === target);
    const done = order.slice(0, order.indexOf(target)).filter((b) => b !== target);
    let s = save.defaultSave();
    s.completedBattles = done;
    s.unlockedBattles = [...done, target];
    s.nextChapter = target;
    if (target.startsWith("b19_") || done.includes("b18_path_chosen")) {
      s = save.setSevenPath(s, target.startsWith("b19_") ? target.slice("b19_path_opener_".length) : "vengeance");
    }
    save.setCurrentSlot(1);
    save.writeSave(s);
    const g = window.__RAVAGE_GAME__;
    const keep = new Set(["BootScene", "AssetStreamScene"]);
    for (const sc of [...g.scene.scenes]) if (!keep.has(sc.scene.key) && (sc.scene.isActive() || sc.scene.isPaused())) g.scene.stop(sc.scene.key);
    g.scene.start("CampScene", { nextChapter: target });
  }, id);
  await page.waitForTimeout(2500);
  const cta = await page.evaluate(async () => {
    const { CtaButton } = await import("/src/ui/CtaButton.ts");
    const c = window.__RAVAGE_GAME__.scene.getScene("CampScene");
    const b = c.children.getChildren().find((o) => o instanceof CtaButton && o.opts.label.startsWith("Start"));
    return b ? { x: b.x, y: b.y } : null;
  });
  if (!cta) { results.push({ id, verdict: "NO START BUTTON", s: await state(), errors: [...errors] }); console.log(id.padEnd(30), "NO START BUTTON", JSON.stringify({ s: await state(), errors })); continue; }
  await click(cta.x, cta.y);
  await page.waitForFunction(() => window.__RAVAGE_GAME__.scene.getScene("BattlePrepScene").scene.isActive(), null, { timeout: 15_000 }).catch(() => {});
  // Prep's own fade-in must be over: Phaser ignores a fade-out started
  // during it, so a March click then does nothing (try again works).
  await page.waitForFunction(() => {
    const prep = window.__RAVAGE_GAME__.scene.getScene("BattlePrepScene");
    return prep.scene.isActive() && prep.cameras?.main && !prep.cameras.main.fadeEffect.isRunning;
  }, null, { timeout: 15_000 }).catch(() => {});
  let entered = false, marches = 0;
  while (!entered && marches < 3) {
    marches++;
    await click(1280 - 240 + 100, 720 - 56 + 20);
    entered = await page.waitForFunction(() => {
      const b = window.__RAVAGE_GAME__.scene.getScene("BattleScene");
      return b.scene.isActive() || b.scene.isPaused();
    }, null, { timeout: 8_000 }).then(() => true).catch(() => false);
  }
  if (marches > 1) console.log(id.padEnd(30), `(March needed ${marches} clicks)`);
  if (!entered) { results.push({ id, verdict: "NEVER ENTERED BATTLE", s: await state(), errors: [...errors] }); console.log(id.padEnd(30), "NEVER ENTERED BATTLE", JSON.stringify({ s: await state(), errors })); continue; }

  // Play the opening: click through dialogue until the player has control.
  let last = await state(), stuck = 0, verdict = "ok", playerControl = false;
  const log = [];
  for (let t = 0; t < 40; t++) {
    await page.waitForTimeout(500);
    const s = await state();
    if (s.running.includes("BattleDialogueScene")) await click(640, 600);
    if (s.frame === last.frame) stuck++; else stuck = 0;
    if (stuck >= 3) { verdict = "LOOP STOPPED"; log.push(s); break; }
    if (s.paused.includes("BattleScene") && !s.running.some((k) => k !== "AssetStreamScene" && k !== "BattleBackdropScene" && k !== "BattleScene")) {
      log.push(s);
      if (log.filter((x) => x.paused?.includes("BattleScene")).length > 6) { verdict = "PAUSED, NOTHING ON TOP"; break; }
    }
    if (s.actor?.endsWith("/player") && s.fsm !== "enemyTurn" && (s.buttons ?? 0) > 0 && !s.paused.includes("BattleScene")) { playerControl = true; break; }
    last = s;
  }
  const end = await state();
  if (verdict === "ok" && !playerControl) verdict = "NO PLAYER CONTROL";
  results.push({ id, verdict, end, errors: [...errors].slice(0, 6), log: log.slice(-3) });
  console.log(id.padEnd(30), verdict, errors.length ? `(${errors.length} errors)` : "");
  if (verdict !== "ok" || errors.length) console.log("   ", JSON.stringify({ end, errors: errors.slice(0, 6), log: log.slice(-3) }));
}

console.log("\n" + JSON.stringify(results.filter((r) => r.verdict !== "ok" || r.errors?.length), null, 1));
await browser.close();
