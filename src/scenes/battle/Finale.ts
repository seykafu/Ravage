import Phaser from "phaser";
import { readMs } from "../../ui/readTime";
import type { SevenPath } from "../../data/contentIds";
import { FAMILY_BODY, FAMILY_DISPLAY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../../util/constants";
import { DEPTH } from "../../render/depth";
import { ensureDotTexture } from "./Atmosphere";
import { ashBurst, groundDust, soulWisp } from "./Impact";
import {
  sfxCineBell, sfxCineBoom, sfxCineCannon, sfxCineChime, sfxCineClang, sfxCineRise
} from "../../audio/Sfx";

// ─────────────────────────────────────────────────────────────────────────
// Finales — a short cut-scene on the battle board to close every major
// boss fight, and the last two chapters of every road through the game.
//
//   boss fights (B5 Ndari, B7 Selene, B11 Kian, B13, B14 Castor, B15
//   Coyne, B16 Wren, the B19 openers with a boss, B20 Serrick, B22 Brask,
//   B23 Vasse, B24 the bell, B27 the Herald): the blow, the fall or the
//   yield, their last words in the air, one picture, the chapter's card
//   war paths (vengeance, restoration, revolution, duty, mercy)
//     B28 The Path Ends   the last blow, the path's own moment, then the
//                         grounded flagship's shadow lifting off the board
//     B29 One Last Morning  the sun comes up on a small, finished job
//   exile, forgetting
//     B18 Seven Names, One Choice   the seven names rise round Amar
//     B19 (their own)     the snow pass; the fisherman's shore
//
// It plays after the victory is decided (and after any before_victory
// dialogue), before the fade to the victory screen. Everything is built
// from the board itself: the camera slamming in, the board turning under
// it (the turntable at a slow pace), a colour grade on the world camera,
// light, particles and type, letterboxed with the battle's own UI hidden.
// A click or a key skips it.
//
// The battle scene implements FinaleHost; this module owns the shots.
// ─────────────────────────────────────────────────────────────────────────

export interface Pt { x: number; y: number }

export interface FinaleHost {
  readonly scene: Phaser.Scene;
  readonly webgl: boolean;
  /** The last blow of the battle, if one decided it. */
  readonly finalBlow: { attacker: string; target: string } | null;
  /** World point of a unit's body: where it stands, or the tile it fell on. */
  unitPoint(id: string): Pt | null;
  /** Living units of a faction. */
  living(faction: "player" | "enemy"): string[];
  /** The middle of the board in the current view. */
  boardCentre(): Pt;
  /** Ease the camera until `p` sits mid-screen at `zoom` × the default view. */
  focus(p: Pt, zoom: number, ms: number): Promise<void>;
  /** Turn the board `quarters` quarter-turns at `pace` (1 = the normal turn). */
  orbit(quarters: number, pace: number): Promise<void>;
  /** Fade the battle's own UI away. */
  hideUi(ms: number): void;
  /** A unit hops in place (cheering). */
  hop(id: string, height: number, times: number): Promise<void>;
  /** World → screen (UI px). */
  worldToUi(x: number, y: number): Pt;
  /** Route an object made now to the tilted world camera / the flat UI camera only. */
  world<T extends Phaser.GameObjects.GameObject>(o: T): T;
  ui<T extends Phaser.GameObjects.GameObject>(o: T): T;
  groundSquash(): number;
}

export type FinaleScript = (c: Cine) => Promise<void>;

/** The seven roads, in the order the choice offers them. */
const SEVEN = ["Vengeance", "Restoration", "Revolution", "Duty", "Exile", "Mercy", "Forgetting"];
const SEVEN_HUES = [0xe0584a, 0xe8c45a, 0xd8743c, 0x8fb0d8, 0xb8c8d8, 0xf0ece0, 0x9ad0c4];

const DEPTH_CINE = 2000;
const CX = GAME_WIDTH / 2, CY = GAME_HEIGHT / 2;
const BAR = 72;

type Grade = "mono" | "blood" | "cold" | "dusk" | "dawn";
// 5×4 colour matrices (offsets left at 0): what each grade does to a pixel.
const GRADES: Record<Grade, number[]> = {
  mono: [0.3, 0.59, 0.11, 0, 0, 0.3, 0.59, 0.11, 0, 0, 0.3, 0.59, 0.11, 0, 0, 0, 0, 0, 1, 0],
  blood: [0.62, 0.7, 0.2, 0, 0, 0.16, 0.2, 0.06, 0, 0, 0.14, 0.18, 0.06, 0, 0, 0, 0, 0, 1, 0],
  cold: [0.5, 0.28, 0.1, 0, 0, 0.22, 0.58, 0.14, 0, 0, 0.24, 0.38, 0.86, 0, 0, 0, 0, 0, 1, 0],
  dusk: [1.12, 0.16, 0, 0, 0, 0.06, 0.94, 0.04, 0, 0, 0, 0.06, 0.66, 0, 0, 0, 0, 0, 1, 0],
  dawn: [1.08, 0.1, 0, 0, 0, 0.04, 1.04, 0.02, 0, 0, 0, 0.04, 0.9, 0, 0, 0, 0, 0, 1, 0]
};

/**
 * The cut-scene toolkit: every shot is made of these. After a skip they
 * all return at once and draw nothing, so a script simply runs out.
 */
export class Cine {
  skipped = false;
  private readonly scene: Phaser.Scene;
  /** The dark well behind the last ring of names; it leaves with them. */
  private well?: Phaser.GameObjects.Graphics;
  private grades: { m: Phaser.FX.ColorMatrix; kind: Grade }[] = [];

  constructor(readonly host: FinaleHost) {
    this.scene = host.scene;
  }

  wait(ms: number): Promise<void> {
    if (this.skipped) return Promise.resolve();
    return new Promise((res) => {
      this.scene.time.delayedCall(ms, res);
      this.onSkip.push(res);
    });
  }

  /** Resolvers to release early on a skip. */
  onSkip: (() => void)[] = [];

  skip(): void {
    if (this.skipped) return;
    this.skipped = true;
    for (const r of this.onSkip.splice(0)) r();
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    if (this.skipped) return Promise.resolve();
    return new Promise((res) => {
      const done = cfg.onComplete;
      this.scene.tweens.add({ ...cfg, onComplete: (...a: unknown[]) => { (done as ((...x: unknown[]) => void) | undefined)?.(...a); res(); } });
      this.onSkip.push(res);
    });
  }

  private ui<T extends Phaser.GameObjects.GameObject>(o: T): T {
    return this.host.ui(o);
  }

  private world<T extends Phaser.GameObjects.GameObject>(o: T): T {
    return this.host.world(o);
  }

  // ---- framing -----------------------------------------------------------

  /** Letterbox in, the battle UI out, and the skip hint. */
  begin(): void {
    this.host.hideUi(450);
    const top = this.ui(this.scene.add.rectangle(0, 0, GAME_WIDTH, BAR, 0x000000, 1).setOrigin(0, 0).setDepth(DEPTH_CINE).setScale(1, 0));
    const bot = this.ui(this.scene.add.rectangle(0, GAME_HEIGHT, GAME_WIDTH, BAR, 0x000000, 1).setOrigin(0, 1).setDepth(DEPTH_CINE).setScale(1, 0));
    void this.tween({ targets: [top, bot], scaleY: 1, duration: 520, ease: "Cubic.easeOut" });
    const hint = this.ui(this.scene.add.text(GAME_WIDTH - 24, GAME_HEIGHT - BAR / 2, "click to skip", {
      fontFamily: FAMILY_BODY, fontSize: "13px", color: "#8a8272", fontStyle: "italic"
    }).setOrigin(1, 0.5).setDepth(DEPTH_CINE + 1).setAlpha(0));
    void this.tween({ targets: hint, alpha: 0.7, delay: 900, duration: 600 });
  }

  focus(p: Pt, zoom: number, ms: number): Promise<void> {
    if (this.skipped) return Promise.resolve();
    return this.host.focus(p, zoom, ms);
  }

  orbit(quarters: number, pace: number): Promise<void> {
    if (this.skipped) return Promise.resolve();
    return this.host.orbit(quarters, pace);
  }

  shake(ms: number, intensity: number): void {
    if (this.skipped) return;
    this.scene.cameras.main.shake(ms, intensity);
  }

  /** A full-screen flash that fades. */
  flash(colour = 0xffffff, alpha = 0.75, ms = 500): void {
    if (this.skipped) return;
    const r = this.ui(this.scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, colour, 1).setOrigin(0, 0)
      .setDepth(DEPTH_CINE - 5).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD));
    void this.tween({ targets: r, alpha: 0, duration: ms, ease: "Cubic.easeOut", onComplete: () => r.destroy() });
  }

  /** Grade the world toward `kind` (WebGL only); other grades fade back out. */
  grade(kind: Grade, amount: number, ms: number): void {
    if (this.skipped || !this.host.webgl) return;
    for (const g of this.grades) {
      if (g.kind !== kind) void this.tween({ targets: g.m, alpha: 0, duration: ms });
    }
    let g = this.grades.find((x) => x.kind === kind);
    if (!g) {
      const m = this.scene.cameras.main.postFX.addColorMatrix();
      m.set(GRADES[kind]);
      m.alpha = 0;
      g = { m, kind };
      this.grades.push(g);
    }
    void this.tween({ targets: g.m, alpha: amount, duration: ms, ease: "Sine.easeInOut" });
  }

  /**
   * The closing card: a title tracking in over a gold rule, and a line of
   * the chapter's own words under it. Resolves when it has held.
   */
  async title(main: string, sub: string | undefined, hold: number, colour = "#f4d999"): Promise<void> {
    if (this.skipped) return;
    const t = this.ui(this.scene.add.text(CX, CY - 18, main, {
      fontFamily: FAMILY_DISPLAY,
      fontSize: "50px",
      color: colour,
      stroke: "#120a04",
      strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 4, color: "#000", blur: 18, fill: true }
    }).setOrigin(0.5).setDepth(DEPTH_CINE + 2).setAlpha(0).setLetterSpacing(16));
    const rule = this.ui(this.scene.add.graphics().setDepth(DEPTH_CINE + 2));
    const spacing = { v: 16 };
    void this.tween({ targets: t, alpha: 1, duration: 900, ease: "Sine.easeOut" });
    void this.tween({ targets: spacing, v: 5, duration: 1400, ease: "Cubic.easeOut", onUpdate: () => t.setLetterSpacing(spacing.v) });
    const w = { v: 0 };
    void this.tween({
      targets: w, v: 1, delay: 300, duration: 900, ease: "Cubic.easeOut",
      onUpdate: () => {
        const half = (Math.min(560, t.width + 80) / 2) * w.v;
        rule.clear();
        rule.lineStyle(1, 0xc9a24a, 0.85);
        rule.lineBetween(CX - half, CY + 22, CX + half, CY + 22);
        rule.fillStyle(0xf4d999, 1);
        rule.fillRect(CX - 2, CY + 20, 4, 4);
      }
    });
    if (sub) {
      const s = this.ui(this.scene.add.text(CX, CY + 48, sub, {
        fontFamily: FAMILY_BODY, fontSize: "20px", color: "#ebdfc4", fontStyle: "italic",
        stroke: "#000", strokeThickness: 3, wordWrap: { width: 900 }, align: "center"
      }).setOrigin(0.5, 0).setDepth(DEPTH_CINE + 2).setAlpha(0));
      void this.tween({ targets: s, alpha: 1, delay: 700, duration: 900 });
    }
    // The line under the title gets its reading time once it has faded in.
    await this.wait(Math.max(900 + hold, 700 + readMs(sub ?? main)));
  }

  // ---- light and air ---------------------------------------------------

  /** World particles at a point, a burst. */
  burst(at: Pt, kind: "embers" | "gold" | "spark" | "white" | "mint", count: number, depth: number = DEPTH.ATMOSPHERE): void {
    if (this.skipped) return;
    const tint = kind === "embers" ? [0xffd07a, 0xff8a3c, 0xff5a20] : kind === "gold" ? [0xfff0b0, 0xf4c95a, 0xd8a03a]
      : kind === "white" ? [0xffffff, 0xf0f4ff] : kind === "mint" ? [0xc8fff0, 0x7affd9, 0x3ac8a8] : [0xfff6d0, 0xffc860];
    const e = this.world(this.scene.add.particles(at.x, at.y, ensureDotTexture(this.scene), {
      speed: { min: 60, max: kind === "gold" ? 260 : 180 },
      angle: { min: 200, max: 340 },
      gravityY: kind === "gold" ? 260 : 60,
      lifespan: { min: 600, max: 1500 },
      scale: { start: kind === "gold" ? 0.45 : 0.35, end: 0 },
      tint,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false
    }).setDepth(depth));
    e.explode(count);
    this.scene.time.delayedCall(2000, () => e.destroy());
  }

  /** Embers rising off the whole board — the end of a fire. */
  rising(kind: "embers" | "motes", ms: number): void {
    if (this.skipped) return;
    const c = this.host.boardCentre();
    const e = this.world(this.scene.add.particles(c.x, c.y + 60, ensureDotTexture(this.scene), {
      x: { min: -520, max: 520 },
      y: { min: -120, max: 160 },
      speedY: kind === "embers" ? { min: -90, max: -40 } : { min: -26, max: -10 },
      speedX: { min: -12, max: 18 },
      lifespan: { min: 1800, max: 3200 },
      scale: { start: kind === "embers" ? 0.32 : 0.26, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: kind === "embers" ? [0xffd07a, 0xff9a40, 0xff6a2a] : [0xfff2c0, 0xffd890],
      blendMode: Phaser.BlendModes.ADD,
      frequency: kind === "embers" ? 22 : 70
    }).setDepth(DEPTH.ATMOSPHERE));
    this.scene.time.delayedCall(ms, () => e.stop());
    this.scene.time.delayedCall(ms + 3400, () => e.destroy());
  }

  /** Screen weather: driving snow or drifting petals. */
  weather(kind: "snow" | "petals", ms: number): void {
    if (this.skipped) return;
    const snow = kind === "snow";
    const e = this.ui(this.scene.add.particles(0, 0, ensureDotTexture(this.scene), {
      x: { min: snow ? 200 : -40, max: GAME_WIDTH + (snow ? 500 : 40) },
      y: -20,
      speedX: snow ? { min: -260, max: -150 } : { min: -30, max: 30 },
      speedY: snow ? { min: 180, max: 320 } : { min: 40, max: 90 },
      lifespan: snow ? 4200 : 9000,
      scale: snow ? { min: 0.12, max: 0.42 } : { min: 0.28, max: 0.5 },
      alpha: snow ? { min: 0.5, max: 1 } : { start: 1, end: 0.6 },
      tint: snow ? 0xf4f8ff : [0xffc8d8, 0xfff0b8, 0xffffff, 0xf8a8c0],
      frequency: snow ? 12 : 90,
      rotate: snow ? 0 : { min: 0, max: 360 }
    }).setDepth(DEPTH_CINE - 10));
    this.scene.time.delayedCall(ms, () => e.stop());
    this.scene.time.delayedCall(ms + 9500, () => e.destroy());
  }

  /** The grounded flagship's shadow over the board: on now, lifted later. */
  shadow(): { lift: (ms: number) => Promise<void> } {
    if (this.skipped) return { lift: async () => undefined };
    const g = this.ui(this.scene.add.graphics().setDepth(DEPTH_CINE - 20));
    g.fillGradientStyle(0x02030a, 0x02030a, 0x02030a, 0x02030a, 0.78, 0.78, 0, 0);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT * 0.75);
    g.setAlpha(0);
    void this.tween({ targets: g, alpha: 1, duration: 600 });
    const glow = this.ui(this.scene.add.graphics().setDepth(DEPTH_CINE - 19).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
    glow.fillGradientStyle(0xffb860, 0xffb860, 0xffe0a0, 0xffe0a0, 0, 0, 0.18, 0.18);
    glow.fillRect(0, GAME_HEIGHT * 0.3, GAME_WIDTH, GAME_HEIGHT * 0.7);
    return {
      lift: async (ms: number) => {
        sfxCineRise();
        void this.tween({ targets: glow, alpha: 1, duration: ms * 0.7, ease: "Sine.easeOut" });
        void this.tween({ targets: glow, alpha: 0, delay: ms, duration: ms, ease: "Sine.easeIn" });
        await this.tween({ targets: g, y: -GAME_HEIGHT, duration: ms, ease: "Cubic.easeIn" });
      }
    };
  }

  /** A band of morning light sweeping across the board. */
  sunSweep(ms: number): void {
    if (this.skipped) return;
    const g = this.ui(this.scene.add.graphics().setDepth(DEPTH_CINE - 15).setBlendMode(Phaser.BlendModes.ADD));
    const W = 520;
    g.fillGradientStyle(0xffe6a8, 0xffe6a8, 0xffe6a8, 0xffe6a8, 0, 0.55, 0, 0.55);
    g.fillRect(0, 0, W / 2, GAME_HEIGHT);
    g.fillGradientStyle(0xffe6a8, 0xffe6a8, 0xffe6a8, 0xffe6a8, 0.55, 0, 0.55, 0);
    g.fillRect(W / 2, 0, W / 2, GAME_HEIGHT);
    g.setPosition(-W, 0).setAngle(-8);
    void this.tween({ targets: g, x: GAME_WIDTH + 200, duration: ms, ease: "Sine.easeInOut", onComplete: () => g.destroy() });
  }

  /** A gold ring rolling out across the ground from `at` — a bell's toll. */
  toll(at: Pt, pitch: number): void {
    if (this.skipped) return;
    sfxCineBell(pitch);
    const sq = this.host.groundSquash();
    for (let i = 0; i < 2; i++) {
      const r = this.world(this.scene.add.ellipse(at.x, at.y + 20, 40, 40 * sq)
        .setStrokeStyle(3, 0xf4d07a, 0.9).setDepth(DEPTH.GROUND_MARK + 0.6).setBlendMode(Phaser.BlendModes.ADD));
      void this.tween({
        targets: r, scaleX: 16, scaleY: 16, alpha: 0, delay: i * 260, duration: 2200, ease: "Sine.easeOut",
        onComplete: () => r.destroy()
      });
    }
    this.flash(0xffd890, 0.18, 900);
  }

  // ---- type in the air -----------------------------------------------------

  /** The seven names, appearing one by one in a slow ring round `at`. */
  async namesRing(at: Pt, gapMs: number): Promise<Phaser.GameObjects.Text[]> {
    if (this.skipped) return [];
    const centre = this.host.worldToUi(at.x, at.y - 40);
    const texts: Phaser.GameObjects.Text[] = [];
    // A dark well round him, so the names read over the deck.
    const well = this.ui(this.scene.add.graphics().setDepth(DEPTH_CINE - 40).setAlpha(0));
    for (let r = 6; r >= 1; r--) {
      well.fillStyle(0x020308, 0.12);
      well.fillEllipse(centre.x, centre.y, 140 + r * 70, 60 + r * 26);
    }
    void this.tween({ targets: well, alpha: 1, duration: 700 });
    this.well = well;
    const spin = { a: -Math.PI / 2 };
    const place = (): void => {
      texts.forEach((t, i) => {
        const a = spin.a + (i / SEVEN.length) * Math.PI * 2;
        t.setPosition(centre.x + Math.cos(a) * 270, centre.y + Math.sin(a) * 104);
        t.setDepth(DEPTH_CINE - 30 + Math.sin(a));
      });
    };
    void this.tween({ targets: spin, a: spin.a + Math.PI * 2, duration: 26000, onUpdate: place });
    for (let i = 0; i < SEVEN.length; i++) {
      if (this.skipped) break;
      const hue = SEVEN_HUES[i]!;
      const t = this.ui(this.scene.add.text(0, 0, SEVEN[i]!.toUpperCase(), {
        fontFamily: FAMILY_HEADING, fontSize: "23px",
        color: `#${hue.toString(16).padStart(6, "0")}`,
        stroke: "#05040a", strokeThickness: 4,
        shadow: { offsetX: 0, offsetY: 0, color: `#${hue.toString(16).padStart(6, "0")}`, blur: 12, fill: true }
      }).setOrigin(0.5).setAlpha(0).setScale(0.6).setLetterSpacing(3));
      texts.push(t);
      place();
      sfxCineChime(1 + i * 0.12);
      void this.tween({ targets: t, alpha: 1, scale: 1, duration: 600, ease: "Back.easeOut" });
      await this.wait(gapMs);
    }
    return texts;
  }

  private dropWell(ms: number): void {
    const w = this.well;
    this.well = undefined;
    if (w) void this.tween({ targets: w, alpha: 0, duration: ms, onComplete: () => w.destroy() });
  }

  /** Words come apart letter by letter and fall away like snow. */
  async dissolve(texts: Phaser.GameObjects.Text[], ms: number): Promise<void> {
    if (this.skipped) return;
    this.dropWell(ms * 0.8);
    const letters: Phaser.GameObjects.Text[] = [];
    for (const t of texts) {
      const chars = t.text.split("");
      const style = t.style.toJSON() as Phaser.Types.GameObjects.Text.TextStyle;
      const w = t.width / Math.max(1, chars.length);
      chars.forEach((ch, i) => {
        const l = this.ui(this.scene.add.text(t.x - t.width / 2 + w * (i + 0.5), t.y, ch, style)
          .setOrigin(0.5).setDepth(t.depth));
        letters.push(l);
      });
      t.destroy();
    }
    Phaser.Utils.Array.Shuffle(letters);
    letters.forEach((l, i) => {
      void this.tween({
        targets: l, delay: (i / letters.length) * ms * 0.7,
        y: l.y + Phaser.Math.Between(90, 220), x: l.x - Phaser.Math.Between(20, 110),
        alpha: 0, angle: Phaser.Math.Between(-80, 80), duration: ms * 0.5, ease: "Sine.easeIn",
        onComplete: () => l.destroy()
      });
    });
    await this.wait(ms);
  }

  async fadeAway(texts: Phaser.GameObjects.Text[], ms: number): Promise<void> {
    this.dropWell(ms);
    await Promise.all(texts.map((t) => this.tween({ targets: t, alpha: 0, duration: ms, onComplete: () => t.destroy() })));
  }

  // ---- the B28 beats -----------------------------------------------------------

  /** A name written large, then struck out in one red stroke. */
  async strikeName(name: string): Promise<void> {
    if (this.skipped) return;
    const t = this.ui(this.scene.add.text(CX, CY - 40, name.toUpperCase(), {
      fontFamily: FAMILY_DISPLAY, fontSize: "64px", color: "#e8dcc8",
      stroke: "#140806", strokeThickness: 7, shadow: { offsetX: 0, offsetY: 4, color: "#000", blur: 16, fill: true }
    }).setOrigin(0.5).setDepth(DEPTH_CINE + 2).setAlpha(0).setLetterSpacing(10));
    await this.tween({ targets: t, alpha: 1, duration: 700 });
    await this.wait(500);
    const g = this.ui(this.scene.add.graphics().setDepth(DEPTH_CINE + 3));
    const x0 = CX - t.width / 2 - 30, x1 = CX + t.width / 2 + 30;
    const p = { v: 0 };
    sfxCineBoom();
    this.shake(260, 0.004);
    await this.tween({
      targets: p, v: 1, duration: 260, ease: "Cubic.easeIn",
      onUpdate: () => {
        g.clear();
        const x = x0 + (x1 - x0) * p.v;
        g.lineStyle(9, 0xb81e1e, 1);
        g.lineBetween(x0, CY - 30, x, CY - 46);
        g.lineStyle(3, 0xff6a5a, 0.9);
        g.lineBetween(x0 + 6, CY - 33, x, CY - 48);
      }
    });
    t.setTint(0xd88a80);
    await this.wait(900);
    await Promise.all([
      this.tween({ targets: [t, g], alpha: 0, duration: 700, onComplete: () => { t.destroy(); g.destroy(); } })
    ]);
  }

  /** A crown forms over `at`, holds, and shatters. */
  async crownShatters(at: Pt): Promise<void> {
    if (this.skipped) return;
    const g = this.world(this.scene.add.graphics().setDepth(DEPTH.ATMOSPHERE + 1));
    const cy = at.y - 70;
    g.fillStyle(0xe8b84a, 1);
    g.lineStyle(2, 0x5a3a0a, 1);
    const pts = [-26, 10, -26, -10, -16, 2, -8, -18, 0, 0, 8, -18, 16, 2, 26, -10, 26, 10];
    const poly = [] as Phaser.Math.Vector2[];
    for (let i = 0; i < pts.length; i += 2) poly.push(new Phaser.Math.Vector2(pts[i]!, pts[i + 1]!));
    g.fillPoints(poly, true);
    g.strokePoints(poly, true);
    g.fillStyle(0xfff0b0, 1);
    for (const x of [-8, 8, 0]) g.fillCircle(x, x === 0 ? -1 : -18, 2.5);
    g.setPosition(at.x, cy).setScale(0.2).setAlpha(0);
    sfxCineChime(0.5);
    await this.tween({ targets: g, alpha: 1, scale: 2.4, duration: 900, ease: "Back.easeOut" });
    void this.tween({ targets: g, y: cy - 8, duration: 700, yoyo: true, ease: "Sine.easeInOut" });
    await this.wait(900);
    sfxCineClang();
    this.shake(300, 0.005);
    this.flash(0xfff0c0, 0.35, 500);
    this.burst({ x: at.x, y: cy }, "gold", 46, DEPTH.ATMOSPHERE + 2);
    g.destroy();
    await this.wait(900);
  }

  /** The coast batteries open on the flagship over the board. */
  async barrage(shells: number): Promise<void> {
    for (let i = 0; i < shells && !this.skipped; i++) {
      const sx = Phaser.Math.Between(-60, 260), sy = GAME_HEIGHT + 30;
      const tx = Phaser.Math.Between(260, GAME_WIDTH - 140), ty = Phaser.Math.Between(BAR + 6, BAR + 90);
      const g = this.ui(this.scene.add.graphics().setDepth(DEPTH_CINE - 12).setBlendMode(Phaser.BlendModes.ADD));
      const p = { v: 0 };
      sfxCineCannon();
      void this.tween({
        targets: p, v: 1, duration: 520, ease: "Sine.easeIn",
        onUpdate: () => {
          g.clear();
          const hx = sx + (tx - sx) * p.v, hy = sy + (ty - sy) * p.v - Math.sin(p.v * Math.PI) * 120;
          const bx = sx + (tx - sx) * Math.max(0, p.v - 0.14), by = sy + (ty - sy) * Math.max(0, p.v - 0.14) - Math.sin(Math.max(0, p.v - 0.14) * Math.PI) * 120;
          g.lineStyle(3, 0xffc870, 0.9);
          g.lineBetween(bx, by, hx, hy);
          g.fillStyle(0xfff4d0, 1);
          g.fillCircle(hx, hy, 4);
        },
        onComplete: () => {
          g.destroy();
          // Fire, a white heart, and a ring of the blast spreading.
          const fire = this.ui(this.scene.add.circle(tx, ty, 16, 0xff8a30, 0.95).setDepth(DEPTH_CINE - 11).setBlendMode(Phaser.BlendModes.ADD));
          const heart = this.ui(this.scene.add.circle(tx, ty, 8, 0xffffff, 1).setDepth(DEPTH_CINE - 10).setBlendMode(Phaser.BlendModes.ADD));
          const ring = this.ui(this.scene.add.circle(tx, ty, 18).setStrokeStyle(3, 0xffd890, 0.9).setDepth(DEPTH_CINE - 11));
          void this.tween({ targets: fire, scale: 4.2, alpha: 0, duration: 700, ease: "Cubic.easeOut", onComplete: () => fire.destroy() });
          void this.tween({ targets: heart, scale: 2.4, alpha: 0, duration: 260, ease: "Cubic.easeOut", onComplete: () => heart.destroy() });
          void this.tween({ targets: ring, scale: 6, alpha: 0, duration: 800, ease: "Cubic.easeOut", onComplete: () => ring.destroy() });
          const debris = this.ui(this.scene.add.particles(tx, ty, ensureDotTexture(this.scene), {
            speed: { min: 80, max: 260 }, angle: { min: 0, max: 360 }, gravityY: 240,
            lifespan: { min: 400, max: 900 }, scale: { start: 0.3, end: 0 },
            tint: [0xffe0a0, 0xff9a40, 0x6a5a50], blendMode: Phaser.BlendModes.ADD, emitting: false
          }).setDepth(DEPTH_CINE - 11));
          debris.explode(16);
          this.scene.time.delayedCall(1200, () => debris.destroy());
          this.flash(0xffc070, 0.12, 300);
          this.shake(220, 0.004);
        }
      });
      await this.wait(Phaser.Math.Between(240, 360));
    }
    await this.wait(500);
  }

  /** Light falls on `at` and a sword comes down point-first into the stone. */
  async swordSetDown(at: Pt): Promise<void> {
    if (this.skipped) return;
    const sq = this.host.groundSquash();
    const foot = { x: at.x, y: at.y + 30 };
    const beam = this.world(this.scene.add.graphics().setDepth(DEPTH.ATMOSPHERE).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
    beam.fillGradientStyle(0xffffff, 0xffffff, 0xfff4e0, 0xfff4e0, 0, 0, 0.5, 0.5);
    beam.fillRect(foot.x - 34, foot.y - 420, 68, 420);
    beam.fillStyle(0xfff8e8, 0.35);
    beam.fillEllipse(foot.x, foot.y, 120, 120 * sq);
    void this.tween({ targets: beam, alpha: 1, duration: 900 });
    await this.wait(500);
    const s = this.world(this.scene.add.graphics().setDepth(DEPTH.ATMOSPHERE + 1));
    s.fillStyle(0xd8dce4, 1);
    s.fillTriangle(-4, -8, 4, -8, 0, 4);      // the point
    s.fillRect(-4, -62, 8, 54);                // the blade
    s.fillStyle(0xffffff, 0.9);
    s.fillRect(-1, -62, 2, 52);                // its edge catching the light
    s.fillStyle(0x8a6a2a, 1);
    s.fillRect(-16, -68, 32, 6);               // crossguard
    s.fillStyle(0x3a2a1a, 1);
    s.fillRect(-3, -86, 6, 18);                // grip
    s.fillStyle(0xc9a24a, 1);
    s.fillCircle(0, -89, 4);                   // pommel
    s.setPosition(foot.x, foot.y - 300).setAlpha(0).setScale(1.7);
    void this.tween({ targets: s, alpha: 1, duration: 200 });
    await this.tween({ targets: s, y: foot.y, duration: 420, ease: "Cubic.easeIn" });
    sfxCineClang();
    this.shake(240, 0.004);
    groundDust(this.scene, (o) => this.world(o), foot.x, foot.y, { depth: DEPTH.ATMOSPHERE, count: 10, spread: 22, squash: this.host.groundSquash() });
    this.burst(foot, "white", 18, DEPTH.ATMOSPHERE + 2);
    await this.wait(1400);
    void this.tween({ targets: beam, alpha: 0, duration: 1500, onComplete: () => beam.destroy() });
    // The sword goes with the light: it is drawn at a fixed point, and the
    // board is about to turn out from under it.
    void this.tween({ targets: s, alpha: 0, duration: 1100, onComplete: () => s.destroy() });
  }

  /** The fall itself: ash and a rising soul (or only light, on mercy). */
  fall(at: Pt, gentle: boolean): void {
    if (this.skipped) return;
    if (!gentle) ashBurst(this.scene, (o) => this.world(o), at.x, at.y);
    soulWisp(this.scene, (o) => this.world(o), at.x, at.y, ensureDotTexture(this.scene));
  }

  // ---- the boss beats ------------------------------------------------------------

  /** Last words, written in the air over the shot, then gone. */
  async echo(text: string, ms = 2400, colour = "#ece2cc"): Promise<void> {
    if (this.skipped) return;
    const t = this.ui(this.scene.add.text(CX, BAR + 74, `“${text}”`, {
      fontFamily: FAMILY_BODY, fontSize: "29px", color: colour, fontStyle: "italic", align: "center",
      stroke: "#000", strokeThickness: 4, wordWrap: { width: 920 },
      shadow: { offsetX: 0, offsetY: 3, color: "#000", blur: 12, fill: true }
    }).setOrigin(0.5, 0).setDepth(DEPTH_CINE + 2).setAlpha(0));
    void this.tween({ targets: t, alpha: 1, y: t.y - 6, duration: 600, ease: "Sine.easeOut" });
    await this.wait(Math.max(ms, readMs(text)));
    await this.tween({ targets: t, alpha: 0, y: t.y - 16, duration: 500, onComplete: () => t.destroy() });
  }

  /** A dactyl's great shadow sweeping over the board, and the wind behind it. */
  async wingShadow(): Promise<void> {
    if (this.skipped) return;
    const g = this.ui(this.scene.add.graphics().setDepth(DEPTH_CINE - 18));
    g.fillStyle(0x05040a, 0.55);
    g.fillEllipse(0, 0, 150, 46);                              // body
    g.fillTriangle(-30, -6, 40, -6, -150, -150);               // far wing
    g.fillTriangle(-30, 6, 40, 6, -170, 120);                  // near wing
    g.fillTriangle(70, -10, 70, 10, 130, 0);                   // head
    g.fillTriangle(-70, -6, -70, 6, -150, 0);                  // tail
    g.setPosition(GAME_WIDTH + 260, GAME_HEIGHT * 0.75).setAngle(-18).setScale(1.6);
    sfxCineRise();
    void this.tween({ targets: g, scaleY: 1.1, duration: 260, yoyo: true, repeat: 3, ease: "Sine.easeInOut" });
    this.shake(900, 0.0025);
    await this.tween({ targets: g, x: -300, y: GAME_HEIGHT * 0.12, duration: 1500, ease: "Sine.easeIn" });
    g.destroy();
    const c = this.host.boardCentre();
    groundDust(this.scene, (o) => this.world(o), c.x, c.y, { depth: DEPTH.ATMOSPHERE, count: 14, spread: 160, squash: this.host.groundSquash() });
  }

  /** Mist rising where someone was, and nobody there when it clears. */
  vanish(at: Pt): void {
    if (this.skipped) return;
    const e = this.world(this.scene.add.particles(at.x, at.y, ensureDotTexture(this.scene), {
      x: { min: -40, max: 40 }, y: { min: -30, max: 10 },
      speedY: { min: -40, max: -12 }, speedX: { min: -24, max: 24 },
      lifespan: { min: 1600, max: 2600 }, scale: { start: 1.2, end: 3.2 },
      alpha: { start: 0.42, end: 0 }, tint: [0xe8eef4, 0xd0d8e0], emitting: false
    }).setDepth(DEPTH.ATMOSPHERE + 1));
    e.explode(36);
    this.scene.time.delayedCall(3000, () => e.destroy());
  }

  /** A name taken up by a crowd: rising from the ranks again and again. */
  async chant(word: string, times: number): Promise<void> {
    for (let i = 0; i < times && !this.skipped; i++) {
      const size = Phaser.Math.Between(22, 44);
      const t = this.ui(this.scene.add.text(Phaser.Math.Between(180, GAME_WIDTH - 180), Phaser.Math.Between(GAME_HEIGHT - BAR - 140, GAME_HEIGHT - BAR - 40), word, {
        fontFamily: FAMILY_HEADING, fontSize: `${size}px`, color: "#f4d999", stroke: "#120a04", strokeThickness: 4
      }).setOrigin(0.5).setDepth(DEPTH_CINE - 4).setAlpha(0).setLetterSpacing(4));
      sfxCineChime(0.9 + (i % 4) * 0.12);
      void this.tween({ targets: t, alpha: 0.95, duration: 220 });
      void this.tween({ targets: t, y: t.y - 90, alpha: 0, delay: 500, duration: 900, ease: "Sine.easeIn", onComplete: () => t.destroy() });
      await this.wait(170);
    }
    await this.wait(600);
  }

  /** A pillar of the Ravage's light over `at`, collapsing into it. */
  async beamCollapse(at: Pt): Promise<void> {
    if (this.skipped) return;
    const g = this.world(this.scene.add.graphics().setDepth(DEPTH.ATMOSPHERE + 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0));
    g.fillGradientStyle(0x7affd9, 0x7affd9, 0xc8fff0, 0xc8fff0, 0, 0, 0.75, 0.75);
    g.fillRect(-32, -620, 64, 620);
    g.setPosition(at.x, at.y + 20);
    sfxCineRise();
    await this.tween({ targets: g, alpha: 1, duration: 600 });
    await this.wait(500);
    sfxCineBell(0.45);
    await this.tween({ targets: g, scaleX: 0, duration: 260, ease: "Cubic.easeIn" });
    g.destroy();
    this.flash(0x7affd9, 0.45, 600);
    this.shake(320, 0.006);
    this.burst(at, "mint", 40, DEPTH.ATMOSPHERE + 2);
    await this.wait(700);
  }

  /** A glint of steel at `at` — a knife, catching the light once. */
  glint(at: Pt): void {
    if (this.skipped) return;
    const g = this.world(this.scene.add.graphics().setDepth(DEPTH.ATMOSPHERE + 2).setBlendMode(Phaser.BlendModes.ADD));
    g.fillStyle(0xffffff, 1);
    g.fillRect(-26, -1.5, 52, 3);
    g.fillRect(-1.5, -26, 3, 52);
    g.setPosition(at.x + 10, at.y - 34).setScale(0).setAngle(15);
    sfxCineChime(1.6);
    void this.tween({ targets: g, scale: 1, angle: 60, duration: 260, yoyo: true, ease: "Sine.easeOut", onComplete: () => g.destroy() });
  }

  /** Pages of a ledger, loose in the air. */
  pages(at: Pt): void {
    if (this.skipped) return;
    const key = "cine_page";
    if (!this.scene.textures.exists(key)) {
      const pg = this.scene.make.graphics({}, false);
      pg.fillStyle(0xf4ecd8, 1);
      pg.fillRect(0, 0, 10, 13);
      pg.fillStyle(0x8a7a62, 1);
      for (let y = 3; y < 12; y += 3) pg.fillRect(2, y, 6, 1);
      pg.generateTexture(key, 10, 13);
      pg.destroy();
    }
    const e = this.world(this.scene.add.particles(at.x, at.y - 20, key, {
      speed: { min: 50, max: 170 }, angle: { min: 200, max: 340 }, gravityY: 70,
      lifespan: { min: 1600, max: 2600 }, rotate: { min: -180, max: 180 }, scale: { min: 0.9, max: 1.4 },
      alpha: { start: 1, end: 0 }, emitting: false
    }).setDepth(DEPTH.ATMOSPHERE + 1));
    e.explode(22);
    this.scene.time.delayedCall(2800, () => e.destroy());
  }
}

// ---- the finales ------------------------------------------------------------

const amarOr = (c: Cine): Pt => c.host.unitPoint("amar") ?? c.host.boardCentre();
const lastFallen = (c: Cine, fallback: string): Pt =>
  (c.host.finalBlow && c.host.unitPoint(c.host.finalBlow.target)) || c.host.unitPoint(fallback) || c.host.boardCentre();
/**
 * The shot of the last blow: the one who struck it, standing over where
 * the other fell. (The fallen have faded by now — on their own the camera
 * found empty floor.)
 */
const lastBlowShot = (c: Cine, fallen: Pt): Pt => {
  const by = c.host.finalBlow ? c.host.unitPoint(c.host.finalBlow.attacker) : null;
  // A bow or a lens can finish it from across the board; then the shot is
  // the place it ended, where the beat happens, not the archer.
  if (!by || Math.hypot(by.x - fallen.x, by.y - fallen.y) > 130) return fallen;
  return { x: by.x * 0.55 + fallen.x * 0.45, y: by.y * 0.55 + fallen.y * 0.45 };
};

// B18 — the cutter sheers off, and the question Amar has carried since the
// hospital bed rises round him: seven names, in a slow ring, as the ship
// comes about under him.
const seventhChoice: FinaleScript = async (c) => {
  c.begin();
  sfxCineBoom();
  c.flash(0xffe8c0, 0.5, 600);
  c.grade("dusk", 0.55, 1400);
  await c.focus(amarOr(c), 1.75, 900);
  const names = await c.namesRing(amarOr(c), 300);
  await c.wait(1000);
  void c.fadeAway(names, 900);
  await c.focus(c.host.boardCentre(), 1.05, 1000);
  await c.orbit(1, 0.42);
  await c.title("Seven Names. One Choice.", "The path begins where the keel touches sand.", 2200);
};

// B19, exile — alone on the pass. The world drains to the cold, the snow
// comes in hard, and the names he carried come apart and blow away; the
// camera leaves him small in the white.
const longRoadNorth: FinaleScript = async (c) => {
  c.begin();
  c.grade("cold", 0.85, 1600);
  c.weather("snow", 9000);
  sfxCineRise();
  await c.focus(amarOr(c), 1.85, 1000);
  const names = await c.namesRing(amarOr(c), 160);
  await c.wait(900);
  await c.dissolve(names, 2000);
  await c.focus(amarOr(c), 0.92, 1600);
  await c.orbit(1, 0.36);
  await c.title("Alone Means Alone", "The names wear away. The one the empire hunts does not.", 2200, "#e4ecf4");
};

// B19, forgetting — the shore at dusk: the bounty men down at the
// waterline, gold light on the water, the board turning slowly out to sea.
const fishermansShore: FinaleScript = async (c) => {
  c.begin();
  c.grade("dusk", 0.5, 1600);
  c.rising("motes", 7000);
  await c.focus(amarOr(c), 1.7, 1000);
  await c.wait(900);
  await c.focus(c.host.boardCentre(), 1.08, 1200);
  await c.orbit(2, 0.4);
  await c.title("A Name That Is Not Amar", "Come morning, the sword stays. He goes out with the boat.", 2200);
};

// B28 — the last blow, the road's own answer to it, and then what every
// road shares: the grounded flagship's engines change pitch, its shadow
// lifts off the processional, and the light comes back over the squad.
interface PathEnd {
  boss: string;
  gentle: boolean;
  beat: (c: Cine, at: Pt) => Promise<void>;
  title: string;
  line: string;
}
const PATH_ENDS: Record<"vengeance" | "restoration" | "revolution" | "duty" | "mercy", PathEnd> = {
  vengeance: {
    boss: "archbold", gentle: false,
    beat: (c) => c.strikeName("Archbold"),
    title: "The Last Name",
    line: "The list ends on the marble where the kings of Grude were crowned."
  },
  restoration: {
    boss: "ravage_commander", gentle: false,
    beat: async (c) => {
      // Every bell in the city, one after another.
      for (const [i, p] of [1, 0.89, 0.75].entries()) {
        const at = i === 0 ? amarOr(c) : c.host.unitPoint(c.host.living("player")[i] ?? "amar") ?? amarOr(c);
        c.toll(at, p);
        await c.wait(900);
      }
      await c.wait(500);
    },
    title: "It Holds",
    line: "The slow work doesn't cheer. It just holds."
  },
  revolution: {
    boss: "dawn_boss", gentle: false,
    beat: (c, at) => c.crownShatters(at),
    title: "No Thrones",
    line: "On the marble where every crown in the west was set, nothing is set."
  },
  duty: {
    boss: "ravage_commander", gentle: false,
    beat: (c) => c.barrage(5),
    title: "The Order Held",
    line: "For once the report and the truth are the same document."
  },
  mercy: {
    boss: "archbold", gentle: true,
    beat: (c, at) => c.swordSetDown(at),
    title: "Steel Set Down",
    line: "The war ends with the sound of steel set down, not driven in."
  }
};

const pathEnds = (end: PathEnd): FinaleScript => async (c) => {
  const at = lastFallen(c, end.boss);
  c.begin();
  const shadow = c.shadow();
  sfxCineBoom();
  c.flash(0xffffff, end.gentle ? 0.45 : 0.6, 600);
  c.shake(420, end.gentle ? 0.003 : 0.008);
  c.fall(at, end.gentle);
  await c.focus(lastBlowShot(c, at), 1.6, 520);
  // Drained, not tinted: a red grade on the white processional read pink.
  c.grade("mono", end.gentle ? 0.55 : 0.85, 260);
  await c.wait(600);
  await end.beat(c, at);
  // The sky withdraws.
  c.grade("dawn", 0.4, 2200);
  c.rising("embers", 5200);
  void shadow.lift(2600);
  await c.focus(c.host.boardCentre(), 1.02, 1300);
  await c.orbit(1, 0.42);
  await c.title(end.title, end.line, 2200);
};

// B29 — a year on, a small job, done by mid-morning. The sun comes up over
// the field, the squad whoops, petals in the air, one last slow turn of the
// whole board.
const lastMorning: FinaleScript = async (c) => {
  c.begin();
  c.grade("dawn", 0.75, 1400);
  c.sunSweep(2600);
  for (const [i, p] of [1, 1.26, 1.5].entries()) c.host.scene.time.delayedCall(i * 160, () => sfxCineChime(p));
  const squad = c.host.living("player");
  const pts = squad.map((id) => c.host.unitPoint(id)).filter((p): p is Pt => !!p);
  const mid = pts.length ? { x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length } : c.host.boardCentre();
  await c.focus(mid, 1.45, 1000);
  c.weather("petals", 7000);
  await Promise.all(squad.map(async (id, i) => {
    await c.wait(i * 130);
    await c.host.hop(id, 9, 2);
  }));
  await c.wait(700);
  await c.focus(c.host.boardCentre(), 1.0, 1200);
  await c.orbit(1, 0.4);
  await c.title("One Last Morning", "Nobody said the word 'war' once.", 2200);
};

// ---- the boss fights ------------------------------------------------------------
//
// Every major boss fight closes on a beat of its own: the last blow, the
// fall (or the yield, or the escape), the words they leave in the air, one
// picture of what the fight meant, and the chapter's card.

interface BossEnd {
  boss: string;
  /** Walks away from it (yields, escapes, is carried off): no ash, no soul. */
  lives?: boolean;
  grade: Grade;
  /** The moment itself, after the blow lands. */
  beat?: (c: Cine, at: Pt) => Promise<void>;
  title: string;
  line: string;
  colour?: string;
}

const bossFalls = (end: BossEnd): FinaleScript => async (c) => {
  const at = lastFallen(c, end.boss);
  c.begin();
  sfxCineBoom();
  c.flash(0xffffff, end.lives ? 0.4 : 0.6, 600);
  c.shake(380, end.lives ? 0.003 : 0.007);
  if (!end.lives) c.fall(at, false);
  await c.focus(lastBlowShot(c, at), 1.65, 520);
  c.grade(end.grade, 0.7, 300);
  await c.wait(450);
  if (end.beat) await end.beat(c, at);
  await c.focus(c.host.boardCentre(), 1.04, 1200);
  await c.orbit(1, 0.45);
  await c.title(end.title, end.line, 2000, end.colour);
};

/** The squad cheering: everyone standing hops, a little out of step. */
const cheer = (c: Cine): void => {
  c.host.living("player").forEach((id, i) => c.host.scene.time.delayedCall(i * 120, () => { void c.host.hop(id, 8, 2); }));
};

const BOSS_ENDS: Record<string, (path: SevenPath | null) => BossEnd | null> = {
  b05_mountain_ndari: () => ({
    boss: "ndari", grade: "dusk",
    beat: async (c) => {
      // Ndara's dactyl, over the gate, and her question.
      await c.wingShadow();
      await c.echo("Ask your captain who he works for!");
    },
    title: "The Mountain Gate",
    line: "Ndari falls holding the gate. His sister gets away on the wind."
  }),
  b07_monastery: () => ({
    boss: "selene_enemy", lives: true, grade: "cold",
    beat: async (c, at) => {
      c.vanish(at);
      await c.echo("Don't follow me past the bell tower, Amar.");
    },
    title: "The Ghost from Para",
    line: "Selene goes over the balcony and into the mist. Amar says nothing."
  }),
  b11_cliffs: () => ({
    boss: "kian_enemy", grade: "dusk",
    beat: async (c) => {
      c.sunSweep(2800);
      await c.echo("Good half-step, your highness.", 2600);
      c.rising("motes", 4000);
    },
    title: "Good Half-Step",
    line: "Kian falls at sundown, on the stairs above Para Harbor."
  }),
  b13_dawn_rebellion: () => ({
    boss: "royal_captain", grade: "mono",
    beat: async (c) => {
      // For Rose: petals, and quiet.
      c.weather("petals", 6500);
      await c.wait(1800);
    },
    title: "Rose",
    line: "Four bolts. She held long enough for Dawn to understand.",
    colour: "#f2d0c8"
  }),
  b14_origin: () => ({
    boss: "imperial_knight", lives: true, grade: "cold",
    beat: (c) => c.echo("Welcome to the family, your highness."),
    title: "Welcome to the Family",
    line: "Lord Castor's guard carries him off. Upstairs, Dawn's sentence is still waiting."
  }),
  b15_inner_coup: () => ({
    boss: "turncoat", grade: "dusk",
    beat: async (c, at) => {
      c.pages(at);
      await c.echo("Six strides of bad luck.");
    },
    title: "Six Strides Short",
    line: "The man who sold Dawn's door had kept her books for nine years."
  }),
  b16_proposal: () => ({
    boss: "kings_knife", grade: "cold",
    beat: async (c, at) => {
      c.glint(at);
      await c.echo("Stop standing in the open.");
    },
    title: "The King's Knife",
    line: "Wren falls on the open bridge. Her hired knives melt away."
  }),
  b19_path_opener_vengeance: () => ({
    boss: "imperial_knight", grade: "mono",
    beat: (c) => c.strikeName("Castor"),
    title: "First Name",
    line: "One name crossed off the list. Maya keeps the ledger now."
  }),
  b19_path_opener_revolution: () => ({
    boss: "royal_captain", grade: "dusk",
    beat: async (c, at) => {
      c.flash(0xff9a40, 0.35, 900);
      c.burst(at, "embers", 50);
      c.rising("embers", 5200);
      await c.echo("Burn well.", 2000, "#ffd8a8");
    },
    title: "Burn Well",
    line: "The granary burns for the villages that grew it and never ate it."
  }),
  b19_path_opener_mercy: () => ({
    boss: "royal_captain", lives: true, grade: "dawn",
    beat: (c, at) => c.swordSetDown(at),
    title: "The Open Hand",
    line: "Nobody died who didn't have to. At the gate, Selene is watching."
  }),
  b20_dawn_war: () => ({
    boss: "imperial_general", grade: "dusk",
    beat: async (c) => {
      cheer(c);
      await c.chant("AMAR", 12);
    },
    title: "The Cheered Name",
    line: "Across the field, the rebels are cheering a name. It isn't Dawn's."
  }),
  b22_grude_burns: () => ({
    boss: "incendiary_captain", grade: "dusk",
    beat: async (c) => {
      // The last fires go out; morning comes up through the smoke.
      c.rising("embers", 2600);
      await c.wait(1200);
      c.grade("dawn", 0.6, 2000);
      c.sunSweep(2800);
      await c.wait(1500);
    },
    title: "The Held City",
    line: "What could be saved was saved, by hand, one corner at a time."
  }),
  b23_path_climax_a: (path) => path === "vengeance" ? {
    boss: "remnant_colonel", grade: "mono",
    beat: (c) => c.strikeName("Vasse"),
    title: "Another Name",
    line: "The list is getting shorter. So is the anger."
  } : path === "mercy" ? {
    boss: "remnant_colonel", lives: true, grade: "dawn",
    beat: (c, at) => c.swordSetDown(at),
    title: "The Yield",
    line: "Vasse sits against the canyon wall, alive. His men walk west, unarmed."
  } : {
    boss: "remnant_colonel", grade: "dusk",
    beat: async (c) => { c.rising("motes", 4000); await c.wait(1400); },
    title: "The Narrows",
    line: "The last fight with people is over. The east is still the wrong colour."
  },
  b24_path_climax_b: (path) => ({
    boss: path === "revolution" ? "dawn_loyalist" : "bell_warden", lives: true, grade: "dawn",
    beat: async (c) => {
      // The bell, rung at last, rolling out over every roof.
      const squad = c.host.living("player");
      for (const [i, p] of [1, 0.89, 0.75].entries()) {
        c.toll(c.host.unitPoint(squad[i] ?? "amar") ?? c.host.boardCentre(), p);
        await c.wait(950);
      }
    },
    title: "The Bell Before the Sky",
    line: "The bell rings for every roof in the west. Within the hour, the sky changes."
  }),
  b27_orbital_descent: () => ({
    boss: "ravage_herald", grade: "cold",
    beat: (c, at) => c.beamCollapse(at),
    title: "Measured",
    line: "The Herald came down to see what held the shore. Now it has seen.",
    colour: "#b8ffe8"
  })
};

/** Who a boss finale is about (the dev test route lands the last blow on them). */
export const finaleBoss = (battleId: string, path: SevenPath | null): string | null => {
  if (battleId === "b28_path_final") {
    return (path && path in PATH_ENDS ? PATH_ENDS[path as keyof typeof PATH_ENDS] : PATH_ENDS.restoration).boss;
  }
  return BOSS_ENDS[battleId]?.(path)?.boss ?? null;
};

/** The finale for a battle on a road, if it has one. */
export const finaleFor = (battleId: string, path: SevenPath | null): FinaleScript | null => {
  switch (battleId) {
    case "b18_path_chosen": return seventhChoice;
    case "b19_path_opener_exile": return longRoadNorth;
    case "b19_path_opener_forgetting": return fishermansShore;
    case "b29_epilogue": return lastMorning;
    case "b28_path_final": {
      const end = path && path in PATH_ENDS ? PATH_ENDS[path as keyof typeof PATH_ENDS] : PATH_ENDS.restoration;
      return pathEnds(end);
    }
    default: {
      const end = BOSS_ENDS[battleId]?.(path);
      return end ? bossFalls(end) : null;
    }
  }
};

/** Run a finale to its end (or to a skip). */
export const playFinale = async (host: FinaleHost, script: FinaleScript): Promise<void> => {
  const c = new Cine(host);
  const scene = host.scene;
  const skip = (): void => c.skip();
  // A beat before a skip can land, so the click that won the battle
  // doesn't also skip its finale.
  scene.time.delayedCall(700, () => {
    scene.input.on("pointerdown", skip);
    scene.input.keyboard?.on("keydown", skip);
  });
  try {
    await script(c);
  } finally {
    scene.input.off("pointerdown", skip);
    scene.input.keyboard?.off("keydown", skip);
  }
};
