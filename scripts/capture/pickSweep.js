// Dev-only probe for tile/unit picking on the tilted board. Paste into the
// browser console on the dev server (or run through a browser tool): it
// stages a battle with an attackable enemy standing directly behind the
// active unit — the overlap in the "can't click the enemy" report — and
// sweeps the pointer down the shared column, recording what each screen
// point would select.
//
// window.__pickSweep() -> { rows: [{ dy, pick }], summary }
//   dy   world px from the front unit's sprite centre (negative = up)
//   pick "enemy" | "self" | "empty-dest" | "other" | "none"
window.__pickSweep = async () => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 40 && !window.__RAVAGE_GAME__; i++) await sleep(250);
  const g = window.__RAVAGE_GAME__;
  g.loop.stop();
  let T = performance.now();
  const step = (n) => { for (let i = 0; i < n; i++) { T += 1000 / 60; g.loop.step(T); } };
  for (let i = 0; i < 60; i++) { step(10); await sleep(20); }
  for (let i = 0; i < 80; i++) {
    const s = g.scene.getScene("AssetStreamScene");
    if (s && s.load.totalComplete > 0 && !s.load.isLoading()) break;
    step(5); await sleep(50);
  }
  for (const s of g.scene.scenes) {
    if (!["BootScene", "AssetStreamScene"].includes(s.scene.key) && (s.scene.isActive() || s.scene.isPaused())) s.scene.stop();
  }
  g.scene.start("BattleScene", { battleId: "b05_mountain_ndari" });
  step(20);
  const d = g.scene.getScene("BattleDialogueScene");
  if (d && d.scene.isActive()) d.scene.stop();
  const b = g.scene.getScene("BattleScene");
  if (b.scene.isPaused()) b.scene.resume();
  step(200);

  // Stage: the active unit in open snow, an enemy on the tile directly
  // behind it on screen, the tile behind the enemy empty.
  const u = b.initiative.current();
  const grid = b.state.grid;
  const free = (p) => grid.inBounds(p) && !grid.tileAt(p).blocksMovement &&
    !b.state.units.some((o) => o.state.alive && o.state.position.x === p.x && o.state.position.y === p.y);
  const foe = b.state.units.find((o) => o.faction === "enemy" && o.state.alive);
  let spot = null;
  for (let y = 4; y < grid.height - 1 && !spot; y++) for (let x = 1; x < grid.width - 1 && !spot; x++) {
    const me = { x, y }, back = b.projection.neighborOnScreen(me, "up"), back2 = b.projection.neighborOnScreen(back, "up");
    if (free(me) && free(back) && free(back2)) spot = { me, back, back2 };
  }
  u.state.position = { ...spot.me };
  foe.state.position = { ...spot.back };
  // Breathing tweens hold their own start/end y; restart them on the new tiles.
  for (const v of b.unitViews.values()) b.stopBreathing(v);
  b.refreshAllUnits();
  for (const v of b.unitViews.values()) b.startBreathing(v);
  b.enterMoveMode(u);
  step(30);

  const cam = b.cameras.main;
  const view = b.unitViews.get(u.id);
  const ks = await import("/src/render/keystone.ts");
  const rows = [];
  for (let dy = -80; dy <= 40; dy += 2) {
    const wx = view.sprite.x, wy = view.sprite.y + dy;
    const src = { x: (wx - cam.scrollX) * cam.zoom, y: (wy - cam.scrollY) * cam.zoom };
    const scr = b.keystone ? ks.sourceToScreen(src.x, src.y, cam.width, cam.height, b.keystone) : src;
    const t = scr ? b.screenToTile(scr.x, scr.y) : null;
    const st = b.fsm.current();
    let pick = "none";
    if (t) {
      if (t.x === foe.state.position.x && t.y === foe.state.position.y) pick = "enemy";
      else if (t.x === u.state.position.x && t.y === u.state.position.y) pick = "self";
      else if ((st.tiles || []).some((m) => m.x === t.x && m.y === t.y)) pick = "empty-dest";
      else pick = "other";
    }
    rows.push({ dy, pick });
  }
  const count = (k) => rows.filter((r) => r.pick === k).length * 2;
  return {
    unit: u.id, foe: foe.id, spot, state: b.fsm.current().tag,
    summary: { enemyPx: count("enemy"), selfPx: count("self"), emptyDestPx: count("empty-dest"), otherPx: count("other") },
    rows: rows.map((r) => `${r.dy}:${r.pick}`).join(" ")
  };
};
