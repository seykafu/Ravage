import Phaser from "phaser";
import { RENDER_CAP_KEY, RENDER_SCALE } from "./constants";

// A frame-rate watchdog for the scaled-up render buffer.
//
// RENDER_SCALE matches the window's size (constants.ts), but a weak GPU on a
// big or high-DPI screen can still fall behind at that size. Battles are
// the heaviest thing the game draws (the board's tilt and bloom passes run
// over the whole buffer), so the first 20 seconds of one decide: if the
// frame rate averaged under ~55fps, the next session renders a quarter
// step smaller (never below 1x). The buffer size can't change while the
// game runs, so this only ever lowers the cap for later; it never raises
// it, and `?rs=` on the URL still overrides it for a session.

const SAMPLE_MS = 20_000;
const MIN_FPS = 55;

export const watchBattleFrames = (scene: Phaser.Scene): void => {
  if (RENDER_SCALE <= 1) return;
  let last = performance.now();
  let frames = 0;
  let time = 0;
  const onUpdate = (): void => {
    const now = performance.now();
    const dt = now - last;
    last = now;
    // Tab switches, dialogs and dev pauses aren't the GPU's fault.
    if (dt > 250) return;
    frames++;
    time += dt;
    if (time < SAMPLE_MS) return;
    scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate);
    const fps = (frames * 1000) / time;
    if (fps >= MIN_FPS) return;
    const cap = Math.max(1, RENDER_SCALE - 0.25);
    try {
      localStorage.setItem(RENDER_CAP_KEY, String(cap));
    } catch { /* storage blocked: stay at this scale */ }
    console.info(`[render] battle ran ${fps.toFixed(0)}fps at ${RENDER_SCALE}x; next session renders at ${cap}x`);
  };
  scene.events.on(Phaser.Scenes.Events.UPDATE, onUpdate);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.events.off(Phaser.Scenes.Events.UPDATE, onUpdate));
};
