// Play probe: play battles turn by turn with the real mouse, in real time,
// and report anything that freezes them.
//
// On each player turn it wanders the pointer over the board (hover
// previews, the x-ray), clicks a random reachable tile to move (or an
// enemy in reach to attack), now and then holds E or Q to turn the board,
// and ends the turn when the unit is spent. It flags:
//   * page errors (uncaught exceptions, rejected promises)
//   * LOOP STOPPED — the game loop stopped ticking (an exception in a frame)
//   * STUCK — the same actor in an animating state for 25s with no change
//
// Usage: node scripts/capture/playProbe.mjs [battleId,...] [secondsPerBattle]
import { chromium } from "playwright";

const URL = process.env.CAP_URL ?? "http://127.0.0.1:5173/play/";
const only = process.argv[2] ? process.argv[2].split(",") : null;
const SECONDS = Number(process.argv[3] ?? 150);

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--mute-audio"]
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e.stack ?? e.message).split("\n").slice(0, 5).join(" | ")));

await page.goto(URL, { waitUntil: "load" });
await page.waitForFunction(() => {
  const s = window.__RAVAGE_GAME__?.scene.getScene("AssetStreamScene");
  return !!s && s.load.totalComplete > 0 && !s.load.isLoading();
}, null, { timeout: 240_000 });

const ids = only ?? await page.evaluate(async () => {
  const { BATTLES } = await import("/src/data/battles.ts");
  return BATTLES.filter((b) => b.playable).map((b) => b.id);
});

const box = async () => page.evaluate(() => {
  const r = window.__RAVAGE_GAME__.canvas.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height };
});
const to = async (x, y) => { const b = await box(); await page.mouse.move(b.x + (x * b.w) / 1280, b.y + (y * b.h) / 720, { steps: 3 }); };
const click = async (x, y) => { await to(x, y); await page.mouse.down(); await page.waitForTimeout(50); await page.mouse.up(); };

// Everything the probe needs to decide its next action, in design px.
const look = () => page.evaluate(async () => {
  const g = window.__RAVAGE_GAME__;
  const b = g.scene.getScene("BattleScene");
  const running = g.scene.getScenes(true).map((s) => s.scene.key);
  const out = { frame: g.loop.frame, running, paused: b.scene.isPaused(), active: b.scene.isActive() };
  if (!out.active && !out.paused) return out;
  const ks = await import("/src/render/keystone.ts");
  const RS = g.scale.width / 1280;
  const cam = b.cameras.main;
  const scr = (wx, wy) => {
    const src = { x: (wx - cam.scrollX) * cam.zoom, y: (wy - cam.scrollY) * cam.zoom };
    const s = b.keystone ? ks.sourceToScreen(src.x, src.y, cam.width, cam.height, b.keystone) : src;
    return { x: s.x / RS, y: s.y / RS };
  };
  const st = b.fsm.current();
  const u = b.initiative.current();
  out.fsm = st.tag;
  out.actor = u ? `${u.id}/${u.faction}` : null;
  out.ended = b.fsm.isEnded();
  out.spin = !!b.spin;
  out.ap = u?.state.apRemaining;
  const inField = (p) => p.x > 10 && p.x < 1280 - 292 - 20 && p.y > 80 && p.y < 710;
  if (st.tag === "move" || st.tag === "roam") {
    out.tiles = st.tiles.map((t) => scr(b.projection.tileToWorld(t).x, b.projection.tileToWorld(t).y)).filter(inField);
  }
  out.targets = [];
  if (u && u.faction === "player" && (st.tag === "move" || st.tag === "attack")) {
    const list = st.tag === "attack" ? st.targets : (await import("/src/combat/Actions.ts")).targetsForUnit?.(b.state, u) ?? [];
    for (const t of list) {
      const v = b.unitViews.get(t.id);
      if (v) { const p = scr(v.sprite.x, v.sprite.y - v.sprite.displayHeight * 0.3); if (inField(p)) out.targets.push(p); }
    }
  }
  out.buttons = b.actionButtons.filter((x) => x.active).map((x) => ({ label: x.opts.label, x: x.x + x.opts.w / 2, y: x.y + x.opts.h / 2, enabled: x.enabledFlag }));
  return out;
});

const pick = (a) => a[Math.floor(Math.random() * a.length)];
const report = [];

for (const id of ids) {
  errors.length = 0;
  await page.evaluate(async (target) => {
    const save = await import("/src/util/save.ts");
    const { BATTLES } = await import("/src/data/battles.ts");
    const order = BATTLES.map((b) => b.id).filter((b) => !b.startsWith("b19_") || b === "b19_path_opener_vengeance" || b === target);
    const done = order.slice(0, order.indexOf(target));
    let s = save.defaultSave();
    s.completedBattles = done;
    s.unlockedBattles = [...done, target];
    if (done.includes("b18_path_chosen") || target.startsWith("b19_")) {
      s = save.setSevenPath(s, target.startsWith("b19_") ? target.slice("b19_path_opener_".length) : "vengeance");
    }
    save.setCurrentSlot(1);
    save.writeSave(s);
    const g = window.__RAVAGE_GAME__;
    for (const sc of [...g.scene.scenes]) {
      if (!["BootScene", "AssetStreamScene"].includes(sc.scene.key) && (sc.scene.isActive() || sc.scene.isPaused())) g.scene.stop(sc.scene.key);
    }
    g.scene.start("BattleScene", { battleId: target });
  }, id);
  await page.waitForTimeout(2500);

  const t0 = Date.now();
  let verdict = "ok", lastFrame = -1, frameAt = Date.now(), stuckSince = Date.now(), stuckKey = "", moves = 0, attacks = 0, turns = 0, spins = 0;
  let last = null;
  while (Date.now() - t0 < SECONDS * 1000) {
    let s;
    try { s = await look(); } catch (e) { verdict = "PROBE ERROR " + String(e).slice(0, 120); break; }
    last = s;
    if (s.frame === lastFrame) { if (Date.now() - frameAt > 10_000) { verdict = "LOOP STOPPED (no frame for 10s)"; break; } } else { frameAt = Date.now(); }
    lastFrame = s.frame;
    if (s.ended || (!s.active && !s.paused)) break;
    if (s.running.includes("BattleDialogueScene") || s.running.includes("InterposeScene") || s.running.includes("PromotionScene")) {
      await click(1080, 676); // Continue / confirm sits bottom right
      await page.waitForTimeout(400);
      continue;
    }
    const key = `${s.actor}|${s.fsm}|${s.ap}`;
    if (key !== stuckKey) { stuckKey = key; stuckSince = Date.now(); }
    else if ((s.fsm === "playerAnimating" || s.fsm === "enemyTurn") && Date.now() - stuckSince > 25_000) { verdict = `STUCK in ${s.fsm} (${s.actor})`; break; }
    if (!s.actor?.endsWith("/player") || s.fsm === "playerAnimating" || s.fsm === "enemyTurn" || s.spin) {
      await page.waitForTimeout(500);
      continue;
    }
    // A player's turn. Wander first: hover previews and the x-ray.
    for (let i = 0; i < 3; i++) await to(40 + Math.random() * 900, 120 + Math.random() * 560);
    if (Math.random() < 0.12) {
      const k = Math.random() < 0.5 ? "e" : "q";
      await page.keyboard.down(k); await page.waitForTimeout(150 + Math.random() * 700); await page.keyboard.up(k);
      spins++;
      await page.waitForTimeout(900);
      continue;
    }
    if (s.targets?.length && Math.random() < 0.6) { const p = pick(s.targets); await click(p.x, p.y); attacks++; await page.waitForTimeout(1500); continue; }
    if (s.tiles?.length && Math.random() < 0.85) { const p = pick(s.tiles); await click(p.x, p.y); moves++; await page.waitForTimeout(1200); continue; }
    const mv = s.buttons.find((b) => b.label.startsWith("Move") && b.enabled);
    if (s.fsm === "idle" && mv && Math.random() < 0.6) { await click(mv.x, mv.y); await page.waitForTimeout(400); continue; }
    const end = s.buttons.find((b) => b.label === "End Turn");
    if (end) { await click(end.x, end.y); turns++; await page.waitForTimeout(800); continue; }
    await page.waitForTimeout(500);
  }
  const line = { id, verdict, secs: Math.round((Date.now() - t0) / 1000), moves, attacks, turns, spins, errors: [...new Set(errors)].slice(0, 4), last: verdict === "ok" ? undefined : last };
  report.push(line);
  console.log(id.padEnd(30), verdict, `moves ${moves} attacks ${attacks} turns ${turns} spins ${spins}`, errors.length ? `ERRORS ${errors.length}` : "");
  if (errors.length || verdict !== "ok") console.log("   ", JSON.stringify({ errors: line.errors, last }));
}
await browser.close();
