import Phaser from "phaser";
import type { Unit } from "../../combat/types";
import type { UnitAnimState } from "../../assets/manifest";
import { animKey, hasUnitAnimation } from "../../assets/animations";
import { resolveSpriteClass } from "../../art/UnitArt";
import { ensureDotTexture } from "../battle/Atmosphere";
import { FAMILY_HEADING } from "../../util/constants";
import { FIRE, type Slot } from "./layout";

// Life at the camp: the squad doing small things round the fire.
//
// A director that keeps one or two short scenes going at a time, each
// borrowing a few of the people standing round the fire and handing them
// back to their places when it ends:
//
//   chat       two neighbours turn to each other, step in, and talk
//   laugh      someone says something and the two beside them laugh
//   warm       someone walks up to the fire and warms their hands
//   errand     someone goes to the wagon (or the tent) and back
//   spar       two step out onto the grass and trade a few blows
//   glance     someone looks out at the dark for a moment
//   pop        the fire spits a burst of sparks; whoever's nearest jumps
//
// Everything is drawn with what the squad already has: the unit sheets'
// idle, walk, attack and hit loops, small hops, and speech bubbles over
// their heads. Positions are the characters' ground positions (`pos`) and
// a height off the ground (`lift`); CampScene puts the sprites, shadows
// and labels where those say every frame, so this module only ever moves
// the numbers.

export interface LifeChar {
  id: string;
  unit: Unit;
  sprite: Phaser.GameObjects.Sprite;
  /** The place round the fire this character returns to. */
  home: Slot;
  /** Feet on the ground, world px. */
  pos: { x: number; y: number };
  /** Height off the ground (a hop), world px. */
  lift: number;
  busy: boolean;
}

export interface CampLifeHost {
  readonly scene: Phaser.Scene;
  /** A world point → where it shows on screen, in UI px. */
  worldToUi(x: number, y: number): { x: number; y: number };
  /** Route an object made now to the flat UI camera only. */
  toUi<T extends Phaser.GameObjects.GameObject>(o: T): T;
  /** Route an object made now to the tilted world camera only. */
  toWorld<T extends Phaser.GameObjects.GameObject>(o: T): T;
  /** The fire flares for a moment (more light). */
  flare(): void;
}

type BubbleKind = "dots" | "!" | "?" | "ha" | "note";

interface Bubble {
  c: LifeChar;
  box: Phaser.GameObjects.Container;
}

interface Vignette {
  weight: number;
  /** Start the scene if its cast is free; null when it can't run now. */
  start(): Promise<void> | null;
}

/** Most scenes playing at once. */
const MAX_RUNNING = 2;
/** How far above the feet the top of a head is (64x80 sheets, foot origin 0.9). */
const HEAD = 70;

// Clear ground for the things that need room, on each side of the fire.
const SPAR_SPOTS = [
  { side: 1, a: { x: 892, y: 510 }, b: { x: 960, y: 510 } },
  { side: -1, a: { x: 296, y: 526 }, b: { x: 364, y: 526 } }
] as const;
const ERRANDS = [
  { side: 1, x: 950, y: 438, faceLeft: false },   // the wagon
  { side: -1, x: 352, y: 438, faceLeft: true }     // the tent
] as const;

export class CampLife {
  private readonly scene: Phaser.Scene;
  private bubbles: Bubble[] = [];
  private running = 0;
  private stopped = false;
  private readonly vignettes: Vignette[];

  constructor(private host: CampLifeHost, private chars: LifeChar[]) {
    this.scene = host.scene;
    this.vignettes = [
      { weight: 3, start: () => this.chat() },
      { weight: 1.6, start: () => this.laugh() },
      { weight: 2, start: () => this.warm() },
      { weight: 1.4, start: () => this.errand() },
      { weight: 1.1, start: () => this.spar() },
      { weight: 1.8, start: () => this.glance() },
      { weight: 0.8, start: () => this.pop() }
    ];
  }

  /** Begin, once the squad has faded in. */
  start(delayMs: number): void {
    this.scene.time.delayedCall(delayMs, () => this.next());
  }

  stop(): void {
    this.stopped = true;
  }

  /** Keep the speech bubbles over their speakers' heads. */
  update(): void {
    for (const b of this.bubbles) {
      const at = this.host.worldToUi(b.c.pos.x, b.c.pos.y - b.c.lift - HEAD);
      b.box.setPosition(at.x, at.y);
    }
  }

  // ---- The director ------------------------------------------------------

  private next(): void {
    if (this.stopped) return;
    if (this.running < MAX_RUNNING) this.begin();
    this.scene.time.delayedCall(Phaser.Math.Between(1400, 3200), () => this.next());
  }

  private begin(): void {
    // Weighted pick; anything that can't run now (its cast is busy) is
    // skipped and the next pick is tried.
    const pool = [...this.vignettes];
    while (pool.length) {
      const total = pool.reduce((s, v) => s + v.weight, 0);
      let r = Math.random() * total;
      let i = 0;
      while (r > pool[i]!.weight) { r -= pool[i]!.weight; i++; }
      const v = pool.splice(i, 1)[0]!;
      const run = v.start();
      if (!run) continue;
      this.running++;
      void run.finally(() => { this.running--; });
      return;
    }
  }

  private free(): LifeChar[] {
    return this.chars.filter((c) => !c.busy && c.sprite.active && c.sprite.alpha > 0.9);
  }

  private take(...cs: LifeChar[]): void {
    for (const c of cs) c.busy = true;
  }

  private async release(...cs: LifeChar[]): Promise<void> {
    await Promise.all(cs.map((c) => this.goHome(c)));
    for (const c of cs) c.busy = false;
  }

  private pickOne(filter: (c: LifeChar) => boolean = () => true): LifeChar | null {
    const f = this.free().filter(filter);
    return f.length ? f[Math.floor(Math.random() * f.length)]! : null;
  }

  /** The free character nearest `c`, within `range`. */
  private nearest(c: LifeChar, range: number, not: LifeChar[] = []): LifeChar | null {
    let best: LifeChar | null = null, bd = range;
    for (const o of this.free()) {
      if (o === c || not.includes(o)) continue;
      const d = Math.hypot(o.pos.x - c.pos.x, o.pos.y - c.pos.y);
      if (d < bd) { bd = d; best = o; }
    }
    return best;
  }

  // ---- The scenes ----------------------------------------------------------

  private chat(): Promise<void> | null {
    const a = this.pickOne();
    const b = a && this.nearest(a, 170);
    if (!a || !b) return null;
    this.take(a, b);
    return (async () => {
      // A step toward each other, then turned to talk.
      const mx = (a.pos.x + b.pos.x) / 2, my = (a.pos.y + b.pos.y) / 2;
      await Promise.all([this.stepToward(a, mx, my, 10), this.stepToward(b, mx, my, 10)]);
      this.faceTo(a, b.pos.x);
      this.faceTo(b, a.pos.x);
      const turns = Phaser.Math.Between(2, 4);
      for (let i = 0; i < turns; i++) {
        const [speaker, listener] = i % 2 === 0 ? [a, b] : [b, a];
        this.bubble(speaker, "dots", 1250);
        await this.wait(500);
        if (Math.random() < 0.6) void this.hop(listener, 1, 2); // a nod
        await this.wait(950);
      }
      if (Math.random() < 0.45) {
        // It ends on a laugh.
        this.bubble(a, "ha", 900);
        this.bubble(b, "ha", 900);
        await Promise.all([this.hop(a, 2, 3), this.hop(b, 2, 3)]);
        await this.wait(400);
      }
      await this.release(a, b);
    })();
  }

  private laugh(): Promise<void> | null {
    const teller = this.pickOne();
    const one = teller && this.nearest(teller, 200);
    const two = teller && one && this.nearest(teller, 220, [one]);
    if (!teller || !one) return null;
    const crowd = two ? [one, two] : [one];
    this.take(teller, ...crowd);
    return (async () => {
      for (const c of crowd) this.faceTo(c, teller.pos.x);
      this.bubble(teller, "!", 1100);
      await this.hop(teller, 1, 3);
      await this.wait(450);
      await Promise.all(crowd.map(async (c, i) => {
        await this.wait(i * 220);
        this.bubble(c, Math.random() < 0.5 ? "ha" : "note", 1100);
        await this.hop(c, 2, 4);
      }));
      await this.wait(500);
      await this.release(teller, ...crowd);
    })();
  }

  private warm(): Promise<void> | null {
    const c = this.pickOne();
    if (!c) return null;
    this.take(c);
    return (async () => {
      // Up to the fire's edge, stopping short of the stones.
      const dx = FIRE.x - c.pos.x, dy = FIRE.y - c.pos.y;
      const d = Math.hypot(dx, dy * 1.6);
      const keep = 104 / d;
      await this.walkTo(c, FIRE.x - dx * keep, FIRE.y - dy * keep);
      this.faceTo(c, FIRE.x);
      await this.wait(Phaser.Math.Between(1600, 2600));
      if (Math.random() < 0.35) { this.bubble(c, "note", 1000); await this.wait(1000); }
      await this.release(c);
    })();
  }

  private errand(): Promise<void> | null {
    const c = this.pickOne();
    if (!c) return null;
    const spot = ERRANDS.find((e) => Math.sign(c.home.x - FIRE.x) === e.side) ?? ERRANDS[0];
    this.take(c);
    return (async () => {
      await this.walkTo(c, spot.x + Phaser.Math.Between(-8, 8), spot.y);
      c.sprite.setFlipX(spot.faceLeft);
      // Rummaging.
      for (let i = 0; i < 3; i++) { await this.hop(c, 1, 2); await this.wait(260); }
      if (Math.random() < 0.5) this.bubble(c, Math.random() < 0.5 ? "?" : "dots", 1000);
      await this.wait(700);
      await this.release(c);
    })();
  }

  private spar(): Promise<void> | null {
    const fighters = this.free().filter((c) => this.hasState(c, "attack"));
    if (fighters.length < 2) return null;
    // Two from the same side of the fire, to the clear ground on that side.
    for (const spot of [...SPAR_SPOTS].sort(() => Math.random() - 0.5)) {
      const side = fighters.filter((c) => Math.sign(c.home.x - FIRE.x) === spot.side);
      if (side.length < 2) continue;
      const [a, b] = Phaser.Utils.Array.Shuffle([...side]).slice(0, 2) as [LifeChar, LifeChar];
      this.take(a, b);
      return (async () => {
        await Promise.all([this.walkTo(a, spot.a.x, spot.a.y), this.walkTo(b, spot.b.x, spot.b.y)]);
        this.faceTo(a, b.pos.x);
        this.faceTo(b, a.pos.x);
        await this.wait(350);
        const rounds = Phaser.Math.Between(2, 4);
        for (let i = 0; i < rounds; i++) {
          const [hit, struck] = i % 2 === 0 ? [a, b] : [b, a];
          await this.strike(hit, struck);
          await this.wait(Phaser.Math.Between(250, 480));
        }
        // A nod to each other, done.
        await Promise.all([this.hop(a, 1, 2), this.hop(b, 1, 2)]);
        await this.wait(300);
        await this.release(a, b);
      })();
    }
    return null;
  }

  private glance(): Promise<void> | null {
    const c = this.pickOne();
    if (!c) return null;
    this.take(c);
    return (async () => {
      c.sprite.setFlipX(!c.sprite.flipX);
      if (Math.random() < 0.3) this.bubble(c, "?", 900);
      await this.wait(Phaser.Math.Between(1400, 2400));
      c.sprite.setFlipX(c.home.faceLeft);
      await this.wait(300);
      c.busy = false;
    })();
  }

  private pop(): Promise<void> | null {
    const c = this.free().sort((p, q) =>
      Math.hypot(p.pos.x - FIRE.x, p.pos.y - FIRE.y) - Math.hypot(q.pos.x - FIRE.x, q.pos.y - FIRE.y))[0];
    if (!c || Math.hypot(c.pos.x - FIRE.x, c.pos.y - FIRE.y) > 260) return null;
    this.take(c);
    return (async () => {
      this.host.flare();
      const sparks = this.host.toWorld(this.scene.add.particles(FIRE.x, FIRE.y - 30, ensureDotTexture(this.scene), {
        speed: { min: 70, max: 170 },
        angle: { min: 225, max: 315 },
        gravityY: 160,
        lifespan: { min: 500, max: 1000 },
        scale: { start: 0.34, end: 0 },
        tint: [0xffe08a, 0xffa040],
        blendMode: Phaser.BlendModes.ADD,
        emitting: false
      }).setDepth(c.sprite.depth + 0.01));
      sparks.explode(20);
      this.scene.time.delayedCall(1200, () => sparks.destroy());
      await this.wait(120);
      this.faceTo(c, FIRE.x);
      void this.playOnce(c, "hit");
      this.bubble(c, "!", 900);
      await this.hop(c, 1, 5);
      // Somebody finds that funny.
      const other = this.nearest(c, 220);
      if (other && Math.random() < 0.6) {
        this.take(other);
        await this.wait(350);
        this.bubble(other, "ha", 900);
        await this.hop(other, 2, 3);
        other.busy = false;
      }
      await this.wait(500);
      await this.release(c);
    })();
  }

  // ---- Moves -------------------------------------------------------------------

  private cls(c: LifeChar) {
    return resolveSpriteClass(this.scene, c.unit);
  }

  private hasState(c: LifeChar, state: UnitAnimState): boolean {
    return hasUnitAnimation(this.cls(c), state);
  }

  private play(c: LifeChar, state: UnitAnimState): void {
    if (!this.hasState(c, state) || !c.sprite.active) return;
    if (state === "idle") {
      c.sprite.play({ key: animKey(this.cls(c), "idle"), startFrame: Math.floor(Math.random() * 2), timeScale: 0.85 + Math.random() * 0.3 });
    } else {
      c.sprite.play(animKey(this.cls(c), state), true);
    }
  }

  /** One pass of a one-shot sheet (attack, hit), then back to idle. */
  private playOnce(c: LifeChar, state: UnitAnimState): Promise<void> {
    if (!this.hasState(c, state)) return this.wait(300);
    const key = animKey(this.cls(c), state);
    return new Promise((resolve) => {
      c.sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE_KEY + key, () => {
        this.play(c, "idle");
        resolve();
      });
      c.sprite.play(key, true);
    });
  }

  private faceTo(c: LifeChar, x: number): void {
    if (Math.abs(x - c.pos.x) > 1) c.sprite.setFlipX(x < c.pos.x);
  }

  private walkTo(c: LifeChar, x: number, y: number, speed = 66): Promise<void> {
    const d = Math.hypot(x - c.pos.x, y - c.pos.y);
    if (d < 2) return Promise.resolve();
    this.faceTo(c, x);
    this.play(c, "walk");
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: c.pos,
        x,
        y,
        duration: (d / speed) * 1000,
        ease: "Linear",
        onComplete: () => { this.play(c, "idle"); resolve(); }
      });
    });
  }

  private stepToward(c: LifeChar, x: number, y: number, by: number): Promise<void> {
    const d = Math.hypot(x - c.pos.x, y - c.pos.y);
    if (d <= by) return Promise.resolve();
    return this.walkTo(c, c.pos.x + ((x - c.pos.x) / d) * by, c.pos.y + ((y - c.pos.y) / d) * by, 40);
  }

  private async goHome(c: LifeChar): Promise<void> {
    await this.walkTo(c, c.home.x, c.home.y);
    c.sprite.setFlipX(c.home.faceLeft);
  }

  private hop(c: LifeChar, times: number, height: number): Promise<void> {
    return new Promise((resolve) => {
      this.scene.tweens.add({
        targets: c,
        lift: height,
        duration: 110,
        yoyo: true,
        repeat: times - 1,
        ease: "Sine.easeOut",
        onComplete: () => { c.lift = 0; resolve(); }
      });
    });
  }

  /** A swing with a lunge; the other flinches as it lands. */
  private async strike(a: LifeChar, b: LifeChar): Promise<void> {
    const dir = Math.sign(b.pos.x - a.pos.x) || 1;
    const x0 = a.pos.x;
    this.scene.tweens.add({ targets: a.pos, x: x0 + dir * 9, duration: 170, yoyo: true, ease: "Sine.easeOut" });
    const swing = this.playOnce(a, "attack");
    await this.wait(230);
    // Steel on steel: a small spark between them.
    const sx = (a.pos.x + b.pos.x) / 2, sy = (a.pos.y + b.pos.y) / 2 - 36;
    const spark = this.host.toWorld(this.scene.add.particles(sx, sy, ensureDotTexture(this.scene), {
      speed: { min: 40, max: 110 },
      lifespan: { min: 180, max: 360 },
      scale: { start: 0.26, end: 0 },
      tint: [0xfff4c0, 0xffc860],
      blendMode: Phaser.BlendModes.ADD,
      emitting: false
    }).setDepth(Math.max(a.sprite.depth, b.sprite.depth) + 0.01));
    spark.explode(9);
    this.scene.time.delayedCall(500, () => spark.destroy());
    const b0 = b.pos.x;
    this.scene.tweens.add({ targets: b.pos, x: b0 + dir * 4, duration: 90, yoyo: true, ease: "Sine.easeOut" });
    await Promise.all([swing, this.playOnce(b, "hit")]);
    a.pos.x = x0;
    b.pos.x = b0;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => { this.scene.time.delayedCall(ms, resolve); });
  }

  // ---- Speech bubbles ------------------------------------------------------------

  private bubble(c: LifeChar, kind: BubbleKind, ms: number): void {
    for (const old of this.bubbles.filter((b) => b.c === c)) this.dropBubble(old);
    const W = kind === "ha" ? 34 : 28, H = 20;
    const g = this.scene.add.graphics();
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-W / 2 + 1, -H - 6 + 2, W, H, 6);
    g.fillStyle(0xf6ecd2, 0.96);
    g.fillRoundedRect(-W / 2, -H - 6, W, H, 6);
    g.fillTriangle(-4, -7, 4, -7, 0, 0);
    g.lineStyle(1, 0x3a2a18, 0.8);
    g.strokeRoundedRect(-W / 2 + 0.5, -H - 5.5, W - 1, H - 1, 6);
    const parts: Phaser.GameObjects.GameObject[] = [g];
    const cy = -6 - H / 2;
    if (kind === "dots") {
      for (let i = 0; i < 3; i++) {
        const d = this.scene.add.circle(-7 + i * 7, cy, 2.2, 0x3a2a18);
        parts.push(d);
        this.scene.tweens.add({ targets: d, alpha: { from: 0.25, to: 1 }, duration: 320, delay: i * 140, yoyo: true, repeat: -1 });
      }
    } else if (kind === "note") {
      const n = this.scene.add.graphics();
      n.fillStyle(0x3a2a18, 1);
      n.fillEllipse(-3, cy + 4, 7, 5);
      n.fillRect(0, cy - 6, 1.6, 10);
      n.fillTriangle(1.6, cy - 6, 6, cy - 3, 1.6, cy - 2);
      parts.push(n);
    } else {
      parts.push(this.scene.add.text(0, cy, kind === "ha" ? "ha!" : kind, {
        fontFamily: FAMILY_HEADING,
        fontSize: "13px",
        color: "#3a2a18",
        fontStyle: "bold"
      }).setOrigin(0.5));
    }
    const box = this.host.toUi(this.scene.add.container(0, 0, parts).setDepth(60).setScale(0.2).setAlpha(0));
    const b: Bubble = { c, box };
    this.bubbles.push(b);
    this.update();
    this.scene.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 170, ease: "Back.easeOut" });
    this.scene.time.delayedCall(ms, () => this.dropBubble(b));
  }

  private dropBubble(b: Bubble): void {
    const i = this.bubbles.indexOf(b);
    if (i < 0) return;
    this.bubbles.splice(i, 1);
    this.scene.tweens.add({
      targets: b.box,
      alpha: 0,
      y: b.box.y - 6,
      duration: 160,
      onComplete: () => b.box.destroy()
    });
  }
}
