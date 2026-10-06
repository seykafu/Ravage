import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../../util/constants";
import type { ClassKind } from "../../combat/types";
import { animKey, hasUnitAnimation } from "../../assets/animations";
import { classOf, ensureGlow } from "./figures";
import { ensureDotTexture } from "../battle/Atmosphere";
import { sfxCineChime } from "../../audio/Sfx";

// The ring at sunset — the wedding codas' closing picture.
//
// A clifftop over the sea with the sun going down into it (painted with
// Codex, see scripts/art/gen_ring_art.py), Amar and the one he marries
// standing on the grass as their own battle sprites, and the ring he holds
// out shown large above them in the light. StoryScene stages it from the
// beat that asks for it (DialogBeat.tableau) to the end of the arc; the
// story's own narration plays over it.
//
// Laid out above the dialog panel: the couple's feet sit just over the
// panel's top edge, their heads against the sea, the ring between them in
// the sky.

const CLIFF = "backdrop:ring_cliff";
const RING = "story:ring";
/** Where the sun is in the painting, as a fraction of its size. */
const SUN = { x: 0.73, y: 0.27 };
/** The couple's feet, just above the dialog panel. */
const FEET_Y = 428;
/**
 * Sprites at 2.5× their 32×40 sheets — about the camp's size. Larger, each
 * art pixel became a block (at 5× a whole figure was a dozen fat pixels
 * across); this keeps them crisp against the painting.
 */
const SPRITE_SCALE = 2.5;
/** Shadow sizes go with the sprite scale. */
const K = SPRITE_SCALE / 5;

export interface RingTableau {
  readonly root: Phaser.GameObjects.Container;
}

/**
 * "ring": Amar steps toward them and the ring rises between them.
 * "home": later — the two of them side by side, looking out at the
 * sun going down, the ring catching it on his hand.
 */
export type TableauKind = "ring" | "home";

export const showRingTableau = (scene: Phaser.Scene, who: string, depth: number, kind: TableauKind = "ring"): RingTableau => {
  const root = scene.add.container(0, 0).setDepth(depth).setAlpha(0);
  root.setData("partner", who);

  // ---- the painting ----------------------------------------------------
  if (scene.textures.exists(CLIFF)) {
    scene.textures.get(CLIFF).setFilter(Phaser.Textures.FilterMode.LINEAR);
    const bg = scene.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, CLIFF).setDisplaySize(GAME_WIDTH * 1.04, GAME_HEIGHT * 1.04);
    root.add(bg);
    // A slow drift toward the sun.
    scene.tweens.add({ targets: bg, x: GAME_WIDTH / 2 - 14, y: GAME_HEIGHT / 2 + 4, duration: 16000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  } else {
    const g = scene.add.graphics();
    g.fillGradientStyle(0x3a1e4a, 0x3a1e4a, 0xf09a4a, 0xf09a4a, 1);
    g.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    root.add(g);
  }
  const sun = { x: GAME_WIDTH * SUN.x, y: GAME_HEIGHT * SUN.y };
  const dot = ensureDotTexture(scene);

  // Light: the sun's glow, and long faint rays turning slowly off it.
  const rays = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setPosition(sun.x, sun.y).setAlpha(0.5);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    rays.fillStyle(0xffd8a0, 0.05);
    rays.fillTriangle(0, 0, Math.cos(a - 0.05) * 900, Math.sin(a - 0.05) * 900, Math.cos(a + 0.05) * 900, Math.sin(a + 0.05) * 900);
  }
  scene.tweens.add({ targets: rays, angle: 360, duration: 120000, repeat: -1 });
  const soft = ensureGlow(scene);
  const glow = scene.add.image(sun.x, sun.y, soft).setTint(0xffc070).setBlendMode(Phaser.BlendModes.ADD).setScale(1.7).setAlpha(0.45);
  scene.tweens.add({ targets: glow, alpha: 0.6, scale: 1.85, duration: 2600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  root.add([rays, glow]);

  // ---- the two of them -------------------------------------------------
  // Each figure is a container at its feet: the sprite, and a warm rim of
  // evening light down the side facing the sun, moving together.
  const figure = (id: string, x: number, faceLeft: boolean): { box: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Sprite; cls: string } => {
    const cls = classOf(scene, id);
    const tex = scene.textures.exists(`unit:${cls}:idle`) ? `unit:${cls}:idle` : cls;
    // The sun is behind them, low on the right: shadows fall long to the left.
    const shadow = scene.add.ellipse(-26 * K, 2, 120 * K, 16 * K, 0x1a0c08, 0.4);
    const rim = scene.add.sprite(1.5, 0, tex).setOrigin(0.5, 0.9).setScale(SPRITE_SCALE).setFlipX(faceLeft)
      .setTintFill(0xffb060).setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD);
    const sprite = scene.add.sprite(0, 0, tex).setOrigin(0.5, 0.9).setScale(SPRITE_SCALE).setFlipX(faceLeft).setTint(0xffe2c0);
    const sync = (): void => { rim.setTexture(sprite.texture.key, sprite.frame.name); };
    sprite.on(Phaser.Animations.Events.ANIMATION_START, sync);
    sprite.on(Phaser.Animations.Events.ANIMATION_UPDATE, sync);
    if (hasUnitAnimation(cls as ClassKind, "idle")) sprite.play(animKey(cls as ClassKind, "idle"));
    const box = scene.add.container(x, FEET_Y, [shadow, rim, sprite]);
    root.add(box);
    return { box, sprite, cls };
  };
  scene.tweens.add({ targets: root, alpha: 1, duration: 1400, ease: "Sine.easeOut" });
  return kind === "home" ? stageHome(scene, root, figure, soft) : stageRing(scene, root, figure, soft, dot);
};

type Figure = (id: string, x: number, faceLeft: boolean) => { box: Phaser.GameObjects.Container; sprite: Phaser.GameObjects.Sprite; cls: string };

/** The partner the tableau was opened for (kept on the root by showRingTableau). */
const partnerOf = (root: Phaser.GameObjects.Container): string => root.getData("partner") as string;

const stageRing = (
  scene: Phaser.Scene, root: Phaser.GameObjects.Container, figure: Figure, soft: string, dot: string
): RingTableau => {
  const AMAR_X = 560, PARTNER_X = 680, STEP = 26;
  const amar = figure("amar", AMAR_X, false);
  const them = figure(partnerOf(root), PARTNER_X, true);
  // Amar steps toward them...
  const amarCls = amar.cls as ClassKind;
  scene.time.delayedCall(1300, () => {
    if (hasUnitAnimation(amarCls, "walk")) amar.sprite.play(animKey(amarCls, "walk"));
    scene.tweens.add({
      targets: amar.box, x: AMAR_X + STEP, duration: 700, ease: "Sine.easeInOut",
      onComplete: () => { if (hasUnitAnimation(amarCls, "idle")) amar.sprite.play(animKey(amarCls, "idle")); }
    });
  });
  // ...and holds it out.
  scene.time.delayedCall(2200, () => {
    const at = { x: (AMAR_X + STEP + PARTNER_X) / 2, y: 236 };
    const halo = scene.add.image(at.x, at.y, soft).setTint(0xffd890).setBlendMode(Phaser.BlendModes.ADD).setScale(0.15).setAlpha(0);
    const hand = scene.add.image(AMAR_X + STEP + 18, FEET_Y - 44, soft).setTint(0xfff0c0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.05).setAlpha(0);
    root.add([halo, hand]);
    scene.tweens.add({ targets: halo, alpha: 0.7, scale: 0.95, duration: 900, ease: "Cubic.easeOut" });
    scene.tweens.add({ targets: hand, alpha: 0.9, scale: 0.1, duration: 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    if (scene.textures.exists(RING)) {
      scene.textures.get(RING).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const ring = scene.add.image(at.x, at.y, RING).setScale(0.16).setAlpha(0);
      root.add(ring);
      scene.tweens.add({ targets: ring, alpha: 1, scale: 0.36, duration: 900, ease: "Back.easeOut" });
      scene.tweens.add({ targets: ring, y: at.y - 6, angle: 3, duration: 2400, delay: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    const sparkles = scene.add.particles(at.x, at.y, dot, {
      x: { min: -80, max: 80 }, y: { min: -70, max: 70 },
      lifespan: { min: 600, max: 1400 }, scale: { start: 0.3, end: 0 },
      alpha: { start: 1, end: 0 }, tint: [0xffffff, 0xffe6a0, 0xffc870],
      blendMode: Phaser.BlendModes.ADD, frequency: 110
    });
    root.add(sparkles);
    sfxCineChime(1);
    scene.time.delayedCall(180, () => sfxCineChime(1.26));
    scene.time.delayedCall(360, () => sfxCineChime(1.5));
  });
  // The answer, before a word of it is said.
  scene.time.delayedCall(3100, () => {
    scene.tweens.add({ targets: them.box, y: FEET_Y - 6, duration: 150, yoyo: true, repeat: 1, ease: "Sine.easeOut" });
  });
  return { root };
};

// Later: side by side at the cliff's edge, both facing the sun, the
// ring a small steady light on his hand, the evening's motes rising.
const stageHome = (
  scene: Phaser.Scene, root: Phaser.GameObjects.Container, figure: Figure, soft: string
): RingTableau => {
  figure("amar", 588, false);
  figure(partnerOf(root), 648, false);
  const glint = scene.add.image(588 + 14, FEET_Y - 40, soft).setTint(0xfff0c0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.04).setAlpha(0);
  root.add(glint);
  scene.tweens.add({ targets: glint, alpha: 0.9, scale: 0.09, delay: 1600, duration: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
  const motes = scene.add.particles(0, 0, ensureDotTexture(scene), {
    x: { min: 300, max: 1000 }, y: { min: 300, max: 430 },
    speedY: { min: -14, max: -5 }, speedX: { min: -4, max: 6 },
    lifespan: { min: 3000, max: 5200 }, scale: { start: 0.22, end: 0 },
    alpha: { start: 0.9, end: 0 }, tint: [0xfff2c0, 0xffd890],
    blendMode: Phaser.BlendModes.ADD, frequency: 160
  });
  root.add(motes);
  return { root };
};
