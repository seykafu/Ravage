import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../../util/constants";
import { createUnit } from "../../combat/Unit";
import type { ClassKind, UnitDef } from "../../combat/types";
import { ROSTER_ORDER } from "../../data/activeRoster";
import { loadSave, getCharacterRecord } from "../../util/save";
import { animKey, hasUnitAnimation } from "../../assets/animations";
import { ensureUnitTexture, resolveSpriteClass } from "../../art/UnitArt";
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
const AMAR_X = 500, PARTNER_X = 720;
/** Sprites at 5× their 32×40 sheets: big enough to read, still pixel art. */
const SPRITE_SCALE = 5;

/**
 * Which sheet a character wears now: their saved (possibly promoted)
 * class, else their own. Ndara never fought with the squad and has no
 * sheet of her own; Dawn's marshal wears the knight's.
 */
const classOf = (scene: Phaser.Scene, id: string): string => {
  const factory: (() => UnitDef) | undefined = ROSTER_ORDER.find((r) => r.recordId === id)?.factory;
  if (!factory) return "knight";
  const u = createUnit(factory(), { x: 0, y: 0 });
  const rec = getCharacterRecord(loadSave(), id);
  if (rec?.classKind) u.classKind = rec.classKind;
  if (rec?.spriteClassOverride) u.spriteClassOverride = rec.spriteClassOverride;
  // The class's own sheet when it shipped, else the art the unit borrows.
  if (!scene.textures.exists(`unit:${resolveSpriteClass(scene, u)}:idle`)) {
    return ensureUnitTexture(scene, u);
  }
  return resolveSpriteClass(scene, u);
};

/**
 * A large soft glow. (The game's 16px dot, scaled up to a sun, showed every
 * texel under the pixel-art sampling.)
 */
const ensureGlow = (scene: Phaser.Scene): string => {
  const key = "ring_glow";
  if (!scene.textures.exists(key)) {
    const size = 256;
    const tex = scene.textures.createCanvas(key, size, size);
    if (tex) {
      const ctx = tex.getContext();
      const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.25, "rgba(255,255,255,0.55)");
      g.addColorStop(0.6, "rgba(255,255,255,0.14)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, size, size);
      tex.refresh();
      tex.setFilter(Phaser.Textures.FilterMode.LINEAR);
    }
  }
  return key;
};

export interface RingTableau {
  readonly root: Phaser.GameObjects.Container;
}

export const showRingTableau = (scene: Phaser.Scene, partner: string, depth: number): RingTableau => {
  const root = scene.add.container(0, 0).setDepth(depth).setAlpha(0);

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
    const shadow = scene.add.ellipse(-26, 2, 120, 16, 0x1a0c08, 0.4);
    const rim = scene.add.sprite(3, 0, tex).setOrigin(0.5, 0.9).setScale(SPRITE_SCALE).setFlipX(faceLeft)
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
  const amar = figure("amar", AMAR_X, false);
  const them = figure(partner, PARTNER_X, true);

  // ---- the sequence ----------------------------------------------------
  scene.tweens.add({ targets: root, alpha: 1, duration: 1400, ease: "Sine.easeOut" });
  // Amar steps toward them...
  const amarCls = amar.cls as ClassKind;
  scene.time.delayedCall(1300, () => {
    if (hasUnitAnimation(amarCls, "walk")) amar.sprite.play(animKey(amarCls, "walk"));
    scene.tweens.add({
      targets: amar.box, x: AMAR_X + 56, duration: 700, ease: "Sine.easeInOut",
      onComplete: () => { if (hasUnitAnimation(amarCls, "idle")) amar.sprite.play(animKey(amarCls, "idle")); }
    });
  });
  // ...and holds it out.
  scene.time.delayedCall(2200, () => {
    const at = { x: (AMAR_X + 56 + PARTNER_X) / 2, y: 186 };
    const halo = scene.add.image(at.x, at.y, soft).setTint(0xffd890).setBlendMode(Phaser.BlendModes.ADD).setScale(0.15).setAlpha(0);
    const hand = scene.add.image(AMAR_X + 56 + 40, FEET_Y - 88, soft).setTint(0xfff0c0).setBlendMode(Phaser.BlendModes.ADD).setScale(0.08).setAlpha(0);
    root.add([halo, hand]);
    scene.tweens.add({ targets: halo, alpha: 0.7, scale: 1.05, duration: 900, ease: "Cubic.easeOut" });
    scene.tweens.add({ targets: hand, alpha: 0.9, scale: 0.16, duration: 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    if (scene.textures.exists(RING)) {
      scene.textures.get(RING).setFilter(Phaser.Textures.FilterMode.LINEAR);
      const ring = scene.add.image(at.x, at.y, RING).setScale(0.18).setAlpha(0);
      root.add(ring);
      scene.tweens.add({ targets: ring, alpha: 1, scale: 0.42, duration: 900, ease: "Back.easeOut" });
      scene.tweens.add({ targets: ring, y: at.y - 6, angle: 3, duration: 2400, delay: 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    const sparkles = scene.add.particles(at.x, at.y, dot, {
      x: { min: -90, max: 90 }, y: { min: -80, max: 80 },
      lifespan: { min: 600, max: 1400 }, scale: { start: 0.35, end: 0 },
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
    scene.tweens.add({ targets: them.box, y: FEET_Y - 10, duration: 150, yoyo: true, repeat: 1, ease: "Sine.easeOut" });
  });

  return { root };
};
