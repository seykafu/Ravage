// Persistent player settings (audio for now). Survives across sessions via
// localStorage. The Settings scene mutates the live object via setters that
// also write to disk and apply the change to the audio system immediately.

import type Phaser from "phaser";
import { setMasterSfxVolume } from "../audio/Sfx";
import { getMusic } from "../audio/Music";

const STORAGE_KEY = "ravage:settings:v1";

export interface Settings {
  masterVol: number; // 0..1, multiplied into both music and SFX
  musicVol: number;  // 0..1
  sfxVol: number;    // 0..1
}

const DEFAULTS: Settings = {
  masterVol: 1.0,
  musicVol: 0.55, // matches MusicManager's prior default
  sfxVol: 1.0
};

let cache: Settings | null = null;

export const loadSettings = (): Settings => {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      cache = {
        masterVol: clamp01(parsed.masterVol ?? DEFAULTS.masterVol),
        musicVol: clamp01(parsed.musicVol ?? DEFAULTS.musicVol),
        sfxVol: clamp01(parsed.sfxVol ?? DEFAULTS.sfxVol)
      };
      return cache;
    }
  } catch { /* corrupt storage — fall through to defaults */ }
  cache = { ...DEFAULTS };
  return cache;
};

export const saveSettings = (s: Settings): void => {
  cache = { ...s };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
  } catch { /* private mode etc. — ignore */ }
};

// Push the current settings into the live audio system. Call once at boot,
// then again whenever the user changes a slider.
export const applySettings = (scene: Phaser.Scene, s: Settings = loadSettings()): void => {
  const effectiveMusic = s.masterVol * s.musicVol;
  const effectiveSfx = s.masterVol * s.sfxVol;
  getMusic(scene).setVolume(effectiveMusic);
  setMasterSfxVolume(effectiveSfx);
};

const clamp01 = (n: number): number => Math.max(0, Math.min(1, n));
