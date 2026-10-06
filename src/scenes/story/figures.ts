import Phaser from "phaser";
import { createUnit } from "../../combat/Unit";
import type { UnitDef } from "../../combat/types";
import { ROSTER_ORDER } from "../../data/activeRoster";
import { loadSave, getCharacterRecord } from "../../util/save";
import { ensureUnitTexture, resolveSpriteClass } from "../../art/UnitArt";

// Shared by the story's staged pictures (RingTableau, Cinematics): which
// sheet a character wears, and a big soft glow.

/**
 * Which sheet a character wears now: their saved (possibly promoted)
 * class, else their own. Ndara never fought with the squad and has no
 * sheet of her own; Dawn's marshal wears the knight's.
 */
export const classOf = (scene: Phaser.Scene, id: string): string => {
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
export const ensureGlow = (scene: Phaser.Scene): string => {
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
