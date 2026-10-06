import Phaser from "phaser";
import { FAMILY_BODY, FAMILY_DISPLAY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE } from "../util/constants";
import { getMusic, MUSIC } from "../audio/Music";
import { drawPanel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { CtaButton } from "../ui/CtaButton";
import { PLAYERS } from "../data/units";
import { fallenCharacters, fallenIds, getActiveSquadIds, ROSTER_ORDER } from "../data/activeRoster";
import { loadSave, MAX_PERMITTED_DEATHS } from "../util/save";
import { sfxClick } from "../audio/Sfx";
import { SettingsButton } from "../ui/SettingsButton";
import { ensureUnitTexture, resolveSpriteClass } from "../art/UnitArt";
import { createUnit } from "../combat/Unit";
import type { Tile, UnitDef } from "../combat/types";
import { resolveCampBeat } from "../data/campTalk";
import { ROMANCE_FLAG } from "../data/romance";
import { resolveNextChapter } from "../data/nextChapter";
import type { BattleNode } from "../data/battles";
import { animKey, hasUnitAnimation } from "../assets/animations";
import { buildDiorama } from "./battle/Diorama";
import { ObliqueProjection } from "../render/ObliqueProjection";
import { applyCinematicFX } from "../art/CinematicFX";
import { attachPostPipeline } from "../render/postPipelines";
import { PERSPECTIVE_PIPELINE, PerspectivePipeline } from "../render/PerspectivePipeline";
import { screenToSource, sourceToScreen, type KeystoneParams } from "../render/keystone";
import { DEPTH, actorDepth } from "../render/depth";
import { castFrom, torchShadow, UNIT_FOOT_ORIGIN } from "../render/sun";
import { bodyCentre, figureAt } from "./battle/HitMask";
import { ensureDotTexture } from "./battle/Atmosphere";
import { ART_SCALE, CAMP_BOARD, CAMP_KEYSTONE_K, FIRE, ringSlots, type Slot } from "./camp/layout";
import type { CampBackdropScene } from "./CampBackdropScene";
import { CampLife, type LifeChar } from "./camp/CampLife";

// CampScene — the squad's home between battles, as a diorama.
//
// The camp is built the way the battle board is: a slab of ground made by
// the battle's own diorama builder (scenes/battle/Diorama), seen through
// the same keystone tilt and bloom, with the painted night in a scene of
// its own underneath (CampBackdropScene). On it, everything stands up as
// a billboard sorted by its foot: the squad in a ring round the fire, the
// wagon, a tent, crates, log benches, a lantern post, pines along the
// back. The fire is the only real light. A darkness layer covers the
// board and the fire and lantern cut pools out of it; everything near
// the fire is warmed by it and throws its shadow away from it. The squad
// doesn't stand still: camp/CampLife keeps a couple of small scenes going
// (chats, a laugh, someone warming their hands, an errand to the wagon, a
// sparring pair), moving each character's ground position, which this
// scene turns into sprite, shadow, label and depth every frame.
//
// Two cameras, as in BattleScene: the world camera carries the tilt and
// the grade; the UI camera draws the text and buttons flat and sharp on
// top. Because the world is tilted, nothing in it is a Phaser interactive
// object — pointers are run back through the keystone math and tested
// against what is actually drawn (the sprites' pixel masks).
//
// What the camp does is unchanged: talk to anyone at the fire, open the
// wagon (inventory), the roster, the memorial when someone has fallen,
// back to the title or out to the map. New: "Start Next Chapter", which
// opens battle prep for the chapter the story is leading to. Between
// chapters the story now returns the squad here (see StoryScene) rather
// than dropping them straight into prep, so this is where every chapter
// starts.

export interface CampArgs {
  /** Set when the story has just brought the squad here on the way to a battle. */
  nextChapter?: string;
}

interface CampChar extends LifeChar {
  label: Phaser.GameObjects.Text;
  contact: Phaser.GameObjects.Ellipse;
}

/** Something under the pointer that does something when clicked. */
interface Pickable {
  imgs: (Phaser.GameObjects.Sprite | Phaser.GameObjects.Image)[];
  kind: "char" | "prop";
  label?: Phaser.GameObjects.Text;
  onClick: () => void;
}

/** A billboard throwing the fire's shadow. */
interface Caster {
  src: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  cast: Phaser.GameObjects.Image;
  /** Where its feet are, if it can leave the ground (a hop shouldn't lift its shadow). */
  ground?: { x: number; y: number };
}

/** Everything the camp draws; the camp waits for these if they are still streaming in. */
const CAMP_ART = [
  "camp:flames", "camp:firepit", "camp:wagon", "camp:tent", "camp:log",
  "camp:crates", "camp:lantern", "camp:pine", "camp:memorial", "backdrop:camp_sky"
];

const LANTERN = { x: 418, y: 446 } as const;
const LIGHT_BRUSH = "camp_light_brush";
const OUTLINE_OFFSETS: readonly [number, number][] = [[-ART_SCALE, 0], [ART_SCALE, 0], [0, -ART_SCALE], [0, ART_SCALE]];

export class CampScene extends Phaser.Scene {
  private args: CampArgs = {};
  private uiCamera?: Phaser.Cameras.Scene2D.Camera;
  private keystone: KeystoneParams | null = null;
  private chars: CampChar[] = [];
  private picks: Pickable[] = [];
  private casters: Caster[] = [];
  private hovered: Pickable | null = null;
  private outline: Phaser.GameObjects.Image[] = [];
  private darkness?: Phaser.GameObjects.RenderTexture;
  private brush?: Phaser.GameObjects.Image;
  private flameLights: { x: number; y: number; radius: number }[] = [];
  private flames?: Phaser.GameObjects.Sprite;
  private propLabels: { text: Phaser.GameObjects.Text; x: number; y: number }[] = [];
  /** Made while the world is built, but drawn flat by the UI camera (the name labels). */
  private uiBorn: Phaser.GameObjects.GameObject[] = [];
  private pointerAt: { x: number; y: number } | null = null;
  private leaving = false;
  /** A panel is open over the camp; the board doesn't answer the pointer. */
  private modal = false;
  private restartWhenResumed = false;
  private life?: CampLife;
  /** When the fire last flared (a log settling), scene time. */
  private flaredAt = Number.NEGATIVE_INFINITY;

  constructor() { super("CampScene"); }

  init(data: CampArgs): void {
    this.args = data ?? {};
    this.chars = [];
    this.picks = [];
    this.casters = [];
    this.hovered = null;
    this.outline = [];
    this.flameLights = [];
    this.propLabels = [];
    this.uiBorn = [];
    this.pointerAt = null;
    this.leaving = false;
    this.modal = false;
    this.restartWhenResumed = false;
    this.uiCamera = undefined;
    this.keystone = null;
    this.darkness = undefined;
    this.brush = undefined;
    this.flames = undefined;
    this.life = undefined;
    this.flaredAt = Number.NEGATIVE_INFINITY;
  }

  create(): void {
    const save = loadSave();
    this.scene.launch("CampBackdropScene");

    // ---- World ------------------------------------------------------------
    this.buildBoard();
    this.buildFire();
    this.buildProps(() => this.openWagon());
    const fallen = fallenCharacters(save.completedBattles);
    if (fallen.length > 0) this.buildMemorial(fallen);
    const squad = this.activeSquadIds(save.completedBattles);
    const slots = ringSlots(squad.length);
    squad.forEach((id, i) => {
      const slot = slots[i];
      if (slot) this.buildCharacter(id, slot, 300 + i * 110);
    });
    this.buildDarkness();
    const worldSet = new Set<Phaser.GameObjects.GameObject>(this.children.getChildren());
    for (const o of this.uiBorn) worldSet.delete(o);

    // ---- UI ---------------------------------------------------------------
    this.buildInfo(squad.length);
    this.buildButtons(resolveNextChapter(save));
    new SettingsButton(this, GAME_WIDTH - 32, 32);

    this.setupCameras(worldSet);
    this.setupInput();

    getMusic(this).play(MUSIC.everydayLife, { fadeMs: 1000 });
    // The camera settles onto the camp as it fades in.
    this.cameras.main.setScroll(0, 26);
    this.cameras.main.fadeIn(500, 0, 0, 0);
    this.uiCamera?.fadeIn(500, 0, 0, 0);
    this.backdrop()?.fade(false, 500);

    const onResume = (): void => {
      if (this.restartWhenResumed) this.scene.restart(this.args);
    };
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    // The squad comes alive once it has gathered.
    this.life = new CampLife({
      scene: this,
      worldToUi: (x, y) => this.worldToUi(x, y),
      toUi: (o) => this.ui(o),
      toWorld: (o) => { this.uiCamera?.ignore(o); return o; },
      flare: () => this.flare()
    }, this.chars);
    this.life.start(300 + squad.length * 110 + 1400);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      // Scene events outlive shutdown; the camp is entered many times.
      this.events.off(Phaser.Scenes.Events.RESUME, onResume);
      this.life?.stop();
      this.input.setDefaultCursor("default");
      this.scene.stop("CampBackdropScene");
    });
    this.waitForArt();
  }

  update(time: number): void {
    const cam = this.cameras.main;
    // Drift toward the pointer: a few pixels of parallax between the board
    // and the sky behind it, so the camp reads as a place with depth.
    const p = this.pointerAt;
    const tx = p ? ((p.x / RENDER_SCALE - GAME_WIDTH / 2) / (GAME_WIDTH / 2)) * 12 : 0;
    const ty = p ? ((p.y / RENDER_SCALE - GAME_HEIGHT / 2) / (GAME_HEIGHT / 2)) * 6 : 0;
    cam.setScroll(cam.scrollX + (tx - cam.scrollX) * 0.05, cam.scrollY + (ty - cam.scrollY) * 0.05);
    this.backdrop()?.follow(cam.scrollX, cam.scrollY);

    const sinceFlare = time - this.flaredAt;
    const flare = sinceFlare < 700 ? 0.16 * (1 - sinceFlare / 700) : 0;
    const flicker = (1 + 0.035 * Math.sin(time * 0.011) + 0.02 * Math.sin(time * 0.027 + 1.3) + 0.015 * Math.sin(time * 0.061 + 0.4)) * (1 + flare);
    // The squad stand (and walk, and hop) where CampLife says.
    for (const c of this.chars) {
      c.sprite.setPosition(c.pos.x, c.pos.y - c.lift).setDepth(actorDepth(c.pos.y)).setTint(this.warmth(c.pos.x, c.pos.y));
      c.contact.setPosition(c.pos.x, c.pos.y + 1);
      const at = this.worldToUi(c.pos.x, c.pos.y + 4);
      c.label.setPosition(at.x, at.y).setAlpha(c.sprite.alpha);
    }
    this.paintDarkness(flicker);
    for (const c of this.casters) this.castShadow(c, flicker);
    this.life?.update();
    for (const l of this.propLabels) {
      const at = this.worldToUi(l.x, l.y);
      l.text.setPosition(at.x, at.y);
    }
    if (p) this.setHover(this.pickAt(p.x, p.y));
    this.syncOutline();
  }

  // ---- The board ------------------------------------------------------------

  private buildBoard(): void {
    const B = CAMP_BOARD;
    // A shelf of raised ground in each back corner, where the pines stand:
    // the board's earth shows in its walls, as it does on the battle board.
    const elevationAt = (x: number, y: number): number => {
      if (y === 0) return x <= 5 || x >= B.cols - 6 ? 1 : 0;
      if (y === 1) return x <= 2 || x >= B.cols - 3 ? 1 : 0;
      return 0;
    };
    const tiles: Tile[][] = [];
    for (let y = 0; y < B.rows; y++) {
      const row: Tile[] = [];
      for (let x = 0; x < B.cols; x++) {
        row.push({
          pos: { x, y },
          terrain: y === 0 || elevationAt(x, y) > 0 ? "forest" : "grass",
          obstacle: "none",
          defendBonus: 1,
          blocksMovement: false,
          blocksLineOfSight: false,
          hitPenalty: 0
        });
      }
      tiles.push(row);
    }
    const projection = new ObliqueProjection({
      originX: B.originX,
      originY: B.originY,
      tileW: B.tileW,
      tileH: B.tileH,
      elevStep: B.elevStep,
      slabDepth: B.slabDepth,
      gridWidth: B.cols,
      gridHeight: B.rows,
      elevationAt
    });
    buildDiorama(this, {
      width: B.cols,
      height: B.rows,
      tileAt: (p) => tiles[p.y]![p.x]!
    }, projection, {
      footDY: 0,
      seed: 31,
      elevationAt,
      elevStep: B.elevStep,
      gridLines: false
    });

    // The trampled clearing round the fire: the board's own dirt, feathered
    // into the grass so it reads as worn ground, not a square of tiles.
    const clearing = this.ensureClearingTexture();
    this.add.image(FIRE.x, FIRE.y + 8, clearing).setDepth(DEPTH.TERRAIN_FX).setAlpha(0.92);

    // The far edge sinks into the night before it meets the treeline.
    const fog = this.add.graphics().setDepth(DEPTH.GROUND_OVERLAY);
    fog.fillGradientStyle(0x050a18, 0x050a18, 0x050a18, 0x050a18, 0.6, 0.6, 0, 0);
    fog.fillRect(B.originX, B.originY - B.elevStep, B.cols * B.tileW, B.tileH * 2.2);
  }

  private ensureClearingTexture(): string {
    const key = "camp_clearing";
    if (this.textures.exists(key)) return key;
    const W = 640, H = 280;
    const tex = this.textures.createCanvas(key, W, H);
    if (!tex) return key;
    const ctx = tex.getContext();
    const dirt = this.textures.exists("tile:dirt")
      ? this.textures.get("tile:dirt").getSourceImage() as HTMLImageElement
      : null;
    if (dirt && dirt.width) {
      // One board tile of dirt, foreshortened like the board's, repeated.
      const cell = document.createElement("canvas");
      cell.width = CAMP_BOARD.tileW;
      cell.height = CAMP_BOARD.tileH;
      cell.getContext("2d")!.drawImage(dirt, 0, 0, cell.width, cell.height);
      ctx.fillStyle = ctx.createPattern(cell, "repeat") ?? "#5a4632";
    } else {
      ctx.fillStyle = "#5a4632";
    }
    ctx.fillRect(0, 0, W, H);
    // Feather it to an ellipse.
    ctx.globalCompositeOperation = "destination-in";
    ctx.save();
    ctx.translate(W / 2, H / 2);
    ctx.scale(1, H / W);
    const g = ctx.createRadialGradient(0, 0, W * 0.16, 0, 0, W / 2);
    g.addColorStop(0, "rgba(0,0,0,1)");
    g.addColorStop(0.62, "rgba(0,0,0,0.75)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-W / 2, -W / 2, W, W);
    ctx.restore();
    ctx.globalCompositeOperation = "source-over";
    tex.refresh();
    return key;
  }

  // ---- The fire ---------------------------------------------------------------

  private buildFire(): void {
    const fx = FIRE.x, fy = FIRE.y;
    this.flameLights.push({ x: fx, y: fy, radius: FIRE.radius });
    // Light on the ground: a wide warm pool and a hot heart.
    this.glow(fx, fy + 6, 560, 260, 0.42, DEPTH.LIGHT);
    this.glow(fx, fy + 4, 220, 100, 0.62, DEPTH.LIGHT);

    if (this.textures.exists("camp:firepit")) {
      this.add.image(fx, fy, "camp:firepit")
        .setOrigin(0.5, 0.62)
        .setScale(ART_SCALE)
        .setDepth(actorDepth(fy - 14));
    }
    if (this.textures.exists("camp:flames")) {
      if (!this.anims.exists("camp_flames")) {
        this.anims.create({
          key: "camp_flames",
          frames: this.anims.generateFrameNumbers("camp:flames", { start: 0, end: 7 }),
          frameRate: 11,
          repeat: -1
        });
      }
      this.flames = this.add.sprite(fx, fy + 6, "camp:flames")
        .setOrigin(0.5, 1)
        .setScale(ART_SCALE)
        .setDepth(actorDepth(fy))
        .play("camp_flames");
      // A second, smaller fire burning inside the first, out of step with
      // it and added on top: the flame's heart flickers on its own.
      this.add.sprite(fx, fy + 4, "camp:flames")
        .setOrigin(0.5, 1)
        .setScale(ART_SCALE * 0.62, ART_SCALE * 0.7)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.55)
        .setDepth(actorDepth(fy) + 1e-5)
        .play({ key: "camp_flames", startFrame: 4, timeScale: 1.3 });
    }
    // The halo round the flames.
    this.glow(fx, fy - 46, 196, 196, 0.42, actorDepth(fy) + 2e-5);

    const dot = ensureDotTexture(this);
    // Sparks.
    this.add.particles(fx, fy - 34, dot, {
      x: { min: -16, max: 16 },
      lifespan: { min: 1100, max: 2300 },
      speedY: { min: -78, max: -34 },
      speedX: { min: -14, max: 14 },
      accelerationX: { min: -10, max: 16 },
      scale: { start: 0.3, end: 0 },
      alpha: { start: 1, end: 0 },
      tint: [0xffe08a, 0xffa040, 0xff6a20],
      blendMode: Phaser.BlendModes.ADD,
      frequency: 120
    }).setDepth(actorDepth(fy) + 3e-5);
    // Smoke, drifting off to the right.
    this.add.particles(fx, fy - 92, dot, {
      x: { min: -8, max: 8 },
      lifespan: 4400,
      speedY: { min: -26, max: -14 },
      speedX: { min: 3, max: 12 },
      scale: { start: 1.3, end: 4.6 },
      alpha: { start: 0.11, end: 0 },
      tint: 0x6e6a74,
      frequency: 280
    }).setDepth(actorDepth(fy) + 4e-5);
  }

  /**
   * A warm additive glow, w×h world px, flickering a little below `alpha`.
   * (The battle's torch glow breathes between 0.6 and full opacity — right
   * for a torch, blown out at the size of a campfire's light.)
   */
  private glow(x: number, y: number, w: number, h: number, alpha: number, depth: number): Phaser.GameObjects.Image {
    const key = "camp_glow";
    if (!this.textures.exists(key)) {
      const size = 128;
      const tex = this.textures.createCanvas(key, size, size);
      if (tex) {
        const ctx = tex.getContext();
        const g = ctx.createRadialGradient(size / 2, size / 2, 1, size / 2, size / 2, size / 2);
        g.addColorStop(0, "rgba(255,190,104,1)");
        g.addColorStop(0.4, "rgba(255,138,56,0.45)");
        g.addColorStop(1, "rgba(255,104,32,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        tex.refresh();
      }
    }
    const img = this.add.image(x, y, key)
      .setDisplaySize(w, h)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(depth)
      .setAlpha(alpha);
    const sx = img.scaleX, sy = img.scaleY;
    this.tweens.add({
      targets: img,
      alpha: { from: alpha * 0.82, to: alpha },
      scaleX: { from: sx * 0.96, to: sx * 1.03 },
      scaleY: { from: sy * 0.96, to: sy * 1.03 },
      yoyo: true,
      repeat: -1,
      duration: Phaser.Math.Between(380, 620),
      ease: "Sine.easeInOut"
    });
    return img;
  }

  // ---- Props ----------------------------------------------------------------

  /**
   * Stand a camp billboard with its base at (x, y). The art is lit from the
   * right, so anything right of the fire is mirrored to face its light.
   */
  private prop(
    key: string,
    x: number,
    y: number,
    opts: { scale?: number; flip?: boolean; shadow?: boolean } = {}
  ): Phaser.GameObjects.Image | null {
    if (!this.textures.exists(key)) return null;
    const s = ART_SCALE * (opts.scale ?? 1);
    const flip = opts.flip ?? x > FIRE.x;
    const img = this.add.image(x, y, key)
      .setOrigin(0.5, 1)
      .setScale(s)
      .setFlipX(flip)
      .setDepth(actorDepth(y))
      .setTint(this.warmth(x, y));
    this.add.ellipse(x, y - 2, img.displayWidth * 0.78, Math.max(8, img.displayWidth * 0.16), 0x000000, 0.32)
      .setDepth(DEPTH.SHADOW);
    if (opts.shadow !== false) this.addCaster(img);
    return img;
  }

  private buildProps(openWagon: () => void): void {
    // Pines along the back, on the raised shelves, and two at the sides
    // framing the clearing.
    this.prop("camp:pine", 34, 353, { scale: 1.12, flip: false });
    this.prop("camp:pine", 146, 341, { scale: 0.96, flip: false });
    this.prop("camp:pine", 236, 352, { scale: 0.8, flip: false });
    this.prop("camp:pine", 1060, 350, { scale: 0.84 });
    this.prop("camp:pine", 1150, 341, { scale: 1.0 });
    this.prop("camp:pine", 1252, 353, { scale: 1.16 });
    this.prop("camp:pine", -6, 488, { scale: 1.08, flip: false });
    this.prop("camp:pine", 1290, 500, { scale: 1.12 });

    this.prop("camp:tent", 318, 404, { flip: false });
    this.prop("camp:lantern", LANTERN.x, LANTERN.y, { flip: false });
    // The lantern is the camp's second light: a glow at the glass and a
    // small pool under it.
    this.flameLights.push({ x: LANTERN.x + 6, y: LANTERN.y, radius: 150 });
    this.glow(LANTERN.x + 7, LANTERN.y - 56, 60, 60, 0.85, actorDepth(LANTERN.y) + 1e-5);
    this.glow(LANTERN.x + 7, LANTERN.y + 2, 144, 68, 0.45, DEPTH.LIGHT);

    const wagon = this.prop("camp:wagon", 1000, 412, { flip: false });
    this.prop("camp:crates", 1134, 430);
    // Log benches either side of the fire.
    // (No cast shadow: a log's silhouette stood up and leaned back reads as
    // a dark board behind it, not a shadow on the ground.)
    this.prop("camp:log", FIRE.x - 128, FIRE.y - 16, { flip: false, shadow: false });
    this.prop("camp:log", FIRE.x + 132, FIRE.y - 10, { shadow: false });

    if (wagon) {
      const label = this.add.text(0, 0, "Wagon · Inventory", {
        fontFamily: FAMILY_HEADING,
        fontSize: "13px",
        color: "#f4d999",
        stroke: "#1a0e04",
        strokeThickness: 3
      }).setOrigin(0.5, 0);
      this.propLabels.push({ text: label, x: wagon.x, y: wagon.y + 4 });
      this.uiBorn.push(label);
      this.picks.push({ imgs: [wagon], kind: "prop", label, onClick: openWagon });
    }
  }

  // Memorial — only when someone has fallen. One stone per name, engraved,
  // each leaning a little its own way; Lucian's spear planted at the end
  // of the row. Clicking opens a quiet beat about who they were.
  private buildMemorial(fallen: { id: string; name: string }[]): void {
    const cx = 214, cy = 598;
    const SPACING = 46;
    const startX = cx - ((fallen.length - 1) * SPACING) / 2;
    this.add.ellipse(cx, cy - 2, Math.max(110, fallen.length * SPACING + 40), 20, 0x2a2218, 0.9)
      .setDepth(DEPTH.SHADOW);
    const stones: Phaser.GameObjects.Image[] = [];
    fallen.forEach((f, i) => {
      const sx = startX + i * SPACING;
      const tilt = (i % 2 === 0 ? -1 : 1) * 0.035;
      if (!this.textures.exists("camp:memorial")) return;
      const img = this.add.image(sx, cy, "camp:memorial")
        .setOrigin(0.5, 1)
        .setScale(ART_SCALE)
        .setRotation(tilt)
        .setDepth(actorDepth(cy))
        .setTint(this.warmth(sx, cy));
      this.addCaster(img);
      stones.push(img);
      const carved = f.name.toUpperCase();
      this.add.text(sx + Math.sin(tilt) * 40, cy - 40, carved, {
        fontFamily: FAMILY_HEADING,
        fontSize: `${carved.length > 5 ? 7 : 8}px`,
        color: "#2a2016"
      }).setOrigin(0.5).setRotation(tilt).setAlpha(0.85).setDepth(actorDepth(cy) + 1e-6);
    });

    if (fallen.find((f) => f.id === "lucian")) {
      const sg = this.add.graphics();
      sg.fillStyle(0x5a4530, 1);
      sg.fillRect(-1.5, -66, 3, 74);
      sg.fillStyle(0x3c2e1e, 1);
      sg.fillRect(-1.5, 2, 3, 6);
      sg.fillStyle(0x2e2318, 1);
      sg.fillRect(-2.5, -34, 5, 3);
      sg.fillRect(-2.5, -28, 5, 3);
      sg.fillRect(-2.5, -22, 5, 3);
      sg.fillStyle(0x6e7076, 1);
      sg.fillTriangle(0, -88, -5, -66, 5, -66);
      sg.fillStyle(0xc9a86a, 0.9);
      sg.fillTriangle(0, -88, 2, -70, 5, -66);
      sg.fillStyle(0x4a4038, 1);
      sg.fillRect(-3, -67, 6, 3);
      sg.fillStyle(0x2a2218, 1);
      sg.fillEllipse(0, 6, 18, 6);
      const x = startX + (fallen.length - 1) * SPACING + 40;
      sg.setPosition(x, cy - 6).setRotation(0.06).setDepth(actorDepth(cy - 6));
    }

    const label = this.add.text(0, 0, "Memorial", {
      fontFamily: FAMILY_HEADING,
      fontSize: "12px",
      color: "#c9b07a",
      stroke: "#1a0e04",
      strokeThickness: 2
    }).setOrigin(0.5, 0);
    this.propLabels.push({ text: label, x: cx, y: cy + 4 });
    this.uiBorn.push(label);
    if (stones.length) this.picks.push({ imgs: stones, kind: "prop", label, onClick: () => this.showMemorialBeat(fallen) });
  }

  // ---- The squad -------------------------------------------------------------

  private buildCharacter(id: string, slot: Slot, fadeDelay: number): void {
    const factory = this.resolvePlayerFactory(id);
    if (!factory) return;
    const def = factory();
    const unit = createUnit(def, { x: 0, y: 0 });
    const tex = ensureUnitTexture(this, unit);
    const sprite = this.add.sprite(slot.x, slot.y, tex)
      .setOrigin(0.5, UNIT_FOOT_ORIGIN)
      .setDisplaySize(64, 80)
      .setFlipX(slot.faceLeft)
      .setDepth(actorDepth(slot.y))
      .setTint(this.warmth(slot.x, slot.y));
    const cls = resolveSpriteClass(this, unit);
    if (hasUnitAnimation(cls, "idle")) {
      // Out of step with each other: a ring breathing in unison reads as a
      // screensaver, not people.
      sprite.play({
        key: animKey(cls, "idle"),
        startFrame: Math.floor(Math.random() * 2),
        timeScale: 0.85 + Math.random() * 0.3
      });
    }
    const contact = this.add.ellipse(slot.x, slot.y + 1, 34, 10, 0x000000, 0.38).setDepth(DEPTH.SHADOW);
    const pos = { x: slot.x, y: slot.y };
    this.addCaster(sprite, pos);

    const label = this.add.text(0, 0, def.name, {
      fontFamily: FAMILY_HEADING,
      fontSize: "12px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 3
    }).setOrigin(0.5, 0);
    this.uiBorn.push(label);
    sprite.setAlpha(0);
    this.tweens.add({ targets: sprite, alpha: 1, delay: fadeDelay, duration: 380, ease: "Sine.easeOut" });

    this.chars.push({ id: def.id, unit, sprite, label, contact, home: slot, pos, lift: 0, busy: false });
    this.picks.push({ imgs: [sprite], kind: "char", label, onClick: () => this.openCharacterTalk(def.id) });
  }

  // ---- Light ----------------------------------------------------------------

  /** Firelight on a billboard: warm near the flames, untouched far off. */
  private warmth(x: number, y: number): number {
    const d = Math.hypot(x - FIRE.x, (y - FIRE.y) * 1.5);
    const f = Math.max(0, 1 - d / FIRE.radius) * 0.85;
    const g = Math.round(255 - 52 * f), b = Math.round(255 - 112 * f);
    return (0xff << 16) | (g << 8) | b;
  }

  private addCaster(src: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, ground?: { x: number; y: number }): void {
    // A silhouette is a black-tinted copy, and the Canvas fallback renderer
    // has no tint: there it would be a second, coloured figure.
    if (this.game.renderer.type !== Phaser.WEBGL) return;
    const cast = this.add.image(src.x, src.y, src.texture.key, src.frame.name)
      .setOrigin(src.originX, src.originY)
      .setTintFill(0x000000)
      .setAlpha(0)
      .setDepth(DEPTH.TORCH_SHADOW);
    this.casters.push({ src, cast, ground });
  }

  private castShadow(c: Caster, flicker: number): void {
    const { src, cast } = c;
    const gx = c.ground?.x ?? src.x, gy = c.ground?.y ?? src.y;
    const sun = torchShadow(gx, gy, this.flameLights);
    if (!sun || !src.visible) { cast.setVisible(false); return; }
    if (cast.frame.name !== src.frame.name || cast.texture.key !== src.texture.key) {
      cast.setTexture(src.texture.key, src.frame.name);
    }
    castFrom(cast, src, sun);
    cast.setPosition(gx, gy).setVisible(true).setAlpha(Math.min(0.62, sun.alpha * flicker) * src.alpha);
  }

  // The night over the board, with the fire's and the lantern's light cut
  // out of it — the battle's darkness layer (see BattleScene's spotlight),
  // breathing with the flame.
  private buildDarkness(): void {
    if (!this.textures.exists(LIGHT_BRUSH)) {
      const size = 256;
      const tex = this.textures.createCanvas(LIGHT_BRUSH, size, size);
      if (tex) {
        const ctx = tex.getContext();
        const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
        g.addColorStop(0, "rgba(255,255,255,1)");
        g.addColorStop(0.3, "rgba(255,255,255,0.92)");
        g.addColorStop(0.7, "rgba(255,255,255,0.35)");
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, size);
        tex.refresh();
      }
    }
    this.darkness = this.add.renderTexture(-140, 90, GAME_WIDTH + 280, GAME_HEIGHT - 60)
      .setOrigin(0, 0)
      .setDepth(DEPTH.DARKNESS)
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    this.brush = this.make.image({ key: LIGHT_BRUSH, add: false });
    this.paintDarkness(1);
    // Moonlight: the darkness alone left the grass a deep saturated olive.
    // A faint cool blue added over everything lifts the shadows toward the
    // night sky's colour without lighting them. Added, not painted over:
    // a normal-blend layer would lower the board's alpha over the sky. Only
    // over the board's own ground and slab, which are opaque everywhere:
    // added onto the transparent sky above it, it would paint it over.
    const B = CAMP_BOARD;
    this.add.rectangle(B.originX, B.originY, B.cols * B.tileW, B.rows * B.tileH + B.slabDepth, 0x02060e, 1)
      .setOrigin(0, 0)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(DEPTH.DARKNESS + 0.1);
  }

  private paintDarkness(flicker: number): void {
    const rt = this.darkness, brush = this.brush;
    if (!rt || !brush) return;
    rt.clear();
    rt.fill(0x0a1230, 0.72);
    for (const [i, l] of this.flameLights.entries()) {
      const s = ((l.radius * 2) / 256) * (i === 0 ? flicker : 1);
      brush.setPosition(l.x - rt.x, l.y - 30 - rt.y).setScale(s, s * 0.74);
      rt.erase(brush);
    }
  }

  /** A log settles: the fire flares for a moment, light and flame both. */
  private flare(): void {
    this.flaredAt = this.time.now;
    if (this.flames) {
      this.tweens.add({ targets: this.flames, scaleX: ART_SCALE * 1.12, scaleY: ART_SCALE * 1.2, duration: 140, yoyo: true, ease: "Sine.easeOut" });
    }
  }

  // ---- Cameras and input -----------------------------------------------------

  private setupCameras(worldSet: Set<Phaser.GameObjects.GameObject>): void {
    applyCinematicFX(this, { bloomIntensity: 0.95, saturation: 0.1, brightness: 1.02 });
    const pipe = attachPostPipeline(this.cameras.main, this.game, PERSPECTIVE_PIPELINE, PerspectivePipeline);
    if (pipe) {
      this.keystone = { k: CAMP_KEYSTONE_K, centerX: 0.5 };
      pipe.k = this.keystone.k;
      pipe.centerX = this.keystone.centerX;
    }
    this.uiCamera = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    const all = this.children.getChildren();
    const ui = all.filter((o) => !worldSet.has(o));
    for (const o of ui) this.ignoreDeep(this.cameras.main, o);
    this.uiCamera.ignore(all.filter((o) => worldSet.has(o)));
  }

  private ignoreDeep(cam: Phaser.Cameras.Scene2D.Camera, o: Phaser.GameObjects.GameObject): void {
    cam.ignore(o);
    if (o instanceof Phaser.GameObjects.Container) for (const c of o.list) this.ignoreDeep(cam, c);
  }

  /** Route an object made after create() to the flat UI camera only. */
  private ui<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.ignoreDeep(this.cameras.main, o);
    return o;
  }

  private setupInput(): void {
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (p: Phaser.Input.Pointer) => {
      this.pointerAt = { x: p.x, y: p.y };
    });
    this.input.on(Phaser.Input.Events.GAME_OUT, () => {
      this.pointerAt = null;
      this.setHover(null);
    });
    this.input.on(Phaser.Input.Events.POINTER_DOWN, (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (over.length > 0) return;
      const hit = this.pickAt(p.x, p.y);
      if (hit) hit.onClick();
    });
  }

  /** A pointer (game px) → the world point drawn there, through the tilt. */
  private screenToWorld(px: number, py: number): { x: number; y: number } | null {
    const cam = this.cameras.main;
    let sx = px, sy = py;
    if (this.keystone) {
      const src = screenToSource(px, py, cam.width, cam.height, this.keystone);
      if (!src) return null;
      sx = src.x;
      sy = src.y;
    }
    const wp = cam.getWorldPoint(sx, sy);
    return { x: wp.x, y: wp.y };
  }

  /** A world point → where it shows on screen, in UI (design) px. */
  private worldToUi(wx: number, wy: number): { x: number; y: number } {
    const cam = this.cameras.main;
    const bx = (wx - cam.scrollX) * cam.zoom, by = (wy - cam.scrollY) * cam.zoom;
    const s = this.keystone ? sourceToScreen(bx, by, cam.width, cam.height, this.keystone) : { x: bx, y: by };
    return { x: s.x / RENDER_SCALE, y: s.y / RENDER_SCALE };
  }

  // What the pointer is on: a companion if any is under it (the nearest
  // body when two overlap, as on the battle board), otherwise the
  // front-most prop.
  private pickAt(px: number, py: number): Pickable | null {
    if (this.leaving || this.modal) return null;
    const w = this.screenToWorld(px, py);
    if (!w) return null;
    let best: Pickable | null = null, bestD = Infinity, bestProp: Pickable | null = null, bestDepth = -Infinity;
    for (const pk of this.picks) {
      for (const img of pk.imgs) {
        if (!img.visible || img.alpha < 0.2 || !figureAt(img, w.x, w.y, true)) continue;
        if (pk.kind === "char") {
          const c = bodyCentre(img);
          const d = Math.hypot(w.x - c.x, w.y - c.y);
          if (d < bestD) { bestD = d; best = pk; }
        } else if (img.depth > bestDepth) {
          bestDepth = img.depth;
          bestProp = pk;
        }
      }
    }
    return best ?? bestProp;
  }

  private setHover(pk: Pickable | null): void {
    if (pk === this.hovered) return;
    this.hovered?.label?.setColor("#f4d999").setScale(1);
    this.hovered = pk;
    for (const o of this.outline) o.destroy();
    this.outline = [];
    if (!pk) {
      this.input.setDefaultCursor("default");
      return;
    }
    this.input.setDefaultCursor("pointer");
    pk.label?.setColor("#fff6d8").setScale(1.12);
    // A one-art-pixel gold outline: four gold copies, one pixel out each way
    // (WebGL only, for the same reason as the shadows).
    if (this.game.renderer.type !== Phaser.WEBGL) return;
    for (const img of pk.imgs) {
      for (const [dx, dy] of OUTLINE_OFFSETS) {
        const o = this.add.image(img.x + dx, img.y + dy, img.texture.key, img.frame.name)
          .setOrigin(img.originX, img.originY)
          .setScale(img.scaleX, img.scaleY)
          .setFlipX(img.flipX)
          .setRotation(img.rotation)
          .setTintFill(0xffd97a)
          .setAlpha(0.95)
          .setDepth(img.depth - 1e-7);
        o.setData("src", img).setData("dx", dx).setData("dy", dy);
        this.uiCamera?.ignore(o);
        this.outline.push(o);
      }
    }
  }

  private syncOutline(): void {
    for (const o of this.outline) {
      const src = o.getData("src") as Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
      if (o.frame.name !== src.frame.name) o.setFrame(src.frame.name);
      o.setPosition(src.x + (o.getData("dx") as number), src.y + (o.getData("dy") as number))
        .setFlipX(src.flipX)
        .setAlpha(0.95 * src.alpha)
        .setDepth(src.depth - 1e-7);
    }
  }

  // ---- UI ---------------------------------------------------------------------

  private buildInfo(souls: number): void {
    const save = loadSave();
    const shade = this.add.graphics();
    shade.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.62, 0, 0.5, 0);
    shade.fillRect(0, 0, 620, 172);
    this.add.text(36, 22, "The Camp", {
      fontFamily: FAMILY_DISPLAY,
      fontSize: "42px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 4, color: "#000", blur: 14, fill: true }
    }).setLetterSpacing(3);
    this.add.text(38, 80, this.resolveCampSubtitle(save.completedBattles), {
      fontFamily: FAMILY_BODY,
      fontSize: "15px",
      color: "#d4bc86",
      fontStyle: "italic",
      stroke: "#000",
      strokeThickness: 2
    });
    // Lives — campaign-wide losses against the death budget. Grey with no
    // losses, warning amber once any have landed, crimson on the last.
    const deaths = save.squadDeaths ?? 0;
    const livesLeft = Math.max(0, MAX_PERMITTED_DEATHS - deaths);
    const livesColor =
      deaths === 0 ? "#8a8272" :
      livesLeft === 0 ? "#d05050" :
      livesLeft === 1 ? "#e0945a" :
      "#d4bc86";
    const soulsText = this.add.text(38, 108, `${souls} ${souls === 1 ? "soul" : "souls"} at the fire tonight`, {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: "#a59b88"
    });
    this.add.text(soulsText.x + soulsText.width + 14, 108, `·   Lives remaining: ${livesLeft} / ${MAX_PERMITTED_DEATHS}`, {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: livesColor
    });
    this.add.text(38, 132, "Click anyone at the fire to talk · the wagon holds your supplies", {
      fontFamily: FAMILY_BODY,
      fontSize: "12px",
      color: "#7d7666",
      fontStyle: "italic"
    });
  }

  private buildButtons(next: BattleNode | null): void {
    // The way on: two large buttons in the bottom-right corner, where the
    // eye goes for "continue". Start Next Chapter (when there is one) is
    // the gold one, and glows.
    const W = 344, cx = GAME_WIDTH - 24 - W / 2;
    const startH = 76, mapH = next ? 52 : 62;
    const startY = GAME_HEIGHT - 22 - startH / 2;
    const mapY = next ? startY - startH / 2 - 14 - mapH / 2 : GAME_HEIGHT - 22 - mapH / 2;
    if (next) {
      const start = new CtaButton(this, {
        x: cx,
        y: startY,
        w: W,
        h: startH,
        label: "Start Next Chapter  ▸",
        sublabel: `${next.title}: ${next.subtitle}`,
        primary: true,
        fontSize: 23,
        pulse: true,
        onClick: () => this.leave(() => this.scene.start("BattlePrepScene", { battleId: next.id, from: "camp" }))
      });
      if (this.args.nextChapter) {
        // Brought here by the story on the way to a battle: the button
        // arrives a beat after the camp does, so the eye finds it.
        start.setAlpha(0).setScale(0.82);
        this.tweens.add({ targets: start, alpha: 1, scale: 1, delay: 700, duration: 520, ease: "Back.easeOut" });
      }
    }
    new CtaButton(this, {
      x: cx,
      y: mapY,
      w: W,
      h: mapH,
      label: "Go to Map",
      fontSize: 19,
      onClick: () => this.leave(() => this.scene.start("OverworldScene"))
    });

    // Everything else, smaller, bottom-left.
    const bw = 116, bh = 38, by = GAME_HEIGHT - 22 - bh, gap = 8;
    const small: { label: string; onClick: () => void; enabled?: boolean }[] = [
      { label: "◂ Title", onClick: () => this.leave(() => this.scene.start("TitleScene")) },
      { label: "Roster", onClick: () => { this.scene.pause(); this.scene.run("RosterScene", { from: this.scene.key }); } },
      { label: "Inventory", onClick: () => this.openWagon() },
      // Bonds will surface here in a future update.
      { label: "Memories", onClick: () => this.showMemoriesPlaceholder(), enabled: false }
    ];
    small.forEach((b, i) => {
      new Button(this, {
        x: 24 + i * (bw + gap),
        y: by,
        w: bw,
        h: bh,
        label: b.label,
        fontSize: 14,
        enabled: b.enabled,
        onClick: b.onClick
      });
    });
  }

  private backdrop(): CampBackdropScene | undefined {
    const s = this.scene.get("CampBackdropScene") as CampBackdropScene | undefined;
    return s && s.sys.isActive() ? s : undefined;
  }

  private leave(go: () => void): void {
    if (this.leaving) return;
    this.leaving = true;
    this.setHover(null);
    this.cameras.main.fadeOut(350, 0, 0, 0);
    this.uiCamera?.fadeOut(350, 0, 0, 0);
    this.backdrop()?.fade(true, 350);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
  }

  // The camp can be reached seconds after boot ("Resume Last Slot"), before
  // its art has streamed in. Small as it is, if any of it is still on its
  // way, rebuild the camp once it lands rather than leave a bare board.
  private waitForArt(): void {
    const missing = CAMP_ART.filter((k) => !this.textures.exists(k));
    if (!missing.length) return;
    const stream = this.scene.get("AssetStreamScene");
    const loader = stream?.load;
    if (!loader || !loader.isLoading()) return;
    const pending = new Set(missing);
    let arrived = 0;
    const rebuild = (): void => {
      if (this.leaving) return;
      if (this.scene.isPaused()) this.restartWhenResumed = true;
      else this.scene.restart(this.args);
    };
    const onFile = (key: string): void => {
      if (!pending.delete(key)) return;
      arrived++;
      if (pending.size === 0) { off(); rebuild(); }
    };
    const onDone = (): void => { off(); if (arrived > 0) rebuild(); };
    const off = (): void => {
      loader.off(Phaser.Loader.Events.FILE_COMPLETE, onFile);
      loader.off(Phaser.Loader.Events.COMPLETE, onDone);
    };
    loader.on(Phaser.Loader.Events.FILE_COMPLETE, onFile);
    loader.once(Phaser.Loader.Events.COMPLETE, onDone);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
  }

  // ---- Actions ----------------------------------------------------------------

  // Resolve the character's current-era idle line, then pause the camp and
  // run BattleDialogueScene as a single-beat overlay; its resume contract
  // hands control back here when the player clicks Continue.
  private openCharacterTalk(characterId: string): void {
    sfxClick();
    const save = loadSave();
    const beat = resolveCampBeat(characterId, save.completedBattles, String(save.flags[ROMANCE_FLAG] ?? "none"));
    this.setHover(null);
    this.scene.pause();
    this.scene.run("BattleDialogueScene", { beats: [beat], resumeKey: this.scene.key });
  }

  private openWagon(): void {
    const next = resolveNextChapter(loadSave());
    if (!next) {
      const t = this.ui(this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 120, "Nothing to prep — the squad's caught up to the road's end.", {
        fontFamily: FAMILY_BODY,
        fontSize: "14px",
        color: "#c9b07a",
        stroke: "#000",
        strokeThickness: 3
      }).setOrigin(0.5));
      this.tweens.add({ targets: t, alpha: 0, delay: 600, duration: 1800, onComplete: () => t.destroy() });
      return;
    }
    sfxClick();
    this.setHover(null);
    this.scene.pause();
    this.scene.run("InventoryScene", { battleId: next.id, resumeKey: this.scene.key });
  }

  private resolvePlayerFactory(id: string): (() => UnitDef) | undefined {
    // amar_true (the pre-amnesia B1 statline) shares amar's camp sprite.
    if (id === "amar_true") return PLAYERS.amar;
    return ROSTER_ORDER.find((r) => r.recordId === id)?.factory;
  }

  private activeSquadIds(completedBattles: string[]): string[] {
    // The dead don't stand at the fire (Rose dies in B13's post-arc while
    // still in its battle roster).
    const gone = fallenIds(completedBattles);
    const living = getActiveSquadIds(completedBattles).filter((id) => !gone.has(id));
    // Fresh save, nothing completed — show Amar so camp isn't empty.
    return living.length > 0 ? living : ["amar"];
  }

  // ---- Memorial / Memories overlays -------------------------------------------

  private showMemorialBeat(fallen: { id: string; name: string }[]): void {
    sfxClick();
    this.setHover(null);
    const blocks: string[] = [];
    for (const f of fallen) {
      if (f.id === "lucian") {
        blocks.push("Lucian — foreman of Thuling, husband to Mira, father to Tali. Took the bolt that should have ended Ning. Died in the cabin of Madame Dawn's ship with Amar's hand in his. The festival flag from his front room hangs over the marker. Mira and Tali rode for the cousin's farm. Amar will write to them every season for the rest of his life.");
      } else if (f.id === "rose") {
        blocks.push("Rose — Madame Dawn's lieutenant for thirty-two years, the steady hand who trained Maya. She stepped in front of four bolts meant for Dawn and was gone before the last crossbowman fell. She rests in Grude beneath the courtyard's lemon tree; this stone is the squad's. The plaza will carry her name.");
      } else {
        blocks.push(`${f.name} — fell in the line of duty.`);
      }
    }
    this.showOverlay("At the Memorial", blocks.join("\n\n"));
  }

  private showMemoriesPlaceholder(): void {
    this.showOverlay("Memories Wall",
      "Bonds between characters get forged at specific story beats — saving someone's life, sharing a Ravaged turn, standing back-to-back at a moment that mattered. Each forged bond will live on this wall as a named memory ('The South Ford', 'The Practice Yard') and unlock a combined technique when both characters are adjacent in battle.\n\nNo memories forged yet. Coming in a future update.");
  }

  // A modal panel on the UI camera, sized to its text: the body is measured
  // first and the panel grows to fit it (stepping the font down if even
  // that would overflow the screen).
  private showOverlay(heading: string, text: string): void {
    const dim = this.ui(this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setInteractive().setDepth(100));
    const panelW = 540;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const TITLE_ZONE = 64, BUTTON_ZONE = 66, MAX_PANEL_H = GAME_HEIGHT - 80;
    const body = this.ui(this.add.text(0, 0, text, {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: "#dad3bd",
      wordWrap: { width: panelW - 48 },
      lineSpacing: 5
    }));
    if (TITLE_ZONE + body.height + BUTTON_ZONE > MAX_PANEL_H) {
      body.setFontSize(12);
      body.setLineSpacing(4);
    }
    const panelH = Math.max(220, Math.min(MAX_PANEL_H, TITLE_ZONE + body.height + BUTTON_ZONE));
    const panelY = (GAME_HEIGHT - panelH) / 2;
    const pg = this.ui(this.add.graphics().setDepth(101));
    drawPanel(pg, panelX, panelY, panelW, panelH);
    const title = this.ui(this.add.text(panelX + panelW / 2, panelY + 22, heading, {
      fontFamily: FAMILY_HEADING,
      fontSize: "22px",
      color: "#f4d999"
    }).setOrigin(0.5, 0).setDepth(102));
    body.setPosition(panelX + 24, panelY + TITLE_ZONE).setDepth(102);
    this.modal = true;
    const closeBtn: Button = this.ui(new Button(this, {
      x: panelX + panelW / 2 - 70,
      y: panelY + panelH - 50,
      w: 140,
      h: 36,
      label: "Close",
      primary: false,
      fontSize: 13,
      onClick: () => {
        dim.destroy(); pg.destroy(); title.destroy(); body.destroy(); closeBtn.destroy();
        this.modal = false;
      }
    }).setDepth(102));
  }

  // ---- Subtitle -----------------------------------------------------------------

  private resolveCampSubtitle(completedBattles: string[]): string {
    const last = completedBattles[completedBattles.length - 1];
    if (!last) return "Outside the palace gates, before everything begins";
    if (last === "b01_palace_coup") return "A hospital ward outside Para — Amar wakes alone";
    if (last === "b02_farmland" || last === "b03_dawn_bandits" || last === "b04_swamp") {
      return "Lucian's forge yard, Thuling — the squad takes shape";
    }
    if (last === "b05_mountain_ndari" || last === "b06_caravan" || last === "b07_monastery") {
      return "Field camp east of Thuling — Fergus's contracts pile up";
    }
    if (last === "b08_orinhal" || last === "b09_ravine") {
      return "Clearing south of the ford — the squad knows the truth about Fergus now";
    }
    if (last === "b10_leaving_thuling") return "The Para harbor road, an hour before sundown";
    if (last === "b11_cliffs") return "Below decks, Madame Dawn's ship — the long crossing has begun";
    return "Somewhere in the long crossing — destination Grude";
  }
}
