import { GAME_STATE_KEY } from "./constants";

export interface SaveState {
  unlockedBattles: string[];
  completedBattles: string[];
  lastBattleResult: { id: string; outcome: "victory" | "defeat" } | null;
  // Light flags for the future strategic layer.
  flags: Record<string, boolean | number | string>;
}

export const defaultSave = (): SaveState => ({
  unlockedBattles: ["b01_palace_coup"],
  completedBattles: [],
  lastBattleResult: null,
  flags: {}
});

export const loadSave = (): SaveState => {
  try {
    const raw = localStorage.getItem(GAME_STATE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveState>;
    return { ...defaultSave(), ...parsed };
  } catch {
    return defaultSave();
  }
};

export const writeSave = (s: SaveState): void => {
  try {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(s));
  } catch {
    // ignore
  }
};

export const unlockBattle = (s: SaveState, id: string): SaveState => {
  if (s.unlockedBattles.includes(id)) return s;
  return { ...s, unlockedBattles: [...s.unlockedBattles, id] };
};

export const completeBattle = (s: SaveState, id: string): SaveState => {
  return {
    ...s,
    completedBattles: s.completedBattles.includes(id)
      ? s.completedBattles
      : [...s.completedBattles, id]
  };
};
