// Shot lists for the capture harness.
//
// A shot is: an optional `setup` (runs once, off-camera), an optional
// `each` (runs before every captured frame), and a duration in seconds.
// Everything inside runs in the PAGE, against `window.__cap`.
//
// Actions are deliberately fire-and-forget. The scene's own animations —
// tweens, delayedCalls, the async attack routine — advance on the clock
// the recorder is stepping, so kicking one off and then simply recording
// N frames plays it out at exactly the right speed.

// Shared helper source, injected into page functions that need it.
// (Playwright serializes the function source, so helpers have to be
// inlined rather than closed over from module scope.)
const HELPERS = `
  const cap = window.__cap;
  const S = (k) => cap.scene(k);
  const battle = () => S("BattleScene");
  const story = () => S("StoryScene");
  const closeDialogue = () => {
    const d = S("BattleDialogueScene");
    if (d && d.scene.isActive()) d.scene.stop();
    const b = battle();
    if (b && b.scene.isPaused()) b.scene.resume();
  };
  const unit = (id) => (battle()?.state?.units ?? []).find((u) => u.id === id);
  const side = (f) => (battle()?.state?.units ?? []).filter((u) => u.faction === f && u.state.alive);
  const dist = (a, b) =>
    Math.abs(a.state.position.x - b.state.position.x) +
    Math.abs(a.state.position.y - b.state.position.y);
  const nearestFoe = (u) => side("enemy").slice().sort((a, z) => dist(u, a) - dist(u, z))[0];

  // A trailer wants the swing to land and finish. Soften the TARGET
  // only — never the hero, whose real numbers are on screen in the side
  // panel and would read as a cheat if they were inflated.
  const softenTarget = (target) => {
    target.stats = { ...target.stats, armor: 0, speed: 1 };
    target.state.hp = Math.max(1, Math.round(target.stats.hp * 0.12));
  };

  // Pull the board in so units read at trailer size. focusUnit() already
  // does its clamping in zoom-aware units (viewW = cam.width / zoom), so
  // setting zoom first and focusing after keeps the framing correct.
  const zoomTo = (factor) => {
    const cam = battle().cameras.main;
    if (cam.__baseZoom === undefined) cam.__baseZoom = cam.zoom;
    cam.setZoom(cam.__baseZoom * factor);
  };
  // Camera only. refreshSidePanel() paints an inspected unit's stats into
  // a panel whose header is driven by the initiative cursor, so forcing it
  // produced frames captioned "Selene" over the Commander's portrait.
  const focusOn = (u) => { battle().focusUnit(u); };

  // Explicit framing between two units. focusUnit() clamps against camera
  // bounds in zoom-aware units, which lands somewhere useless once we've
  // changed the zoom out from under it — the attack shot came back framed
  // on empty grass. Centring by hand is deterministic.
  //
  // The +146 pushes the action into the visible playfield: the side panel
  // eats the right ~292px of the 1280 design space, so the playfield's
  // optical centre sits that far left of the camera's.
  // NOT cameras.centerOn(). installRenderScale() leaves cam.width at the
  // BACKING BUFFER size (2560) while the visible world is cam.displayWidth
  // (width / zoom), and Phaser computes centerOn from width/2 — so it
  // lands half a screen off and the shot frames empty grass. Scroll is
  // computed from displayWidth/Height, which are zoom-aware, and clamped
  // to the camera bounds by hand.
  const frameOn = (a, b) => {
    const sc = battle();
    const cam = sc.cameras.main;
    const pa = sc.projection.tileToWorld(a.state.position);
    const pb = b ? sc.projection.tileToWorld(b.state.position) : pa;
    const cx = (pa.x + pb.x) / 2 + 146;   // out from under the side panel
    const cy = (pa.y + pb.y) / 2;
    const vw = cam.displayWidth, vh = cam.displayHeight;
    const bnd = cam.getBounds();
    // Bounds can start left of / above zero (the board has drag slack).
    cam.setScroll(
      Math.min(Math.max(cx - vw / 2, bnd.x), bnd.x + Math.max(0, bnd.width - vw)),
      Math.min(Math.max(cy - vh / 2, bnd.y), bnd.y + Math.max(0, bnd.height - vh))
    );
  };

  // Put the attacker in the target's face. The opening rosters start ~18
  // tiles apart, and animateAttack() doesn't range-check when driven
  // directly — so without this the swing plays with nothing next to it.
  const closeWith = (u, foe) => {
    const g = battle().state.grid;
    const occupied = (p) => (battle().state.units).some((o) => o.state.alive && o.state.position.x === p.x && o.state.position.y === p.y);
    const around = [{x:0,y:1},{x:0,y:-1},{x:1,y:0},{x:-1,y:0}];
    for (const d of around) {
      const p = { x: foe.state.position.x + d.x, y: foe.state.position.y + d.y };
      if (g.inBounds(p) && !g.tileAt(p).blocksMovement && !occupied(p)) {
        u.state.position = p;
        battle().refreshAllUnits();
        return;
      }
    }
  };

  // Land directly on a beat. StoryScene.advance() turns a PAGE, not a
  // beat — long narration paginates — so stepping N times lands somewhere
  // arbitrary. Set the index and repaint instead.
  const toBeat = (pred) => {
    const sc = story();
    const arc = cap.arcs.ARCS[sc.arcId];
    const idx = arc.beats.findIndex(pred);
    if (idx < 0) return;
    sc.idx = idx;
    sc.showBeat(arc.beats[idx]);
  };

  // A save that makes the map and prep screens look like a real run:
  // most of the campaign walked, a stocked squad pool, veterans.
  const seedRun = () => {
    const save = cap.save;
    const s = save.defaultSave();
    const ids = ["b01_palace_coup","b02_farmland","b03_dawn_bandits","b04_swamp","b05_mountain_ndari",
                 "b06_caravan","b07_monastery","b08_orinhal","b09_ravine","b10_leaving_thuling",
                 "b11_cliffs","b12_ravage","b13_dawn_rebellion","b14_origin","b15_inner_coup",
                 "b16_proposal","b17_lie"];
    s.completedBattles = ids;
    s.unlockedBattles = [...ids, "b18_path_chosen"];
    s.squadInventory = ["potion","potion","potion","elixir","elixir","royal_lens","mask","fang"]
      .map((k) => cap.items.createItem(k));
    s.assignedInventory = {};
    s.squadDeaths = 1;
    save.setCurrentSlot(1);
    save.writeSave(s);
  };
`;

const fn = (body) => new Function("arg", `${HELPERS}\n${body}`);

// ---------------------------------------------------------------------
// PROOF — 10s.
// ---------------------------------------------------------------------
export const proof = [
  { name: "title", seconds: 2.2, settleFrames: 30, setup: fn(`cap.goto("TitleScene");`) },
  {
    name: "battle-card", seconds: 2.0, settleFrames: 100,
    setup: fn(`cap.goto("BattleScene", { battleId: "b20_dawn_war" });`),
    each: fn(`if (arg.i === 0) closeDialogue();`)
  },
  {
    name: "select-and-range", seconds: 1.5, settleFrames: 20,
    setup: fn(`closeDialogue(); zoomTo(1.35); const u = unit("amar") || side("player")[0]; focusOn(u); battle().enterMoveMode(u);`)
  },
  {
    name: "move", seconds: 1.6, settleFrames: 2,
    setup: fn(`
      const b = battle(); const u = unit("amar") || side("player")[0];
      const foe = nearestFoe(u);
      const dest = { x: u.state.position.x, y: u.state.position.y };
      if (foe) for (let k = 0; k < 3; k++) {
        if (dest.y < foe.state.position.y) dest.y++;
        else if (dest.y > foe.state.position.y) dest.y--;
        else if (dest.x < foe.state.position.x) dest.x++;
        else if (dest.x > foe.state.position.x) dest.x--;
      }
      focusOn(u); void b.animateMove(u, dest);
    `)
  },
  { name: "target", seconds: 0.9, settleFrames: 2, setup: fn(`const u = unit("amar") || side("player")[0]; battle().enterAttackMode(u);`) },
  {
    name: "attack", seconds: 1.8, settleFrames: 0,
    setup: fn(`
      const b = battle(); const u = unit("amar") || side("player")[0]; const foe = nearestFoe(u);
      if (foe) { softenTarget(foe); focusOn(u); void b.animateAttack(u, foe); }
    `)
  }
];

// ---------------------------------------------------------------------
// REEL — 45s. Weighted AWAY from battle (there is already 20s of battle
// footage in hand) and toward what that footage doesn't show: the story
// scenes, the portrait dialogue, prep, and the finale's phase two.
// ---------------------------------------------------------------------
export const reel = [
  {
    name: "title",
    seconds: 2.5,
    settleFrames: 40,
    setup: fn(`seedRun(); cap.goto("TitleScene");`)
  },

  // ---- the story layer ----
  {
    name: "narration",
    seconds: 5.0,
    settleFrames: 40,
    setup: fn(`cap.goto("StoryScene", { arcId: "post_cliffs" });`)
  },
  {
    name: "story-dialogue",
    seconds: 5.0,
    settleFrames: 30,
    // Jump to the first beat with a speaker so we land on portrait art
    // rather than another narrator card.
    setup: fn(`toBeat((b) => b.speaker && b.portraitId && b.portraitId !== "narrator");`)
  },

  // ---- the map + prep layer ----
  {
    name: "overworld",
    seconds: 3.5,
    settleFrames: 45,
    setup: fn(`cap.goto("OverworldScene");`)
  },
  {
    name: "battle-prep",
    seconds: 4.0,
    settleFrames: 45,
    setup: fn(`cap.goto("BattlePrepScene", { battleId: "b20_dawn_war" });`)
  },

  // ---- battle ----
  {
    name: "battle-card",
    seconds: 2.5,
    settleFrames: 100,
    // No closeDialogue here: the round-1 beat fires by itself during the
    // settle, so the chapter plate and the portrait overlay arrive
    // together — which is exactly the composition we want to open on.
    setup: fn(`cap.goto("BattleScene", { battleId: "b20_dawn_war" });`)
  },
  {
    name: "battle-dialogue",
    seconds: 4.5,
    settleFrames: 4,
    // Ride the overlay, then turn to the second beat so a second
    // character's portrait art gets screen time.
    each: fn(`
      const d = S("BattleDialogueScene");
      if (arg.i === 66 && d && d.scene.isActive() && d.advance) d.advance();
    `)
  },
  {
    name: "battle-move",
    seconds: 2.5,
    settleFrames: 10,
    setup: fn(`
      closeDialogue(); zoomTo(1.4);
      const b = battle(); const u = unit("amar") || side("player")[0];
      const foe = nearestFoe(u);
      const dest = { x: u.state.position.x, y: u.state.position.y };
      if (foe) for (let k = 0; k < 3; k++) {
        if (dest.y < foe.state.position.y) dest.y++;
        else if (dest.y > foe.state.position.y) dest.y--;
        else if (dest.x < foe.state.position.x) dest.x++;
        else if (dest.x > foe.state.position.x) dest.x--;
      }
      frameOn(u, foe); b.enterMoveMode(u); void b.animateMove(u, dest);
    `)
  },
  {
    name: "battle-attack",
    seconds: 3.0,
    settleFrames: 4,
    setup: fn(`
      const b = battle(); const u = unit("amar") || side("player")[0]; const foe = nearestFoe(u);
      if (foe) {
        closeWith(u, foe);
        softenTarget(foe);
        b.enterAttackMode(u);
        frameOn(u, foe);
        void b.animateAttack(u, foe);
      }
    `)
  },

  // ---- the finale's phase two ----
  {
    name: "boss-phase-two",
    seconds: 5.5,
    settleFrames: 110,
    setup: fn(`cap.goto("BattleScene", { battleId: "b28_path_final" });`),
    each: fn(`
      const b = battle();
      if (arg.i === 0) { closeDialogue(); zoomTo(1.25); }
      // Land the killing blow a beat in, so the shot opens on the boss
      // standing and then pays off with the phase change + the reserve.
      if (arg.i === 8) {
        const boss = (b.state.units ?? []).find((u) => u.classKind === "boss");
        if (boss) { frameOn(boss, null); cap.unitApi.damageUnit(boss, 99999); b.checkEnd(); }
      }
      if (arg.i === 150) closeDialogue();
    `)
  },

  // ---- the close ----
  {
    name: "ending",
    seconds: 4.5,
    settleFrames: 40,
    setup: fn(`cap.goto("StoryScene", { arcId: "where_they_went" });`)
  },
  {
    name: "ending-portrait",
    seconds: 2.5,
    settleFrames: 25,
    setup: fn(`toBeat((b) => b.speaker && b.portraitId && b.portraitId !== "narrator");`)
  }
];

// ---------------------------------------------------------------------
// BASELINE — one still per biome, native zoom, for before/after review
// of the 2.5D uplift. One second each (30 frames); the last one is the
// keeper. The battle camera fades in over 450ms once the opening
// dialogue closes, so anything shorter catches most boards mid-fade.
// ---------------------------------------------------------------------
const BASELINE_BATTLES = [
  "b01_palace_coup", "b04_swamp", "b05_mountain_ndari", "b07_monastery",
  "b11_cliffs", "b17_lie", "b22_grude_burns", "b26_coastal_hold",
  "b28_path_final", "b29_epilogue"
];
export const baseline = BASELINE_BATTLES.map((id) => ({
  name: id,
  seconds: 1,
  settleFrames: 110,
  setup: fn(`seedRun(); cap.goto("BattleScene", { battleId: "${id}" });`),
  each: fn(`closeDialogue();`)
}));

// QUICK — two stills for fast iteration on the board's look.
export const quick = (process.env.CAP_IDS ?? "b05_mountain_ndari,b01_palace_coup").split(",").map((id) => ({
  name: id,
  seconds: 1,
  settleFrames: 110,
  setup: fn(`seedRun(); cap.goto("BattleScene", { battleId: "${id}" });`),
  each: fn(`closeDialogue();`)
}));

// PROBE — one battle, settled, dialogue and title card cleared.
const PROBE_ID = process.env.CAP_BATTLE ?? "b11_cliffs";
export const probe = [{
  name: PROBE_ID,
  seconds: 0.1,
  settleFrames: 240,
  // CAP_NOFOG=1 flips darkBattle off for the probe — isolates the fog.
  setup: fn(`seedRun();
    ${process.env.CAP_NOFOG ? `cap.battles.battleById("${PROBE_ID}").darkBattle = false;` : ""}
    cap.goto("BattleScene", { battleId: "${PROBE_ID}" });`),
  each: fn(`closeDialogue();
    ${process.env.CAP_NOFOG ? "battle()?.darknessRT?.setVisible(false);" : ""}
    ${process.env.CAP_MAGENTA ? `{ const bs = S("BattleBackdropScene");
        if (bs) { bs.children.list.forEach((o) => o.setVisible(false));
                  bs.cameras.main.setBackgroundColor(0xff00ff); } }` : ""}
    ${(process.env.CAP_STRIP ?? "").split(",").filter(Boolean).map((k) => ({
      fx: "battle().cameras.main.postFX.clear();",
      keystone: "battle().cameras.main.removePostPipeline('RavagePerspective');",
      clouds: "battle().children.list.filter((o) => o.depth === 1.5).forEach((o) => o.setVisible(false));",
      atmo: "battle().atmosphere?.setVisible?.(false);",
      // Camera post-FX live in cam.postPipelines by name ("14" = Phaser's
      // ColorMatrix); cam.postFX.list stays empty for cameras.
      bloomonly: "battle().cameras.main.removePostPipeline('14');",
      gradeonly: "battle().cameras.main.removePostPipeline('RavageBloom');"
    })[k] ?? "").join(" ")}`)
}];

// ANIM — the combat animation pass, staged for frame-by-frame review:
// a melee kill (step-in, footfall, topple onto the floor), an arrow with
// its ground shadow, and a reinforcement wave walking in off the edge.
export const anim = [
  {
    name: "melee-kill",
    seconds: 2.0,
    settleFrames: 110,
    setup: fn(`seedRun(); cap.goto("BattleScene", { battleId: "b29_epilogue" });`),
    each: fn(`closeDialogue();`)
  },
  {
    name: "melee-kill-go",
    seconds: 2.2,
    settleFrames: 2,
    setup: fn(`
      const b = battle(); const u = unit("amar") || side("player")[0]; const foe = nearestFoe(u);
      if (foe) { closeWith(u, foe); softenTarget(foe); zoomTo(1.8); frameOn(u, foe); void b.animateAttack(u, foe); }
    `)
  },
  {
    name: "arrow",
    seconds: 1.4,
    settleFrames: 2,
    setup: fn(`
      const b = battle(); const u = side("player").find((p) => p.weapon === "bow"); const foe = u && nearestFoe(u);
      if (u && foe) {
        const g = b.state.grid;
        const occ = (p) => b.state.units.some((o) => o.state.alive && o.state.position.x === p.x && o.state.position.y === p.y);
        for (const d of [{x:-3,y:0},{x:3,y:0},{x:0,y:3},{x:0,y:-3},{x:-2,y:1},{x:2,y:-1}]) {
          const p = { x: foe.state.position.x + d.x, y: foe.state.position.y + d.y };
          if (g.inBounds(p) && !g.tileAt(p).blocksMovement && !occ(p)) { u.state.position = p; b.refreshAllUnits(); break; }
        }
        foe.state.hp = foe.stats.hp; foe.stats = { ...foe.stats, speed: 1 };
        zoomTo(1.8); frameOn(u, foe); void b.animateAttack(u, foe);
      }
    `)
  },
  {
    name: "torch",
    seconds: 1.8,
    settleFrames: 110,
    setup: fn(`seedRun(); cap.goto("BattleScene", { battleId: "b17_lie" });`),
    each: fn(`closeDialogue();`)
  },
  {
    name: "torch-walk",
    seconds: 2.6,
    settleFrames: 2,
    setup: fn(`
      const b = battle(); closeDialogue();
      const g = b.state.grid; let torch = null;
      for (let y = 0; y < g.height && !torch; y++) for (let x = 0; x < g.width; x++)
        if (g.tileAt({ x, y }).obstacle === "torch") { torch = { x, y }; break; }
      const u = side("player")[0];
      const ok = (p) => g.inBounds(p) && !g.tileAt(p).blocksMovement;
      if (torch && u && ok({ x: torch.x - 1, y: torch.y }) && ok({ x: torch.x + 1, y: torch.y })) {
        u.state.position = { x: torch.x - 1, y: torch.y }; b.refreshAllUnits();
        zoomTo(2.2); frameOn(u);
        b.enterMoveMode(u); void b.animateMove(u, { x: torch.x + 1, y: torch.y });
      }
    `)
  },
  {
    name: "arrival",
    seconds: 2.2,
    settleFrames: 110,
    setup: fn(`seedRun(); cap.goto("BattleScene", { battleId: "b26_coastal_hold" });`),
    each: fn(`closeDialogue();`)
  },
  {
    name: "arrival-go",
    seconds: 1.6,
    settleFrames: 2,
    setup: fn(`
      const b = battle(); closeDialogue();
      const w = b.reinforcements[0];
      if (w) { b.landWaves((x) => x === w); const nu = b.state.units[b.state.units.length - 1];
        zoomTo(1.5); frameOn(nu); }
    `)
  }
];

// SCENES — one still of each non-battle screen that shows the world.
export const scenes = [
  { name: "overworld", seconds: 1.2, settleFrames: 60, setup: fn(`seedRun(); cap.goto("OverworldScene");`) },
  { name: "camp", seconds: 1.2, settleFrames: 60, setup: fn(`seedRun(); cap.goto("CampScene");`) },
  { name: "prep", seconds: 1.2, settleFrames: 60, setup: fn(`seedRun(); cap.goto("BattlePrepScene", { battleId: "b18_path_chosen" });`) }
];

// PROMOTED — every Tier 2 class in battle. The live units are promoted in
// place (classKind swapped, views rebuilt), so no save surgery is needed.
const PROMOTE = `
  const T2 = { lucian: "spearton_lord", ning: "robinhelm", maya: "shinobi_master", leo: "dactyl_king",
               ranatoli: "guardian", veya: "prismarch", corin: "khan" };
  const b = battle();
  for (const u of b.state.units) {
    const to = T2[u.id]; if (!to || u.classKind === to) continue;
    u.classKind = to; u.spriteClassOverride = undefined;
    const v = b.unitViews.get(u.id);
    if (v) { [v.sprite, v.shadow, v.hpBg, v.hpBar, v.stanceIcon, v.castShadow].forEach((o) => o && o.destroy());
             b.unitViews.delete(u.id); }
    b.buildUnitView(u);
  }
  b.refreshAllUnits();
`;
export const promoted = [
  { name: "coast", seconds: 1, settleFrames: 110,
    setup: fn(`seedRun(); cap.goto("BattleScene", { battleId: "b26_coastal_hold" });`),
    each: fn(`closeDialogue(); if (!window.__promoted1) { window.__promoted1 = true; ${PROMOTE} }`) },
  { name: "guardian-kill", seconds: 2.2, settleFrames: 2,
    setup: fn(`
      const b = battle(); const u = unit("ranatoli") || side("player")[0]; const foe = nearestFoe(u);
      if (foe) { closeWith(u, foe); softenTarget(foe); zoomTo(2); frameOn(u, foe); void b.animateAttack(u, foe); }
    `) },
  { name: "robinhelm-shot", seconds: 1.6, settleFrames: 20,
    setup: fn(`
      const b = battle(); const u = unit("ning"); const foe = u && nearestFoe(u);
      if (u && foe) {
        const g = b.state.grid;
        const occ = (p) => b.state.units.some((o) => o.state.alive && o.state.position.x === p.x && o.state.position.y === p.y);
        for (const d of [{x:-3,y:0},{x:3,y:0},{x:0,y:3},{x:0,y:-3}]) {
          const p = { x: foe.state.position.x + d.x, y: foe.state.position.y + d.y };
          if (g.inBounds(p) && !g.tileAt(p).blocksMovement && !occ(p)) { u.state.position = p; b.refreshAllUnits(); break; }
        }
        foe.state.hp = foe.stats.hp; zoomTo(2); frameOn(u, foe); void b.animateAttack(u, foe);
      }
    `) },
  { name: "mountain", seconds: 1, settleFrames: 110,
    setup: fn(`seedRun(); cap.goto("BattleScene", { battleId: "b05_mountain_ndari" });`),
    each: fn(`closeDialogue(); if (!window.__promoted2) { window.__promoted2 = true; ${PROMOTE} }`) }
];

// CAMERA — the board turning: mid-turn frames and each side it lands on,
// then zoomed in on the squad.
const CAM_ID = process.env.CAP_BATTLE ?? "b05_mountain_ndari";
export const camera = [
  { name: "r0", seconds: 0.6, settleFrames: 110,
    setup: fn(`seedRun(); cap.goto("BattleScene", { battleId: "${CAM_ID}" });`), each: fn(`closeDialogue();`) },
  ...[1, 2, 3].map((r) => ({ name: "r" + r, seconds: 1.0, settleFrames: 0,
    setup: fn(`closeDialogue(); battle().spinTo(${r});`) })),
  { name: "hold", seconds: 1.6, settleFrames: 0,
    setup: fn(`const b = battle(); b.spinButtonDir = 1; b.beginSpin(1);`),
    each: fn(`const b = battle(); b.__holdT = (b.__holdT || 0) + 1; if (b.__holdT > 30) b.spinButtonDir = 0;`) },
  { name: "r0-zoom", seconds: 0.8, settleFrames: 40,
    setup: fn(`battle().spinTo(0);`),
    each: fn(`const b = battle(); if (!b.spin && !b.__zoomed) { b.__zoomed = true; b.setBoardZoom(1.7); }`) }
];

// PICK — the report: your unit directly in front of an enemy. Hovers the
// pointer on your unit's chest, over the enemy's tile, zoomed in; the
// click there now attacks the enemy (rim, x-ray and forecast show it).
const STAGE_PAIR = `
  const b = battle(); closeDialogue();
  const u = b.initiative.current(); const grid = b.state.grid;
  const free = (p) => grid.inBounds(p) && !grid.tileAt(p).blocksMovement &&
    !b.state.units.some((o) => o.state.alive && o.state.position.x === p.x && o.state.position.y === p.y);
  const foe = b.state.units.find((o) => o.faction === "enemy" && o.state.alive);
  let spot = null;
  for (let y = 4; y < grid.height - 1 && !spot; y++) for (let x = 1; x < grid.width - 1 && !spot; x++) {
    const me = { x, y }, back = b.projection.neighborOnScreen(me, "up");
    if (free(me) && free(back)) spot = { me, back };
  }
  u.state.position = { ...spot.me }; foe.state.position = { ...spot.back };
  for (const v of b.unitViews.values()) b.stopBreathing(v);
  b.refreshAllUnits(); for (const v of b.unitViews.values()) b.startBreathing(v);
  b.cancelTargetingMode(u); b.enterMoveMode(u);
  b.setBoardZoom(2);
  const v = b.unitViews.get(u.id); const cam = b.cameras.main;
  const c = b.playfieldCentreScreen(); const w = b.screenToWorld(c.x, c.y);
  cam.setScroll(cam.scrollX + v.sprite.x - w.x, cam.scrollY + v.sprite.y - 20 - w.y);
  window.__pickUnit = u.id;
`;
const HOVER = (dy) => `
  const b = battle(); const v = b.unitViews.get(window.__pickUnit); const cam = b.cameras.main;
  const wx = v.sprite.x, wy = v.sprite.y + (${dy});
  const s = cap.keystone.sourceToScreen((wx - cam.scrollX) * cam.zoom, (wy - cam.scrollY) * cam.zoom, cam.width, cam.height, b.keystone);
  b.handlePointerMove({ x: s.x, y: s.y });
`;
export const pick = [
  { name: "setup", seconds: 0.2, settleFrames: 110,
    setup: fn(`seedRun(); cap.goto("BattleScene", { battleId: "b05_mountain_ndari" });`), each: fn(`closeDialogue();`) },
  { name: "stage", seconds: 0.3, settleFrames: 20, setup: fn(STAGE_PAIR) },
  { name: "hover-chest", seconds: 0.5, settleFrames: 4, setup: fn(HOVER(-12)), each: fn(HOVER(-12)) },
  { name: "hover-legs", seconds: 0.5, settleFrames: 4, setup: fn(HOVER(20)), each: fn(HOVER(20)) }
];

export const SHOTLISTS = { proof, reel, baseline, quick, probe, anim, scenes, promoted, camera, pick };
