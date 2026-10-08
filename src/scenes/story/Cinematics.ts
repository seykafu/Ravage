import Phaser from "phaser";
import { FAMILY_BODY, GAME_HEIGHT, GAME_WIDTH } from "../../util/constants";
import { ensureDotTexture } from "../battle/Atmosphere";
import { Reel, Z, type Fig } from "./Reel";
import { sfxCineBell, sfxCineBoom, sfxCineChime, sfxCineClang, sfxCineRise, sfxClick } from "../../audio/Sfx";
import type { CinematicId, StageId, StoryArc } from "../../story/beats";

// ─────────────────────────────────────────────────────────────────────────
// The story's cinematics — short films at the turns of the story, made of
// Codex paintings, the squad's own battle sprites and plain words on
// screen (see Reel.ts for the toolkit).
//
//   coup         the very beginning: the palace, the rain, the eight
//                rebels going over the wall, the throne-hall doors
//   escape       after the cliffs: Dawn's ship slipping out of Para Harbor
//                under the moon, the crossing to Grude ahead
//   grude_burns  the night the capital burns, before the battle for it
//   sky_fleet    sunrise after the bell: the sky opens
//
// A story arc plays one before its first beat (StoryArc.cinematic) or
// after its last (StoryArc.endCinematic). "Skip ▸▸", Esc, or two clicks
// skip it.
//
// Stages are the quieter half: a staged picture behind the dialogue from a
// beat on (DialogBeat.stage) — the ship on the open sea through the long
// crossing, the arrival at Grude, Lucian's burial at sea, the squad at the
// throne-hall doors.
// ─────────────────────────────────────────────────────────────────────────

export type { CinematicId, StageId };

const W = GAME_WIDTH, H = GAME_HEIGHT;

type Script = (r: Reel) => Promise<void>;

// ---- the coup -----------------------------------------------------------------

const coup: Script = async (r) => {
  r.black();
  r.letterbox();
  // Embers drifting up out of the dark under the words.
  r.embers({ x: 0, y: H * 0.72, w: W, h: H * 0.3 }, 9000, Z.BACK_FX, 70);
  const heat = r.glow(W / 2, H + 80, 0xff5a1a, 6, 0, Z.BACK_FX);
  void r.tween({ targets: heat, alpha: 0.3, duration: 4000 });
  await r.wait(300);
  await r.narrate("Anthros. The year 2640.", 700, { boom: true });
  await r.narrate("One king rules a hundred million people.", 900);
  await r.narrate("Every year, his soldiers take the harvest.\nEvery year, the villages go hungry.", 1500);
  await r.narrate("Tonight, eight rebels are going to end it.", 1100, { boom: true, colour: "#f4d999" });
  if (r.skipped) return;
  r.cut();

  // The palace, at midnight, in the rain: the dome, then down to the yard.
  const pal = r.painting("backdrop:palaceCoup", { zoom: 1.3, x: 0.64, y: 0.34 }, { zoom: 1.34, x: 0.56, y: 0.7 }, 3600, { fade: 600 });
  r.grade(0x7484c0, 1, 0);
  r.grade(0x0c1428, 0.22, 0, "add");
  if (pal instanceof Phaser.GameObjects.Image) {
    // The braziers burn on through it.
    for (const [fx, fy] of [[0.04, 0.38], [0.15, 0.47], [0.8, 0.47]] as const) {
      const g = r.glow(0, 0, 0xff9a40, 0.6, 0.6, Z.GRADE + 0.5);
      r.onFrame(() => { const p = Reel.at(pal, fx, fy); g.setPosition(p.x, p.y); });
      void r.tween({ targets: g, alpha: 0.4, duration: 160, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }
  r.rain(9000, 1.2);
  r.place("Para", "The King's palace. Midnight.", 4000);
  // Light behind the fight, so the figures read against it.
  r.glow(820, 560, 0x5a78c8, 3.2, 0.3, Z.BACK_FX);
  const FEET = 612;
  const LIT = 0xe0c8b0;
  const guards: Fig[] = [
    r.figure("spearton", 770, FEET, { left: true, scale: 3, tint: LIT }),
    r.figure("spearton", 890, FEET - 10, { left: true, scale: 3, tint: LIT }),
    r.figure("archer", 1020, FEET - 20, { left: true, scale: 3, tint: LIT })
  ];
  await r.wait(800);
  r.lightning(930);
  await r.wait(1400);

  // Out of the dark, three of the eight.
  const COLD = 0xb0c8ff;
  const dark = { scale: 3, dark: 0x1c1a26, rim: COLD, rimAlpha: 0.95 };
  const amar = r.figure("amar", -60, FEET, dark);
  const ranatoli = r.figure("ranatoli", -160, FEET - 6, dark);
  const selene = r.figure("selene", -250, FEET - 16, dark);
  r.caption("Eight rebels. Ten months of planning. One night.", 3400, true);
  void r.pan(pal, { zoom: 1.42, x: 0.55, y: 0.72 }, 8000);
  await Promise.all([amar.walkTo(690, FEET, 1000), ranatoli.walkTo(570, FEET - 6, 1000), selene.walkTo(440, FEET - 16, 1000)]);

  // Fast and quiet.
  void amar.strike();
  await r.wait(180);
  r.slash(750, FEET - 56);
  void guards[0]!.fall();
  await r.wait(240);
  void selene.strike();
  await r.wait(220);
  arrow(r, 470, FEET - 74, 1010, FEET - 86);
  await r.wait(160);
  void guards[2]!.fall();
  r.lightning(380);
  void ranatoli.walkTo(830, FEET - 10, 380);
  await r.wait(340);
  void ranatoli.strike();
  await r.wait(180);
  r.slash(880, FEET - 64, true);
  r.shake(180, 0.004);
  await guards[1]!.fall();

  // On, toward the throne hall.
  void amar.walkTo(1420, FEET, 1200);
  void ranatoli.walkTo(1400, FEET - 10, 1300);
  void selene.walkTo(1380, FEET - 16, 1500);
  await r.wait(700);

  // Who they are.
  r.grade(0x000000, 0.6, 400, "multiply", Z.FRONT_FX);
  await r.wait(250);
  const plates = [...r.nameplate("portrait:selene", "Selene", "The huntress. She never misses.", 136, true)];
  await r.wait(650);
  plates.push(...r.nameplate("portrait:ranatoli", "Ranatoli", "The old soldier. He never retreats.", 278, false));
  await r.wait(650);
  plates.push(...r.nameplate("portrait:amar", "Amar", "The leader. This was his plan.", 420, true));
  await r.wait(1700);
  await r.clear(plates, 350);
  if (r.skipped) return;
  r.cut();

  // The throne-hall doors.
  const hall = r.painting("backdrop:throne_hall", { zoom: 1.0, x: 0.58, y: 0.55 }, { zoom: 1.16, x: 0.6, y: 0.52 }, 8000, { fallback: 0x2a1a14 });
  void hall;
  const doors = throneDoors(r);
  await r.wait(700);
  sfxCineBoom();
  r.shake(380, 0.008);
  r.flash(0xffd8a0, 0.5, 700);
  const light = r.glow(W / 2, H * 0.55, 0xffd8a0, 4.2, 0, Z.FRONT_FX);
  void r.tween({ targets: light, alpha: 0.4, duration: 300, yoyo: true, hold: 400 });
  await doors.open(650);
  // The three of them on the threshold, black against the hall's light.
  const WARM = 0xffc070;
  const rim = { scale: 3, dark: 0x120e16, rim: WARM, rimAlpha: 0.95 };
  const a = r.figure("amar", 600, 636, rim);
  const s = r.figure("selene", 500, 628, rim);
  const t = r.figure("ranatoli", 700, 630, rim);
  for (const f of [a, s, t]) { f.box.setAlpha(0); void r.tween({ targets: f.box, alpha: 1, duration: 450 }); }
  r.embers({ x: 0, y: H * 0.45, w: W, h: H * 0.5 }, 5000, Z.FRONT_FX, 70);
  await r.wait(500);
  await r.slam("The Palace Coup", "Steel in hand. No retreat.", 1700);
  await r.fadeOut(600);
  await r.narrate("Far from the palace, someone else is awake tonight.", 1300, { size: 28 });
};

/** An arrow's streak, bow to target. */
const arrow = (r: Reel, x0: number, y0: number, x1: number, y1: number): void => {
  if (r.skipped) return;
  const g = r.add(r.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD), Z.FRONT_FX);
  const p = { v: 0 };
  void r.tween({
    targets: p, v: 1, duration: 160,
    onUpdate: () => {
      g.clear();
      const x = x0 + (x1 - x0) * p.v, y = y0 + (y1 - y0) * p.v;
      g.lineStyle(2, 0xf0f4ff, 0.9);
      g.lineBetween(x - (x1 - x0) * 0.12, y - (y1 - y0) * 0.12, x, y);
    },
    onComplete: () => { void r.tween({ targets: g, alpha: 0, duration: 120 }); }
  });
};

/** Two great doors over the frame, swinging open. */
const throneDoors = (r: Reel): { open: (ms: number) => Promise<void> } => {
  const leaf = (left: boolean): Phaser.GameObjects.Graphics => {
    const g = r.add(r.scene.add.graphics(), Z.FRONT_FX - 0.5);
    const w = W / 2;
    g.fillStyle(0x24160e, 1);
    g.fillRect(0, 0, w, H);
    // Planks, iron bands and studs.
    g.lineStyle(2, 0x140c06, 1);
    for (let x = 40; x < w; x += 56) g.lineBetween(x, 0, x, H);
    g.fillStyle(0x3a2c22, 1);
    for (const y of [120, H / 2 - 20, H - 160]) {
      g.fillRect(0, y, w, 26);
      g.fillStyle(0x8a7a5a, 1);
      for (let x = 18; x < w; x += 46) g.fillCircle(x, y + 13, 4);
      g.fillStyle(0x3a2c22, 1);
    }
    // A ring handle by the seam.
    g.lineStyle(5, 0x9a8458, 1);
    g.strokeCircle(left ? w - 60 : 60, H / 2 + 40, 22);
    g.setPosition(left ? 0 : W / 2, 0);
    return g;
  };
  const l = leaf(true), rt = leaf(false);
  // Light leaking through the seam.
  const seam = r.add(r.scene.add.rectangle(W / 2, 0, 6, H, 0xffd8a0, 0.8).setOrigin(0.5, 0).setBlendMode(Phaser.BlendModes.ADD), Z.FRONT_FX);
  return {
    open: async (ms) => {
      void r.tween({ targets: seam, scaleX: 40, alpha: 0, duration: ms });
      await Promise.all([
        r.tween({ targets: l, x: -W / 2, duration: ms, ease: "Cubic.easeIn" }),
        r.tween({ targets: rt, x: W, duration: ms, ease: "Cubic.easeIn" })
      ]);
    }
  };
};

// ---- the escape ---------------------------------------------------------------

/** Khione's ship on a painting: hull, lanterns and wake, kept at (fx, fy). */
const shipOn = (
  r: Reel, img: Phaser.GameObjects.Image, at: { fx: number; fy: number; scale: number; flip?: boolean; tint?: number }, z: number = Z.FIGURES
): { ship: Phaser.GameObjects.Image | null; at: typeof at } => {
  const ship = r.object("story:ship", 0, 0, at.scale, z);
  if (!ship) return { ship, at };
  ship.setOrigin(0.5, 0.95).setFlipX(!!at.flip);
  if (at.tint !== undefined) ship.setTint(at.tint);
  const lamps = [r.glow(0, 0, 0xffc070, 0.12, 0.9, z + 0.1), r.glow(0, 0, 0xffc070, 0.12, 0.9, z + 0.1)];
  const wake = r.add(r.scene.add.particles(0, 0, ensureDotTexture(r.scene), {
    speedX: { min: -14, max: 14 }, speedY: { min: -4, max: 4 }, lifespan: { min: 900, max: 1800 },
    scale: { start: 0.25, end: 0.05 }, alpha: { start: 0.5, end: 0 }, tint: 0xe8f0ff, frequency: 70
  }), z - 0.1);
  const bob = { y: 0, a: 0 };
  void r.tween({ targets: bob, y: 3, duration: 1700, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  void r.tween({ targets: bob, a: 1.4, duration: 2300, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  r.onFrame(() => {
    const p = Reel.at(img, at.fx, at.fy);
    const k = at.scale * img.scaleX / 0.766;
    ship.setPosition(p.x, p.y + bob.y * k * 4).setScale(k).setAngle(bob.a - 0.7);
    const dir = at.flip ? -1 : 1;
    const hw = ship.width * k / 2, hh = ship.height * k;
    lamps[0]!.setPosition(p.x + dir * hw * 0.93, p.y - hh * 0.2).setScale(0.2 * k * 4);
    lamps[1]!.setPosition(p.x - dir * hw * 0.97, p.y - hh * 0.23).setScale(0.2 * k * 4);
    wake.setPosition(p.x - dir * hw * 0.8, p.y - 2);
  });
  return { ship, at };
};

const escape: Script = async (r) => {
  r.black();
  r.letterbox();
  const sea = r.painting("backdrop:harbor_night", { zoom: 1.14, x: 0.4, y: 0.6 }, { zoom: 1.02, x: 0.55, y: 0.5 }, 16000, { fade: 1200, fallback: 0x0a1424 });
  if (!(sea instanceof Phaser.GameObjects.Image)) { await r.wait(800); }
  // The moon on the water, breathing.
  if (sea instanceof Phaser.GameObjects.Image) {
    const moon = r.glow(0, 0, 0xdce8ff, 0.9, 0.35, Z.GRADE + 0.5);
    r.onFrame(() => { const p = Reel.at(sea, 0.745, 0.13); moon.setPosition(p.x, p.y); });
    void r.tween({ targets: moon, alpha: 0.5, duration: 2600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const { at } = shipOn(r, sea, { fx: 0.47, fy: 0.6, scale: 0.15, tint: 0xa8b8d8 });
    // Out of the harbour, toward the moon's road on the water.
    void r.tween({ targets: at, fx: 0.69, fy: 0.33, scale: 0.06, duration: 15500, ease: "Sine.easeIn" });
  }
  r.place("Para Harbor", "Moonrise, the night after the cliffs.", 4200);
  await r.wait(4400);
  r.caption("Kian is dead. The King's soldiers are already on the road.", 3400);
  await r.wait(3500);
  r.caption("Madame Dawn's ship is the squad's only way out.", 3200);
  await r.wait(3300);
  r.caption("Ahead: fourteen months of open sea. At the end of it, Grude, the heart of the empire.", 4000);
  await r.wait(4100);
  await r.slam("The Escape to Grude", undefined, 1800, "#e4ecf4");
  await r.fadeOut(900);
};

// ---- Grude burns -------------------------------------------------------------

const grudeBurns: Script = async (r) => {
  r.black();
  r.letterbox();
  const city = r.painting("backdrop:grude", { zoom: 1.0, x: 0.5, y: 0.5 }, { zoom: 1.22, x: 0.4, y: 0.45 }, 15000, { fade: 1000, fallback: 0x1a0c08 });
  // Night, lit red from below by the city itself.
  r.grade(0x5a4a64, 1, 0);
  const sky = r.add(r.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD), Z.GRADE + 0.2);
  sky.fillGradientStyle(0xff5a1a, 0xff5a1a, 0xff5a1a, 0xff5a1a, 0, 0, 0.32, 0.32);
  sky.fillRect(0, 0, W, H);
  if (city instanceof Phaser.GameObjects.Image) {
    const fires: [number, number, number][] = [
      [0.24, 0.33, 1.3], [0.45, 0.5, 1.1], [0.33, 0.45, 0.9], [0.55, 0.41, 1], [0.29, 0.56, 1.2],
      [0.6, 0.62, 0.9], [0.18, 0.46, 0.8], [0.4, 0.38, 0.7], [0.5, 0.6, 1.1]
    ];
    fires.forEach(([fx, fy, size], i) => {
      r.scene.time.delayedCall(300 + i * 520, () => {
        if (r.skipped) return;
        r.fire(() => Reel.at(city, fx, fy), size, 16000);
        if (i % 3 === 0) sfxCineBoom();
      });
    });
  }
  r.embers({ x: 0, y: H * 0.3, w: W, h: H * 0.5 }, 15000, Z.FRONT_FX, 26);
  r.place("Grude", "The capital. That same night.", 4200);
  await r.wait(4400);
  r.caption("While the squad held the road, the fire reached the capital.", 3300);
  await r.wait(3400);
  r.caption("Captain Brask's fire teams are burning Grude, street by street.", 3400);
  await r.wait(3500);
  r.caption("The granaries are gone. If the upper district falls, the city starves.", 3600);
  await r.wait(3700);
  await r.slam("Grude Burns", undefined, 1700, "#ffb070");
  await r.fadeOut(900);
};

// ---- the sky opens --------------------------------------------------------------

const skyFleet: Script = async (r) => {
  r.black();
  r.letterbox();
  const sky = r.painting("backdrop:open_sea", { zoom: 1.12, x: 0.45, y: 0.4 }, { zoom: 1.0, x: 0.5, y: 0.45 }, 17000, { fade: 1200, fallback: 0x3a4a6a });
  void sky;
  r.place("The Eastern Sea", "Sunrise, after the bell.", 4000);
  await r.wait(3000);
  // The light goes wrong.
  sfxCineRise();
  r.grade(0x4a5470, 1, 3200);
  const tint = r.grade(0x103a34, 0.5, 3200, "add");
  void tint;
  r.caption("At sunrise, the sky went dark.", 3000);
  const lights = r.glow(W * 0.5, H * 0.18, 0x7affd9, 3.2, 0, Z.BACK_FX);
  void r.tween({ targets: lights, alpha: 0.4, duration: 2600 });
  await r.wait(2600);
  // Far ships first, then the one overhead.
  for (const [x, s, d] of [[W * 0.18, 0.13, 0], [W * 0.84, 0.1, 500], [W * 0.66, 0.08, 900]] as const) {
    r.scene.time.delayedCall(d, () => {
      const far = r.object("story:ravage_ship", x, -60, s, Z.BACK_FX + 0.2);
      if (!far) return;
      far.setTint(0x8aa0b0).setAlpha(0.85);
      void r.tween({ targets: far, y: H * 0.3 + s * 300, duration: 7000, ease: "Sine.easeOut" });
    });
  }
  const big = r.object("story:ravage_ship", W * 0.52, -260, 0.82, Z.FIGURES);
  r.caption("Ships bigger than cities came down through the clouds.", 3600);
  if (big) {
    sfxCineBoom();
    r.shake(5200, 0.0016);
    await r.tween({ targets: big, y: H * 0.26, duration: 5200, ease: "Sine.easeOut" });
    // Its ring lights, and a beam drops to the sea.
    const ring = r.glow(big.x + big.displayWidth * 0.02, big.y + big.displayHeight * 0.34, 0x7affd9, 1.2, 0, Z.FIGURES + 0.1);
    void r.tween({ targets: ring, alpha: 0.9, duration: 600, yoyo: true, repeat: -1, hold: 300 });
    const beam = r.add(r.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD), Z.FIGURES - 0.1);
    const bx = ring.x, by = ring.y;
    beam.fillGradientStyle(0x7affd9, 0x7affd9, 0x7affd9, 0x7affd9, 0.55, 0.55, 0.1, 0.1);
    beam.fillRect(bx - 40, by, 80, H - by);
    beam.setScale(1, 0).setPosition(0, 0);
    sfxCineBell(0.5);
    r.flash(0x7affd9, 0.3, 700);
    void r.tween({ targets: beam, scaleY: 1, duration: 700, ease: "Cubic.easeIn" });
    void r.tween({ targets: big, y: big.y + 8, duration: 2000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  } else {
    await r.wait(3000);
  }
  await r.wait(1200);
  r.caption("No kingdom on any map had ever seen anything like them.", 3400);
  await r.wait(3500);
  await r.slam("The Sky Speaks", undefined, 1800, "#9affe4");
  await r.fadeOut(1000);
};

const SCRIPTS: Record<CinematicId, Script> = { coup, escape, grude_burns: grudeBurns, sky_fleet: skyFleet };

/** What plays under each film (the arc's own music takes over after). */
export const CINEMATIC_MUSIC: Record<CinematicId, StoryArc["music"]> = {
  coup: "trailer", escape: "trailer", grude_burns: "danger", sky_fleet: "trailer"
};

/** The art each film draws, to wait for when it is still streaming in. */
export const CINEMATIC_ART: Record<CinematicId, string[]> = {
  coup: ["backdrop:palaceCoup", "backdrop:throne_hall", "unit:spearton:idle", "unit:archer:idle"],
  escape: ["backdrop:harbor_night", "story:ship"],
  grude_burns: ["backdrop:grude"],
  sky_fleet: ["backdrop:open_sea", "story:ravage_ship"]
};

/**
 * Play a cinematic over `scene` at `depth`, resolving when it ends or is
 * skipped ("Skip ▸▸", Esc, or a second click).
 */
export const playCinematic = async (scene: Phaser.Scene, id: CinematicId, depth: number): Promise<void> => {
  await artReady(scene, CINEMATIC_ART[id], 5000);
  const r = new Reel(scene, depth);
  const skipBtn = scene.add.text(W - 40, H - 32, "Skip ▸▸", {
    fontFamily: FAMILY_BODY, fontSize: "18px", color: "#c9b07a", stroke: "#000", strokeThickness: 3
  }).setOrigin(1, 0.5).setAlpha(0.8).setDepth(depth + Z.CHROME).setInteractive({ useHandCursor: true });
  skipBtn.on("pointerover", () => skipBtn.setAlpha(1).setColor("#f4d999"));
  skipBtn.on("pointerout", () => skipBtn.setAlpha(0.8).setColor("#c9b07a"));
  const hint = r.add(scene.add.text(W / 2, H - 32, "Click again to skip", {
    fontFamily: FAMILY_BODY, fontSize: "17px", color: "#e0d4b4", fontStyle: "italic", stroke: "#000", strokeThickness: 3
  }).setOrigin(0.5).setAlpha(0), Z.CHROME);
  let armedAt = -1e9;
  const skip = (): void => { if (!r.skipped) { sfxClick(); r.skip(); } };
  const onDown = (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]): void => {
    if (over.includes(skipBtn)) { skip(); return; }
    const now = scene.time.now;
    if (now - armedAt < 2200) { skip(); return; }
    armedAt = now;
    scene.tweens.killTweensOf(hint);
    hint.setAlpha(1);
    scene.tweens.add({ targets: hint, alpha: 0, delay: 1600, duration: 500 });
  };
  const onKey = (e: KeyboardEvent): void => { if (e.key === "Escape") skip(); };
  scene.input.on("pointerdown", onDown);
  scene.input.keyboard?.on("keydown", onKey);
  try {
    await SCRIPTS[id](r);
  } finally {
    scene.input.off("pointerdown", onDown);
    scene.input.keyboard?.off("keydown", onKey);
    skipBtn.destroy();
    r.destroy();
  }
};

/** Wait (up to `ms`) for art still streaming in; go on without it after. */
export const artReady = (scene: Phaser.Scene, keys: string[], ms: number): Promise<void> => {
  const missing = new Set(keys.filter((k) => !scene.textures.exists(k)));
  const loader = scene.scene.get("AssetStreamScene")?.load;
  if (!missing.size || !loader || !loader.isLoading()) return Promise.resolve();
  return new Promise((res) => {
    const done = (): void => {
      loader.off(Phaser.Loader.Events.FILE_COMPLETE, onFile);
      loader.off(Phaser.Loader.Events.COMPLETE, done);
      res();
    };
    const onFile = (key: string): void => { if (missing.delete(key) && missing.size === 0) done(); };
    loader.on(Phaser.Loader.Events.FILE_COMPLETE, onFile);
    loader.once(Phaser.Loader.Events.COMPLETE, done);
    scene.time.delayedCall(ms, done);
  });
};

// ═══════════ Stages — staged pictures behind the dialogue ═══════════

export interface Stage { destroy(fadeMs: number): void }

/**
 * Build a stage at `depth`, fading in. Like the ring tableau, it is laid
 * out above the dialog panel (y < 430) and runs until the arc ends or the
 * next stage replaces it.
 */
export const showStage = (scene: Phaser.Scene, id: StageId, depth: number): Stage => {
  const r = new Reel(scene, depth);
  STAGES[id](r);
  r.layer.setAlpha(0);
  scene.tweens.add({ targets: r.layer, alpha: 1, duration: 1300, ease: "Sine.easeOut" });
  return {
    destroy: (fadeMs) => {
      if (fadeMs <= 0) { r.destroy(); return; }
      scene.tweens.add({ targets: r.layer, alpha: 0, duration: fadeMs, onComplete: () => r.destroy() });
    }
  };
};

/** Above the dialog panel: where feet stand on a stage. */
const STAGE_FEET = 426;

/** Bolts streaking in from the left edge to (x, y), one after another. */
const volley = (r: Reel, x: number, y: number, n: number, gap: number): void => {
  for (let i = 0; i < n; i++) {
    r.scene.time.delayedCall(i * gap, () => {
      const g = r.add(r.scene.add.graphics(), Z.FRONT_FX);
      const p = { v: 0 };
      const y0 = y - 40 + i * 12;
      r.scene.tweens.add({
        targets: p, v: 1, duration: 140,
        onUpdate: () => {
          g.clear();
          const bx = -20 + (x + 20) * p.v;
          g.lineStyle(2, 0xe8e0d0, 1);
          g.lineBetween(bx - 30, y0 + (y - y0) * p.v, bx, y0 + (y - y0) * p.v);
        },
        onComplete: () => {
          g.destroy();
          // A spark where it lands, gone at once.
          const spark = r.glow(x, y - 30 + i * 6, 0xffe0c0, 0.16, 0.9, Z.FRONT_FX);
          r.scene.tweens.add({ targets: spark, alpha: 0, scale: 0.3, duration: 240, ease: "Cubic.easeOut", onComplete: () => spark.destroy() });
          sfxCineClang();
        }
      });
    });
  }
};

const STAGES: Record<StageId, (r: Reel) => void> = {
  // The cliff above Para Harbor at sundown: Kian on the stair-head, the
  // squad coming up the path to meet him, the light behind them all.
  kian_duel: (r) => {
    const cliff = r.painting("backdrop:cliffs", { zoom: 1.3, x: 0.68, y: 0.84 }, { zoom: 1.36, x: 0.7, y: 0.85 }, 30000, { fallback: 0x5a3a2a });
    r.grade(0xffd0a0, 0.12, 0, "add");
    if (cliff instanceof Phaser.GameObjects.Image) {
      const sun = r.glow(0, 0, 0xffc070, 1.8, 0.4, Z.GRADE + 0.5);
      r.onFrame(() => { const p = Reel.at(cliff, 0.11, 0.18); sun.setPosition(p.x, p.y); });
    }
    const RIM = 0xffb060;
    const kian = r.figure("kian", 840, STAGE_FEET - 4, { left: true, rim: RIM, rimAlpha: 0.6 });
    const amar = r.figure("amar", 360, STAGE_FEET, { rim: RIM, rimAlpha: 0.6 });
    const squad = [
      r.figure("maya", 290, STAGE_FEET - 8, { rim: RIM, rimAlpha: 0.5 }),
      r.figure("ning", 230, STAGE_FEET - 4, { rim: RIM, rimAlpha: 0.5 }),
      r.figure("leo", 170, STAGE_FEET - 10, { rim: RIM, rimAlpha: 0.5 }),
      r.figure("lucian", 110, STAGE_FEET - 2, { rim: RIM, rimAlpha: 0.5 })
    ];
    // Amar walks out ahead of them; Kian lifts his blade.
    r.scene.time.delayedCall(1200, () => { void amar.walkTo(560, STAGE_FEET, 1600); });
    r.scene.time.delayedCall(3000, () => { void kian.strike(); });
    for (const [i, f] of squad.entries()) r.scene.time.delayedCall(1500 + i * 150, () => { void f.walkTo(f.box.x + 60, f.box.y, 900); });
    const dust = r.add(r.scene.add.particles(0, 0, ensureDotTexture(r.scene), {
      x: { min: 0, max: W }, y: { min: 300, max: 430 }, speedX: { min: -80, max: -40 }, speedY: { min: -6, max: 6 },
      lifespan: { min: 2000, max: 3200 }, scale: { start: 0.25, end: 0 }, alpha: { start: 0.5, end: 0 },
      tint: 0xffe0b0, frequency: 120
    }), Z.FRONT_FX);
    void dust;
  },
  // Orinhal, the square below burning: the King's tax men run, and Leo
  // walks his dactyl across to the partisans' side. The squad follows.
  leo_defects: (r) => {
    r.painting("backdrop:orinhal", { zoom: 1.12, x: 0.45, y: 0.6 }, { zoom: 1.16, x: 0.48, y: 0.62 }, 30000, { fallback: 0x3a2a24 });
    const partisans = [
      r.figure("archer", 900, STAGE_FEET - 6, { left: true, tint: 0xc8e0b8 }),
      r.figure("archer", 980, STAGE_FEET - 14, { left: true, tint: 0xc8e0b8 }),
      r.figure("bandit_swordsman", 1060, STAGE_FEET - 4, { left: true })
    ];
    void partisans;
    const taxmen = [r.figure("royal_guard", 520, STAGE_FEET - 2, { left: true }), r.figure("royal_guard", 600, STAGE_FEET - 8, { left: true })];
    for (const [i, t] of taxmen.entries()) r.scene.time.delayedCall(300 + i * 200, () => { void t.walkTo(-120, t.box.y, 2400); });
    const leo = r.figure("leo", 300, STAGE_FEET);
    r.scene.time.delayedCall(1600, () => { void leo.walkTo(780, STAGE_FEET, 2600); });
    const followers = ["amar", "ning", "maya", "lucian"].map((id, i) => r.figure(id, -60 - i * 70, STAGE_FEET - (i % 2) * 8));
    followers.forEach((f, i) => r.scene.time.delayedCall(3200 + i * 220, () => { void f.walkTo(560 - i * 70, f.box.y, 2400); }));
    r.embers({ x: 0, y: 120, w: W, h: 260 }, 600000, Z.FRONT_FX, 160);
  },
  // The plaza, that night: four bolts, Rose between them and Dawn, and
  // the squad running in too late.
  rose_falls: (r) => {
    const city = r.painting("backdrop:grude", { zoom: 1.5, x: 0.32, y: 0.78 }, { zoom: 1.55, x: 0.33, y: 0.78 }, 30000, { fallback: 0x1a1a2a });
    r.grade(0x585890, 1, 0);
    if (city instanceof Phaser.GameObjects.Image) {
      const lamp = r.glow(0, 0, 0xffb060, 0.9, 0.45, Z.GRADE + 0.5);
      r.onFrame(() => { const p = Reel.at(city, 0.4, 0.74); lamp.setPosition(p.x, p.y); });
    }
    // A little higher than the other stages: Rose lying down must clear
    // the dialog panel.
    const FEET = STAGE_FEET - 16;
    // Moonlight on their edges, so they read against the dark.
    const MOON = 0xb8c4ff;
    const dawn = r.figure("dawn", 760, FEET - 4, { left: true, tint: 0xd8d0e8, rim: MOON, rimAlpha: 0.55 });
    const rose = r.figure("rose", 520, FEET, { tint: 0xe0d8f0, rim: MOON, rimAlpha: 0.7 });
    void dawn;
    r.scene.time.delayedCall(700, () => { void rose.walkTo(690, FEET, 500); });
    r.scene.time.delayedCall(1300, () => volley(r, 690, FEET - 40, 4, 160));
    r.scene.time.delayedCall(1400, () => { rose.play("hit"); r.shake(220, 0.004); });
    r.scene.time.delayedCall(2300, () => rose.collapse());
    // Where she lies, a little pale light stays.
    const still = r.glow(700, FEET - 10, MOON, 0.42, 0, Z.BACK_FX);
    r.scene.time.delayedCall(2900, () => { void r.tween({ targets: still, alpha: 0.5, duration: 1400 }); });
    const squad = ["amar", "maya", "leo"].map((id, i) => r.figure(id, -80 - i * 70, FEET - (i % 2) * 8, { tint: 0xd0d0e8, rim: MOON, rimAlpha: 0.45 }));
    squad.forEach((f, i) => r.scene.time.delayedCall(2600 + i * 200, () => { void f.walkTo(470 - i * 80, f.box.y, 1400); }));
  },
  // The squad at the throne-hall doors, before the first battle.
  throne: (r) => {
    r.painting("backdrop:throne_hall", { zoom: 1.08, x: 0.58, y: 0.5 }, { zoom: 1.0, x: 0.55, y: 0.5 }, 30000, { fallback: 0x2a1a14 });
    r.grade(0x000000, 0.25, 0);
    // Just inside the doors, on the left, the throne ahead of them.
    r.figure("selene", 300, STAGE_FEET - 6, { tint: 0xffe2c8 });
    r.figure("amar", 380, STAGE_FEET, { tint: 0xffe2c8 });
    r.figure("ranatoli", 460, STAGE_FEET - 4, { tint: 0xffe2c8 });
    r.embers({ x: 0, y: 220, w: W, h: 220 }, 600000, Z.FRONT_FX, 140);
  },
  // The long crossing: the ship alone on the open sea, days and nights
  // turning over it.
  voyage: (r) => {
    // Framed high, so the water shows above the dialog panel.
    const sea = r.painting("backdrop:open_sea", { zoom: 1.14, x: 0.45, y: 0.62 }, { zoom: 1.1, x: 0.55, y: 0.6 }, 40000, { fallback: 0x2a3a5a });
    const night = r.grade(0x26305a, 0, 0);
    const moon = r.glow(W * 0.78, 90, 0xdce8ff, 0.7, 0, Z.GRADE + 0.5);
    // A day, a night, a day... every sixteen seconds.
    r.scene.tweens.add({ targets: night, alpha: 0.92, duration: 8000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    r.scene.tweens.add({ targets: moon, alpha: 0.45, duration: 8000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    if (sea instanceof Phaser.GameObjects.Image) {
      const { at } = shipOn(r, sea, { fx: 0.3, fy: 0.635, scale: 0.24 });
      r.scene.tweens.add({ targets: at, fx: 0.62, duration: 60000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  },
  // Lucian's burial: the ship slowed on a grey dawn sea.
  burial: (r) => {
    const sea = r.painting("backdrop:open_sea", { zoom: 1.1, x: 0.5, y: 0.5 }, { zoom: 1.04, x: 0.5, y: 0.5 }, 40000, { fallback: 0x3a4250 });
    r.grade(0x8a96a8, 1, 0);
    r.grade(0x1a2030, 0.25, 0, "add");
    if (sea instanceof Phaser.GameObjects.Image) shipOn(r, sea, { fx: 0.46, fy: 0.62, scale: 0.34 });
    const motes = r.add(r.scene.add.particles(0, 0, ensureDotTexture(r.scene), {
      x: { min: 200, max: 1080 }, y: { min: 120, max: 420 }, speedY: { min: -10, max: -3 },
      lifespan: { min: 3000, max: 5200 }, scale: { start: 0.2, end: 0 }, alpha: { start: 0.6, end: 0 },
      tint: 0xf0f4ff, blendMode: Phaser.BlendModes.ADD, frequency: 220
    }), Z.FRONT_FX);
    void motes;
    sfxCineChime(0.75);
  },
  // Fourteen months on: Grude's harbour, and Khione's ship coming in.
  grude_arrival: (r) => {
    const city = r.painting("backdrop:grude", { zoom: 1.2, x: 0.75, y: 0.42 }, { zoom: 1.1, x: 0.62, y: 0.45 }, 30000, { fallback: 0x5a6a80 });
    if (city instanceof Phaser.GameObjects.Image) {
      const { at } = shipOn(r, city, { fx: 1.02, fy: 0.5, scale: 0.13, flip: true });
      r.scene.tweens.add({ targets: at, fx: 0.8, fy: 0.52, duration: 16000, ease: "Sine.easeOut" });
    }
    const gulls = r.add(r.scene.add.particles(0, 0, ensureDotTexture(r.scene), {
      x: { min: 700, max: 1280 }, y: { min: 80, max: 200 }, speedX: { min: -30, max: -12 }, speedY: { min: -4, max: 4 },
      lifespan: 9000, scale: 0.18, tint: 0xffffff, alpha: 0.8, frequency: 1600
    }), Z.FRONT_FX);
    void gulls;
    sfxCineBell(1.2);
  }
};

