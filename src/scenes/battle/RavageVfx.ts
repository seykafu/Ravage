// Ravage State VFX — proof-of-concept BattleScene extraction.
//
// Three responsibilities:
//   * Lazily build the radial-gradient aura texture (one canvas per
//     scene, cached in Phaser's texture cache).
//   * Maintain the per-unit aura sprite + pulsing tween while a unit is
//     in their Ravaged turn. Cleared the moment ravagedActive flips off.
//   * Announce the moment Ravage activates — one-shot floater + camera
//     shake + sting + log line, fired by BattleScene.beginCurrentTurn.
//
// This was the first module extracted from the 2,925-LOC BattleScene
// during the audit-driven refactor pass. Pattern used:
//   * Pure top-level functions (no class wrapper needed for state — the
//     per-unit Ravage view state lives on UnitView, which BattleScene
//     already owns).
//   * BattleScene passes the Phaser.Scene + relevant UnitView in. No
//     scene reference is held across calls.
//
// See docs/RAVAGE_DESIGN.md §3.10 for the Ravage State design rationale.

import Phaser from "phaser";
import { FAMILY_HEADING, TILE_SIZE } from "../../util/constants";
import type { Projection } from "../../render/Projection";
import { isAlive } from "../../combat/Unit";
import { sfxRavage } from "../../audio/Sfx";
import type { Unit } from "../../combat/types";

// Per-unit visual state owned by BattleScene's UnitView. Lifted here as a
// type-only export so the host scene can compose it into its UnitView
// interface without pulling in the implementation.
export interface RavageViewState {
  ravageAura?: Phaser.GameObjects.Image;
  ravageAuraTween?: Phaser.Tweens.Tween;
}

// Build (or fetch from cache) the radial-gradient aura texture. One
// canvas per scene — repeatedly calling this is O(1) after the first
// hit. Returns the texture key so the caller can `add.image(...key)`.
export const ensureRavageAuraTexture = (scene: Phaser.Scene): string => {
  const key = "ravage_aura";
  if (scene.textures.exists(key)) return key;
  const size = 96;
  const tex = scene.textures.createCanvas(key, size, size);
  if (!tex) return key;
  const ctx = tex.getContext();
  const cx = size / 2;
  const grad = ctx.createRadialGradient(cx, cx, 4, cx, cx, cx);
  grad.addColorStop(0, "rgba(255,90,80,0.85)");
  grad.addColorStop(0.45, "rgba(220,40,30,0.35)");
  grad.addColorStop(1, "rgba(120,0,0,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  tex.refresh();
  return key;
};

// Lazily build or reposition the per-unit aura. Idempotent — calling it
// repeatedly on the same Ravaged unit just keeps the aura tracking the
// sprite as it moves. Takes the BattleScene's Projection so tile→world
// placement goes through the one coordinate seam (no duplicated math).
export const refreshRavageAura = (
  scene: Phaser.Scene,
  view: RavageViewState & { sprite: Phaser.GameObjects.Sprite },
  u: Unit,
  projection: Projection
): void => {
  if (!u.state.ravagedActive || !isAlive(u)) {
    clearRavageAura(view);
    return;
  }
  const px = projection.tileToWorld(u.state.position);
  if (!view.ravageAura) {
    const key = ensureRavageAuraTexture(scene);
    const aura = scene.add.image(px.x, px.y + 4, key)
      .setOrigin(0.5)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setDepth(view.sprite.depth - 1);
    view.ravageAura = aura;
    view.ravageAuraTween = scene.tweens.add({
      targets: aura,
      alpha: { from: 0.55, to: 0.95 },
      scale: { from: 0.95, to: 1.1 },
      yoyo: true,
      repeat: -1,
      duration: 600,
      ease: "Sine.easeInOut"
    });
  } else {
    view.ravageAura.setPosition(px.x, px.y + 4);
  }
};

// Tear down the aura + its tween. Safe to call when nothing is active.
export const clearRavageAura = (view: RavageViewState): void => {
  if (view.ravageAuraTween) {
    view.ravageAuraTween.stop();
    view.ravageAuraTween = undefined;
  }
  if (view.ravageAura) {
    view.ravageAura.destroy();
    view.ravageAura = undefined;
  }
};

// One-shot announce: heavy-hit sting + camera shake + scaling floater +
// pushLog entry so the player feels the moment Ravage activates. The
// persistent aura is handled separately by refreshRavageAura.
//
// `pushLog` is passed in (rather than hard-coding the battle log API)
// so the host scene can wire whatever log surface it wants.
export const announceRavaged = (
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  unit: Unit,
  pushLog: (msg: string) => void
): void => {
  sfxRavage(); // dedicated berserk-trigger riser — no longer borrows the crit sting
  scene.cameras.main.shake(220, 0.014);
  const floater = scene.add.text(
    sprite.x, sprite.y - TILE_SIZE / 2 - 12, "RAVAGED!",
    {
      fontFamily: FAMILY_HEADING,
      fontSize: "20px",
      color: "#ff7a5a",
      stroke: "#1a0404",
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 3, color: "#000", blur: 10, fill: true }
    }
  ).setOrigin(0.5, 1).setDepth(45).setScale(0.4);
  scene.tweens.add({
    targets: floater,
    scale: { from: 0.4, to: 1.2 },
    duration: 220,
    ease: "Back.easeOut",
    onComplete: () => {
      scene.tweens.add({
        targets: floater,
        y: floater.y - 18,
        alpha: 0,
        duration: 1200,
        ease: "Sine.easeOut",
        onComplete: () => floater.destroy()
      });
    }
  });
  pushLog(`${unit.name} is RAVAGED — +50% damage, half armor, +1 MOV this turn.`);
};
