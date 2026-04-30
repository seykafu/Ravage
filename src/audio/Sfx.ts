import Phaser from "phaser";

// Procedurally generated SFX via WebAudio. Cheap and self-contained — no audio asset needed.
//
// Routing: every sound's gain feeds into a shared MASTER gain node, which
// feeds the destination. The Settings UI manipulates the master gain to
// scale all SFX uniformly without touching individual call sites.

let ctxRef: AudioContext | null = null;
let masterGain: GainNode | null = null;
let masterVolume = 1.0;

const audioCtx = (): AudioContext => {
  if (!ctxRef) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctxRef = new AC();
  }
  return ctxRef!;
};

const sfxBus = (): GainNode => {
  if (!masterGain) {
    const ctx = audioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = masterVolume;
    masterGain.connect(ctx.destination);
  }
  return masterGain!;
};

export const setMasterSfxVolume = (v: number): void => {
  masterVolume = Math.max(0, Math.min(1, v));
  if (masterGain) masterGain.gain.value = masterVolume;
};

const beep = (
  freq: number,
  duration: number,
  type: OscillatorType,
  vol: number,
  attack = 0.01,
  release = 0.05
): void => {
  const ctx = audioCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(sfxBus());
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + attack);
  gain.gain.setValueAtTime(vol, now + duration - release);
  gain.gain.linearRampToValueAtTime(0, now + duration);
  osc.start(now);
  osc.stop(now + duration);
};

const noiseBurst = (duration: number, vol: number, filterFreq = 1500): void => {
  const ctx = audioCtx();
  const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.value = vol;
  src.connect(filter);
  filter.connect(gain);
  gain.connect(sfxBus());
  const now = ctx.currentTime;
  gain.gain.setValueAtTime(vol, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  src.start(now);
  src.stop(now + duration);
};

export const sfxClick = (): void => beep(720, 0.06, "square", 0.06, 0.005, 0.02);
export const sfxHover = (): void => beep(540, 0.04, "triangle", 0.04, 0.002, 0.02);
export const sfxConfirm = (): void => {
  beep(660, 0.08, "triangle", 0.06);
  setTimeout(() => beep(990, 0.07, "triangle", 0.05), 60);
};
export const sfxCancel = (): void => beep(220, 0.10, "sawtooth", 0.05);
export const sfxStep = (): void => beep(140, 0.06, "sine", 0.04, 0.005, 0.04);
export const sfxAttackHit = (): void => {
  noiseBurst(0.12, 0.18, 1800);
  setTimeout(() => beep(180, 0.06, "square", 0.08), 30);
};
export const sfxAttackMiss = (): void => {
  noiseBurst(0.10, 0.10, 4000);
};
export const sfxCrit = (): void => {
  noiseBurst(0.14, 0.22, 2400);
  setTimeout(() => {
    beep(880, 0.10, "square", 0.10);
    beep(1320, 0.10, "square", 0.08);
  }, 40);
};
export const sfxStance = (): void => {
  beep(440, 0.10, "triangle", 0.06);
  setTimeout(() => beep(660, 0.10, "triangle", 0.06), 80);
};
export const sfxDeath = (): void => {
  beep(220, 0.20, "sawtooth", 0.12, 0.01, 0.15);
  setTimeout(() => beep(110, 0.30, "sawtooth", 0.08, 0.01, 0.25), 100);
};
export const sfxVictory = (): void => {
  const notes = [523, 659, 784, 1046];
  notes.forEach((n, i) => setTimeout(() => beep(n, 0.20, "triangle", 0.08), i * 100));
};
export const sfxDefeat = (): void => {
  const notes = [392, 330, 262, 196];
  notes.forEach((n, i) => setTimeout(() => beep(n, 0.30, "sawtooth", 0.08), i * 150));
};
// Brief two-note ascending "ding" for XP awards. Triangle waves so it sits
// brighter than action SFX (which use square/sawtooth) and reads as
// reward/positive feedback rather than impact. Pitched high (A5 → E6) and
// kept short so it doesn't crowd the post-kill audio (sfxDeath fires first).
export const sfxXpGain = (): void => {
  beep(880, 0.06, "triangle", 0.05, 0.005, 0.04);
  setTimeout(() => beep(1320, 0.08, "triangle", 0.05, 0.005, 0.05), 50);
};

export const sfxPageTurn = (): void => {
  noiseBurst(0.10, 0.07, 3500);
};

// Resume audio on first user gesture (browser policy).
let unlocked = false;
export const unlockAudio = (): void => {
  if (unlocked) return;
  audioCtx().resume().catch(() => {});
  unlocked = true;
};

export const installAudioUnlock = (scene: Phaser.Scene): void => {
  const handler = (): void => unlockAudio();
  scene.input.once("pointerdown", handler);
  scene.input.keyboard?.once("keydown", handler);
};
