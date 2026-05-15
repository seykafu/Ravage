// Cinematic post-FX pass — bloom + warm color grading + optional vignette,
// applied per-scene to the main camera.
//
// Design intent — close the visual gap between procedurally-generated 2D
// art and the "moody cinematic 2D" feel without porting off Phaser. The
// shader pass adds three subtle but compounding effects:
//
//   * Bloom: bright pixels bleed light around themselves. Sells the
//     impression that the scene is lit (vs. just colored). Tuned warm
//     by default so torch / sunset palettes feel right.
//   * Color matrix: small saturation lift + slight contrast bump. Pulls
//     the procedurally-rendered tile palettes out of the "flat" zone
//     they default to.
//   * Vignette (optional): gentle dark edges to push the eye toward the
//     action. Off by default — turn on for battle scenes only, where
//     the focal point is clear; off for camp/menus where it'd fight the
//     UI.
//
// Conservative defaults — "moody, not Instagram filter." Per-scene
// overrides exist so a sunset camp can lean warmer than a snow-pass
// fight without re-tuning the helper.
//
// Cost: ~3 fragment shader passes per frame on the main camera (one for
// bloom, one for the color matrix, optional one for the vignette).
// Negligible on any GPU that can run Phaser. The Vite build only grows
// by the lines below — Phaser's built-in pipelines are already bundled.

import Phaser from "phaser";

export interface CinematicFXOptions {
  // 0 = no bloom, 1 = default subtle, >1 = increasingly cinematic.
  // Maps to Phaser's bloom.strength + a small blurStrength uplift.
  bloomIntensity?: number;
  // Tint applied to the bloom — warm amber pulls torches + sunset
  // palettes; cool blue suits ice / night. Default is a warm cream.
  bloomColor?: number;
  // Saturation multiplier. Phaser's saturate() takes a delta (0 = none),
  // so 0.15 = "15% more saturated than source."
  saturation?: number;
  // Brightness multiplier on the color matrix. 1.0 = no change.
  brightness?: number;
  // 0 = no vignette, 0.5 = subtle, 1 = heavy dark edges.
  vignette?: number;
}

// Centralized defaults so individual scenes only need to override what
// they want to differ. Keep this list short — adding many knobs makes
// the per-scene call sites verbose.
const DEFAULTS: Required<CinematicFXOptions> = {
  bloomIntensity: 0.6,
  bloomColor: 0xfff0d0,    // warm cream — pulls torches + sunlight
  saturation: 0.12,
  brightness: 1.03,
  vignette: 0
};

// Apply the cinematic post-FX stack to a scene's main camera. Safe to
// call once per scene during create(). Calling it a second time stacks
// MORE effects (Phaser appends), so callers that swap scenes don't
// need a teardown — scene reload recreates the camera fresh.
export const applyCinematicFX = (
  scene: Phaser.Scene,
  opts: CinematicFXOptions = {}
): void => {
  const cfg = { ...DEFAULTS, ...opts };
  const cam = scene.cameras.main;

  if (cfg.bloomIntensity > 0) {
    // Phaser.FX.Bloom signature:
    //   addBloom(color?, offsetX?, offsetY?, blurStrength?, strength?, steps?)
    // We let the blur stay tight (1px offset) and modulate the visible
    // intensity through `strength`. Higher bloomIntensity → both a
    // slightly wider blur and a brighter halo.
    const blurStrength = 0.5 + cfg.bloomIntensity * 0.5;  // 0.5 → 1.0
    const strength = cfg.bloomIntensity;
    cam.postFX.addBloom(cfg.bloomColor, 1, 1, blurStrength, strength);
  }

  if (cfg.saturation !== 0 || cfg.brightness !== 1) {
    const m = cam.postFX.addColorMatrix();
    if (cfg.saturation !== 0) m.saturate(cfg.saturation);
    if (cfg.brightness !== 1) m.brightness(cfg.brightness);
  }

  if (cfg.vignette > 0) {
    // Phaser.FX.Vignette signature: addVignette(x?, y?, radius?, strength?).
    // Center at screen middle. radius = how wide the soft inner circle
    // is (smaller = tighter focal area). strength = how dark the edges
    // get. Both scale with the user-facing vignette knob.
    const radius = 0.65 - cfg.vignette * 0.15;   // 0.50 at heavy
    const strength = 0.4 + cfg.vignette * 0.4;   // 0.80 at heavy
    cam.postFX.addVignette(0.5, 0.5, radius, strength);
  }
};

// Clear the cinematic stack — used by SettingsScene if/when we add a
// "Disable cinematic FX" toggle. Doesn't currently have a call site;
// kept as a public API for future use.
export const clearCinematicFX = (scene: Phaser.Scene): void => {
  scene.cameras.main.postFX.clear();
};
