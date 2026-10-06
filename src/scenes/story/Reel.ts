import Phaser from "phaser";
import type { ClassKind } from "../../combat/types";
import type { UnitAnimState } from "../../assets/manifest";
import { animKey, hasUnitAnimation } from "../../assets/animations";
import { FAMILY_BODY, FAMILY_DISPLAY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../../util/constants";
import { ensureDotTexture } from "../battle/Atmosphere";
import { classOf, ensureGlow } from "./figures";
import { sfxCineBoom, sfxCineClang } from "../../audio/Sfx";

// ─────────────────────────────────────────────────────────────────────────
// The reel — the toolkit the story's cinematics are made of (see
// Cinematics.ts). A cinematic is a short film over the story scene: Codex
// paintings drifting under a slow camera, the squad's own battle sprites
// acting on them, light and weather, and plain words on screen. Every
// object it makes is its own; when the film ends (or is skipped) they all
// go, and the story carries on underneath.
//
// After a skip every call returns at once and draws nothing, so a script
// simply runs out — the same contract as the battle finales (Finale.ts).
// ─────────────────────────────────────────────────────────────────────────

const W = GAME_WIDTH, H = GAME_HEIGHT;

/** Where the camera looks on a painting: its zoom over cover-fit, and the
 *  point (fractions of the painting) held at the middle of the screen. */
export interface Shot { zoom: number; x: number; y: number }

/** Layers inside the reel, above its base depth. */
export const Z = {
  BLACK: 0, PAINTING: 1, GRADE: 2, BACK_FX: 3, FIGURES: 5, FRONT_FX: 7, WEATHER: 8,
  FLASH: 9, BARS: 10, TEXT: 11, CHROME: 12
} as const;

/** A sprite on the reel: the squad's (or anyone's) battle sheet, acting. */
export class Fig {
  constructor(
    private readonly reel: Reel,
    readonly box: Phaser.GameObjects.Container,
    readonly sprite: Phaser.GameObjects.Sprite,
    readonly cls: string,
    private readonly rim?: Phaser.GameObjects.Sprite
  ) {}

  play(state: UnitAnimState): void {
    // A cut can take the figure away under a move still finishing.
    if (!this.sprite.active) return;
    if (hasUnitAnimation(this.cls as ClassKind, state)) this.sprite.play(animKey(this.cls as ClassKind, state), true);
  }

  face(left: boolean): void {
    this.sprite.setFlipX(left);
    this.rim?.setFlipX(left);
  }

  async walkTo(x: number, y: number, ms: number): Promise<void> {
    this.play("walk");
    await this.reel.tween({ targets: this.box, x, y, duration: ms, ease: "Linear" });
    this.play("idle");
  }

  /** One swing (or shot), then back to idle. */
  async strike(): Promise<void> {
    this.play("attack");
    await this.reel.wait(460);
    this.play("idle");
  }

  /** Falls, and fades. */
  async fall(): Promise<void> {
    this.play("death");
    await this.reel.wait(650);
    await this.reel.tween({ targets: this.box, alpha: 0, duration: 500 });
  }

  /** A hop in place. */
  hop(height = 8): void {
    void this.reel.tween({ targets: this.sprite, y: this.sprite.y - height, duration: 140, yoyo: true, ease: "Sine.easeOut" });
  }
}

export class Reel {
  skipped = false;
  private onSkip: (() => void)[] = [];
  private objs: Phaser.GameObjects.GameObject[] = [];
  private frames: (() => void)[] = [];
  /** The frame's furniture (black, bars) — kept across cuts. */
  private persist = new Set<Phaser.GameObjects.GameObject>();
  /** Tweens the reel started, stopped on a cut. */
  private live: Phaser.Tweens.Tween[] = [];
  private movers = new WeakMap<Phaser.GameObjects.GameObject, (to: Shot, ms: number) => Promise<void>>();
  /** Everything on the reel lives in one layer: one depth on the scene, one alpha. */
  readonly layer: Phaser.GameObjects.Layer;

  constructor(readonly scene: Phaser.Scene, readonly base: number) {
    this.layer = scene.add.layer().setDepth(base);
  }

  /** Run `cb` every frame until the reel is destroyed (keeps a ship on its painting). */
  onFrame(cb: () => void): void {
    this.frames.push(cb);
    this.scene.events.on(Phaser.Scenes.Events.UPDATE, cb);
    cb();
  }

  // ---- time --------------------------------------------------------------

  wait(ms: number): Promise<void> {
    if (this.skipped) return Promise.resolve();
    return new Promise((res) => {
      this.scene.time.delayedCall(ms, res);
      this.onSkip.push(res);
    });
  }

  tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    if (this.skipped) return Promise.resolve();
    return new Promise((res) => {
      const done = cfg.onComplete;
      this.live.push(this.scene.tweens.add({ ...cfg, onComplete: (...a: unknown[]) => { (done as ((...x: unknown[]) => void) | undefined)?.(...a); res(); } }));
      this.onSkip.push(res);
    });
  }

  skip(): void {
    if (this.skipped) return;
    this.skipped = true;
    for (const r of this.onSkip.splice(0)) r();
  }

  /** A cut: everything but the frame's furniture goes, ready for the next shot. */
  cut(): void {
    for (const cb of this.frames.splice(0)) this.scene.events.off(Phaser.Scenes.Events.UPDATE, cb);
    for (const tw of this.live.splice(0)) tw.remove();
    // Anything still waiting on the last shot is let go.
    for (const r of this.onSkip.splice(0)) r();
    const keep: Phaser.GameObjects.GameObject[] = [];
    for (const o of this.objs) {
      if (this.persist.has(o)) { keep.push(o); continue; }
      this.scene.tweens.killTweensOf(o);
      o.destroy();
    }
    this.objs = keep;
  }

  /** Everything the reel made, gone. */
  destroy(): void {
    for (const cb of this.frames.splice(0)) this.scene.events.off(Phaser.Scenes.Events.UPDATE, cb);
    for (const tw of this.live.splice(0)) tw.remove();
    for (const o of this.objs) {
      this.scene.tweens.killTweensOf(o);
      o.destroy();
    }
    this.objs = [];
    this.layer.destroy();
  }

  /** Keep `o` on the reel at layer `z` (see Z). */
  add<T extends Phaser.GameObjects.GameObject>(o: T, z: number): T {
    // Display objects join the layer; a mask's graphics stay off any list.
    if (o.displayList) this.layer.add(o);
    (o as unknown as { setDepth?: (d: number) => unknown }).setDepth?.(z);
    this.objs.push(o);
    return o;
  }

  // ---- the frame ---------------------------------------------------------

  black(): Phaser.GameObjects.Rectangle {
    const r = this.add(this.scene.add.rectangle(0, 0, W, H, 0x000000, 1).setOrigin(0, 0), Z.BLACK);
    this.persist.add(r);
    return r;
  }

  /** Cinema bars, and the scene's depth of field behind them. */
  letterbox(bar = 64): void {
    if (this.skipped) return;
    const top = this.add(this.scene.add.rectangle(0, 0, W, bar, 0x000000, 1).setOrigin(0, 0), Z.BARS);
    const bot = this.add(this.scene.add.rectangle(0, H, W, bar, 0x000000, 1).setOrigin(0, 1), Z.BARS);
    this.persist.add(top).add(bot);
  }

  /**
   * A painting, cover-fit, the camera drifting from `from` to `to` over
   * `ms` (a slow push-in, a pan along a coast). Fades in over `fade`.
   * Missing art (still streaming, or failed) falls back to `fallback`.
   */
  painting(key: string, from: Shot, to: Shot, ms: number, o: { fade?: number; fallback?: number; z?: number } = {}): Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle {
    const z = o.z ?? Z.PAINTING;
    if (!this.scene.textures.exists(key)) {
      const r = this.add(this.scene.add.rectangle(0, 0, W, H, o.fallback ?? 0x1a1c28, 1).setOrigin(0, 0), z);
      if (o.fade) { r.setAlpha(0); void this.tween({ targets: r, alpha: 1, duration: o.fade }); }
      return r;
    }
    this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const img = this.add(this.scene.add.image(W / 2, H / 2, key), z);
    const cam = { ...from };
    const apply = (): void => {
      const s = Math.max(W / img.width, H / img.height) * Math.max(1, cam.zoom);
      img.setScale(s);
      const dw = img.width * s, dh = img.height * s;
      const mx = (dw - W) / 2, my = (dh - H) / 2;
      img.setPosition(
        Phaser.Math.Clamp(W / 2 - (cam.x - 0.5) * dw, W / 2 - mx, W / 2 + mx),
        Phaser.Math.Clamp(H / 2 - (cam.y - 0.5) * dh, H / 2 - my, H / 2 + my)
      );
    };
    apply();
    const move = (t: Shot, d: number): Promise<void> => {
      for (const tw of this.scene.tweens.getTweensOf(cam)) tw.remove();
      return this.tween({ targets: cam, zoom: t.zoom, x: t.x, y: t.y, duration: d, ease: "Sine.easeInOut", onUpdate: () => { if (img.active) apply(); } });
    };
    this.movers.set(img, move);
    void move(to, ms);
    if (o.fade) { img.setAlpha(0); void this.tween({ targets: img, alpha: 1, duration: o.fade }); }
    return img;
  }

  /** Move the camera on a painting to a new shot. */
  pan(img: Phaser.GameObjects.GameObject, to: Shot, ms: number): Promise<void> {
    return this.movers.get(img)?.(to, ms) ?? Promise.resolve();
  }

  /** Where a painting's point (fractions) sits on screen right now. */
  static at(img: Phaser.GameObjects.Image, fx: number, fy: number): { x: number; y: number } {
    return {
      x: img.x + (fx - 0.5) * img.width * img.scaleX,
      y: img.y + (fy - 0.5) * img.height * img.scaleY
    };
  }

  /**
   * Colour over the whole frame: "multiply" darkens toward `colour` (night,
   * dusk), "add" lights it. Fades to `alpha` over `ms`.
   */
  grade(colour: number, alpha: number, ms: number, mode: "multiply" | "add" = "multiply", z: number = Z.GRADE): Phaser.GameObjects.Rectangle {
    const r = this.add(this.scene.add.rectangle(0, 0, W, H, colour, 1).setOrigin(0, 0)
      .setBlendMode(mode === "multiply" ? Phaser.BlendModes.MULTIPLY : Phaser.BlendModes.ADD).setAlpha(ms > 0 ? 0 : alpha), z);
    if (ms > 0) void this.tween({ targets: r, alpha, duration: ms });
    return r;
  }

  /** A soft light (sun, lantern, fire). */
  glow(x: number, y: number, tint: number, scale: number, alpha: number, z: number = Z.BACK_FX): Phaser.GameObjects.Image {
    return this.add(this.scene.add.image(x, y, ensureGlow(this.scene)).setTint(tint)
      .setBlendMode(Phaser.BlendModes.ADD).setScale(scale).setAlpha(alpha), z);
  }

  /** A painted object (the ship, the sky-ship). */
  object(key: string, x: number, y: number, scale: number, z: number = Z.FIGURES): Phaser.GameObjects.Image | null {
    if (!this.scene.textures.exists(key)) return null;
    this.scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
    return this.add(this.scene.add.image(x, y, key).setScale(scale), z);
  }

  /**
   * A figure at its feet: a character id from the roster (their current
   * sheet) or a class sheet ("spearton"). `dark` makes a backlit
   * silhouette with a rim of light down one side.
   */
  figure(who: string, x: number, y: number, o: { scale?: number; left?: boolean; tint?: number; dark?: number; rim?: number; rimAlpha?: number; z?: number } = {}): Fig {
    const cls = this.scene.textures.exists(`unit:${who}:idle`) ? who : classOf(this.scene, who);
    const tex = this.scene.textures.exists(`unit:${cls}:idle`) ? `unit:${cls}:idle` : cls;
    const scale = o.scale ?? 2.5;
    const k = scale / 5;
    const parts: Phaser.GameObjects.GameObject[] = [];
    parts.push(this.scene.add.ellipse(0, 2, 70 * k, 14 * k, 0x000000, 0.4));
    let rim: Phaser.GameObjects.Sprite | undefined;
    if (o.rim !== undefined) {
      rim = this.scene.add.sprite(o.left ? -1.5 : 1.5, 0, tex).setOrigin(0.5, 0.9).setScale(scale).setFlipX(!!o.left)
        .setTintFill(o.rim).setAlpha(o.rimAlpha ?? 0.55).setBlendMode(Phaser.BlendModes.ADD);
    }
    const sprite = this.scene.add.sprite(0, 0, tex).setOrigin(0.5, 0.9).setScale(scale).setFlipX(!!o.left);
    if (o.dark !== undefined) sprite.setTint(o.dark);
    else if (o.tint !== undefined) sprite.setTint(o.tint);
    if (rim) {
      parts.push(rim);
      const sync = (): void => { rim!.setTexture(sprite.texture.key, sprite.frame.name); };
      sprite.on(Phaser.Animations.Events.ANIMATION_START, sync);
      sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, sync);
    }
    parts.push(sprite);
    const box = this.add(this.scene.add.container(x, y, parts), (o.z ?? Z.FIGURES) + y / 10000);
    const fig = new Fig(this, box, sprite, cls, rim);
    fig.play("idle");
    return fig;
  }

  // ---- light and air -------------------------------------------------------

  flash(colour = 0xffffff, alpha = 0.8, ms = 450): void {
    if (this.skipped) return;
    const r = this.add(this.scene.add.rectangle(0, 0, W, H, colour, 1).setOrigin(0, 0).setAlpha(alpha).setBlendMode(Phaser.BlendModes.ADD), Z.FLASH);
    void this.tween({ targets: r, alpha: 0, duration: ms, ease: "Cubic.easeOut" });
  }

  shake(ms: number, intensity: number): void {
    if (this.skipped) return;
    this.scene.cameras.main.shake(ms, intensity);
  }

  /** Lightning: a jagged bolt in the sky, two flashes, and the thunder. */
  lightning(x = Phaser.Math.Between(200, W - 200)): void {
    if (this.skipped) return;
    const g = this.add(this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD), Z.BACK_FX);
    let px = x, py = 0;
    g.lineStyle(3, 0xe8f0ff, 1);
    g.beginPath();
    g.moveTo(px, py);
    while (py < H * 0.45) {
      px += Phaser.Math.Between(-36, 36);
      py += Phaser.Math.Between(26, 52);
      g.lineTo(px, py);
    }
    g.strokePath();
    this.flash(0xc8d8ff, 0.55, 160);
    this.scene.time.delayedCall(140, () => this.flash(0xe8f0ff, 0.4, 420));
    void this.tween({ targets: g, alpha: 0, delay: 120, duration: 360 });
    this.scene.time.delayedCall(220, () => { if (!this.skipped) sfxCineBoom(); });
  }

  /** Driving rain across the whole frame for `ms`. */
  rain(ms: number, density = 1): void {
    if (this.skipped) return;
    const e = this.add(this.scene.add.particles(0, 0, ensureDotTexture(this.scene), {
      x: { min: -100, max: W + 260 }, y: -20,
      speedX: { min: -260, max: -200 }, speedY: { min: 900, max: 1200 },
      lifespan: 900, scaleX: 0.08, scaleY: { min: 1.2, max: 2 },
      rotate: 13, alpha: { min: 0.2, max: 0.45 }, tint: 0xb8c8e8,
      frequency: 8 / density, quantity: 2
    }), Z.WEATHER);
    this.scene.time.delayedCall(ms, () => e.stop());
  }

  /** Embers rising over an area (x, y, w, h) for `ms`. */
  embers(area: { x: number; y: number; w: number; h: number }, ms: number, z: number = Z.FRONT_FX, rate = 40): void {
    if (this.skipped) return;
    const e = this.add(this.scene.add.particles(0, 0, ensureDotTexture(this.scene), {
      x: { min: area.x, max: area.x + area.w }, y: { min: area.y, max: area.y + area.h },
      speedY: { min: -110, max: -40 }, speedX: { min: -20, max: 30 },
      lifespan: { min: 1400, max: 2800 }, scale: { start: 0.32, end: 0 }, alpha: { start: 1, end: 0 },
      tint: [0xffd07a, 0xff9a40, 0xff6a2a], blendMode: Phaser.BlendModes.ADD, frequency: rate
    }), z);
    this.scene.time.delayedCall(ms, () => e.stop());
  }

  /** A column of smoke rising from (x, y). */
  smoke(x: number, y: number, ms: number, o: { width?: number; tint?: number; z?: number } = {}): Phaser.GameObjects.Particles.ParticleEmitter | null {
    if (this.skipped) return null;
    const e = this.add(this.scene.add.particles(x, y, ensureGlow(this.scene), {
      x: { min: -(o.width ?? 30), max: o.width ?? 30 },
      speedY: { min: -70, max: -36 }, speedX: { min: 8, max: 30 },
      lifespan: { min: 3400, max: 5200 }, scale: { start: 0.25, end: 1.1 },
      alpha: { start: 0.5, end: 0 }, tint: o.tint ?? 0x221a18, frequency: 140
    }), o.z ?? Z.BACK_FX);
    this.scene.time.delayedCall(ms, () => e.stop());
    return e;
  }

  /**
   * A fire at a moving point (`at` is read every frame, so it stays on a
   * drifting painting): a flickering glow, flames licking up, and smoke lit
   * from below. `size` 1 is a burning house seen from across a city.
   */
  fire(at: () => { x: number; y: number }, size: number, ms: number): void {
    if (this.skipped) return;
    const glow = this.glow(0, 0, 0xff6a20, 0.9 * size, 0, Z.BACK_FX);
    const core = this.glow(0, 0, 0xffd890, 0.22 * size, 0, Z.BACK_FX + 0.1);
    void this.tween({ targets: glow, alpha: 0.55, duration: 700 });
    void this.tween({ targets: core, alpha: 0.85, duration: 500 });
    void this.tween({ targets: glow, scaleX: 0.75 * size, scaleY: 1.05 * size, duration: 170, yoyo: true, repeat: -1, delay: 700, ease: "Sine.easeInOut" });
    const flames = this.add(this.scene.add.particles(0, 0, ensureDotTexture(this.scene), {
      x: { min: -14 * size, max: 14 * size }, speedY: { min: -120 * size, max: -50 * size }, speedX: { min: -12, max: 12 },
      lifespan: { min: 380, max: 820 }, scale: { start: 0.55 * size, end: 0 }, alpha: { start: 1, end: 0 },
      tint: [0xfff0b0, 0xffb040, 0xff6a20], blendMode: Phaser.BlendModes.ADD, frequency: 26
    }), Z.BACK_FX + 0.2);
    const smoke = this.add(this.scene.add.particles(0, 0, ensureGlow(this.scene), {
      x: { min: -18 * size, max: 18 * size }, speedY: { min: -60, max: -30 }, speedX: { min: 10, max: 32 },
      lifespan: { min: 3200, max: 5000 }, scale: { start: 0.18 * size, end: 0.9 * size },
      alpha: { start: 0.55, end: 0 }, tint: [0x6a4a3e, 0x4a3632, 0x7a5444], frequency: 170
    }), Z.BACK_FX - 0.1);
    this.onFrame(() => {
      const p = at();
      glow.setPosition(p.x, p.y);
      core.setPosition(p.x, p.y + 2);
      flames.setPosition(p.x, p.y);
      smoke.setPosition(p.x, p.y - 26 * size);
    });
    this.scene.time.delayedCall(ms, () => { flames.stop(); smoke.stop(); });
  }

  /** A blade's arc through the air at (x, y). */
  slash(x: number, y: number, flip = false): void {
    if (this.skipped) return;
    const g = this.add(this.scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setPosition(x, y), Z.FRONT_FX);
    const p = { v: 0 };
    const dir = flip ? -1 : 1;
    sfxCineClang();
    void this.tween({
      targets: p, v: 1, duration: 220, ease: "Cubic.easeOut",
      onUpdate: () => {
        g.clear();
        const a0 = -2.2, a1 = -2.2 + 2.6 * p.v;
        g.lineStyle(6 * (1 - p.v) + 2, 0xffffff, 1 - p.v * 0.6);
        g.beginPath();
        g.arc(0, 0, 46, a0, a1, false);
        g.strokePath();
        g.setScale(dir, 1);
      },
      onComplete: () => { void this.tween({ targets: g, alpha: 0, duration: 160 }); }
    });
  }

  // ---- words -----------------------------------------------------------------

  /**
   * A line of narration, alone on screen: fades in, holds, fades out.
   * Plain words, large; the story's own voice.
   */
  async narrate(text: string, hold: number, o: { y?: number; colour?: string; size?: number; boom?: boolean } = {}): Promise<void> {
    if (this.skipped) return;
    const t = this.add(this.scene.add.text(W / 2, o.y ?? H / 2, text, {
      fontFamily: FAMILY_BODY, fontSize: `${o.size ?? 32}px`, color: o.colour ?? "#ece2c8", fontStyle: "italic",
      align: "center", wordWrap: { width: W - 260 }, lineSpacing: 8,
      stroke: "#000", strokeThickness: 3, shadow: { offsetX: 0, offsetY: 3, color: "#000", blur: 10, fill: true }
    }).setOrigin(0.5).setAlpha(0), Z.TEXT);
    if (o.boom) sfxCineBoom();
    await this.tween({ targets: t, alpha: 1, duration: 500, ease: "Sine.easeOut" });
    await this.wait(hold);
    await this.tween({ targets: t, alpha: 0, duration: 350 });
    t.destroy();
  }

  /** A caption under the picture (in the lower bar's space), for `ms`. */
  caption(text: string, ms: number, top = false): void {
    if (this.skipped) return;
    const t = this.add(this.scene.add.text(W / 2, top ? 104 : H - 112, text, {
      fontFamily: FAMILY_BODY, fontSize: "25px", color: "#f3ecd9", align: "center",
      wordWrap: { width: W - 280 }, stroke: "#000", strokeThickness: 4,
      shadow: { offsetX: 0, offsetY: 2, color: "#000", blur: 8, fill: true }
    }).setOrigin(0.5, top ? 0 : 1).setAlpha(0), Z.TEXT);
    void this.tween({ targets: t, alpha: 1, duration: 500 });
    void this.tween({ targets: t, alpha: 0, delay: ms - 450, duration: 450, onComplete: () => t.destroy() });
  }

  /** A place card, lower left: "PARA" over "The King's palace, midnight". */
  place(title: string, sub: string, ms: number): void {
    if (this.skipped) return;
    const x = 80, y = H - 150;
    const rule = this.add(this.scene.add.rectangle(x, y + 4, 0, 2, 0xc9a24a, 0.9).setOrigin(0, 0.5), Z.TEXT);
    const t = this.add(this.scene.add.text(x, y, title.toUpperCase(), {
      fontFamily: FAMILY_HEADING, fontSize: "30px", color: "#f4d999", stroke: "#120a04", strokeThickness: 4
    }).setOrigin(0, 1).setLetterSpacing(8).setAlpha(0), Z.TEXT);
    const s = this.add(this.scene.add.text(x, y + 14, sub, {
      fontFamily: FAMILY_BODY, fontSize: "20px", color: "#e0d4b4", fontStyle: "italic", stroke: "#000", strokeThickness: 3
    }).setOrigin(0, 0).setAlpha(0), Z.TEXT);
    void this.tween({ targets: [t, s], alpha: 1, duration: 700 });
    void this.tween({ targets: rule, width: Math.max(260, t.width + 20), duration: 900, ease: "Cubic.easeOut" });
    void this.tween({ targets: [t, s, rule], alpha: 0, delay: ms - 600, duration: 600 });
  }

  /** The big title: slams in, the frame shakes, it holds. */
  async slam(main: string, sub: string | undefined, hold: number, colour = "#f4d999"): Promise<void> {
    if (this.skipped) return;
    const t = this.add(this.scene.add.text(W / 2, H / 2 - 20, main, {
      fontFamily: FAMILY_DISPLAY, fontSize: "62px", color: colour, stroke: "#120a04", strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 5, color: "#000", blur: 20, fill: true }
    }).setOrigin(0.5).setLetterSpacing(8).setScale(1.6).setAlpha(0), Z.TEXT);
    sfxCineBoom();
    void this.tween({ targets: t, scale: 1, alpha: 1, duration: 260, ease: "Cubic.easeIn" });
    await this.wait(240);
    this.shake(320, 0.006);
    this.flash(0xffe8c0, 0.3, 500);
    let s: Phaser.GameObjects.Text | undefined;
    if (sub) {
      s = this.add(this.scene.add.text(W / 2, H / 2 + 40, sub, {
        fontFamily: FAMILY_BODY, fontSize: "24px", color: "#ebdfc4", fontStyle: "italic", stroke: "#000", strokeThickness: 3
      }).setOrigin(0.5, 0).setAlpha(0), Z.TEXT);
      void this.tween({ targets: s, alpha: 1, delay: 300, duration: 700 });
    }
    await this.wait(hold);
    await this.tween({ targets: s ? [t, s] : t, alpha: 0, duration: 600 });
  }

  /**
   * A character card: a slanted band slides in with their portrait, their
   * name and a few words about them. Returns its parts for the exit.
   */
  nameplate(portrait: string | null, name: string, role: string, y: number, fromLeft: boolean): Phaser.GameObjects.GameObject[] {
    if (this.skipped) return [];
    const parts: Phaser.GameObjects.GameObject[] = [];
    const bandW = 760, bandH = 116;
    const x0 = fromLeft ? -bandW : W + bandW;
    const x1 = fromLeft ? 120 : W - 120 - bandW;
    const band = this.add(this.scene.add.graphics(), Z.TEXT - 0.5);
    band.fillStyle(0x0a0608, 0.88);
    band.fillPoints([
      new Phaser.Math.Vector2(30, 0), new Phaser.Math.Vector2(bandW, 0),
      new Phaser.Math.Vector2(bandW - 30, bandH), new Phaser.Math.Vector2(0, bandH)
    ], true);
    band.lineStyle(2, 0xc9a24a, 0.9);
    band.lineBetween(30, 0, bandW, 0);
    band.lineBetween(0, bandH, bandW - 30, bandH);
    band.setPosition(x0, y);
    parts.push(band);
    let face: Phaser.GameObjects.Image | undefined;
    if (portrait && this.scene.textures.exists(portrait)) {
      face = this.add(this.scene.add.image(0, 0, portrait), Z.TEXT);
      this.scene.textures.get(portrait).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const fs = Math.max(150 / face.width, 150 / face.height);
      face.setScale(fs).setOrigin(0.5, 0.18);
      // The face in a slanted window at the band's leading end.
      const m = this.add(this.scene.make.graphics({}, false), Z.TEXT);
      parts.push(face);
      face.setData("mask", m);
    }
    const n = this.add(this.scene.add.text(0, 0, name.toUpperCase(), {
      fontFamily: FAMILY_DISPLAY, fontSize: "46px", color: "#f4d999", stroke: "#120a04", strokeThickness: 6
    }).setOrigin(0, 0.5).setLetterSpacing(6), Z.TEXT);
    const r = this.add(this.scene.add.text(0, 0, role, {
      fontFamily: FAMILY_BODY, fontSize: "21px", color: "#e0d4b4", fontStyle: "italic"
    }).setOrigin(0, 0.5), Z.TEXT);
    parts.push(n, r);
    const place = (bx: number): void => {
      band.setPosition(bx, y);
      const faceX = bx + 110;
      if (face) {
        face.setPosition(faceX, y + 4);
        const m = face.getData("mask") as Phaser.GameObjects.Graphics;
        m.clear();
        m.fillStyle(0xffffff);
        m.fillPoints([
          new Phaser.Math.Vector2(bx + 50, y + 4), new Phaser.Math.Vector2(bx + 196, y + 4),
          new Phaser.Math.Vector2(bx + 170, y + bandH - 4), new Phaser.Math.Vector2(bx + 24, y + bandH - 4)
        ], true);
        if (!face.mask) face.setMask(m.createGeometryMask());
      }
      n.setPosition(bx + (face ? 220 : 60), y + 44);
      r.setPosition(bx + (face ? 224 : 64), y + 88);
    };
    const pos = { x: x0 };
    place(x0);
    sfxCineBoom();
    void this.tween({ targets: pos, x: x1, duration: 420, ease: "Cubic.easeOut", onUpdate: () => place(pos.x) });
    this.shake(160, 0.003);
    return parts;
  }

  /** Clear objects off the frame. */
  async clear(parts: Phaser.GameObjects.GameObject[], ms: number): Promise<void> {
    await Promise.all(parts.map((p) => this.tween({ targets: p, alpha: 0, duration: ms })));
    for (const p of parts) p.destroy();
  }

  /** Fade to black over `ms` (on top of the picture, under the words). */
  async fadeOut(ms: number): Promise<void> {
    const r = this.add(this.scene.add.rectangle(0, 0, W, H, 0x000000, 1).setOrigin(0, 0).setAlpha(0), Z.FLASH - 0.5);
    await this.tween({ targets: r, alpha: 1, duration: ms });
  }
}
