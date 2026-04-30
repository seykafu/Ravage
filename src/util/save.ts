import { GAME_STATE_KEY } from "./constants";
import { getSupabase } from "../auth/supabase";
import type { Ability, ClassKind, UnitStats } from "../combat/types";

// Per-character progression record. Persisted across battles. The unit's
// authored UnitDef supplies the starting baseline; once a character has
// fought at least one battle, this record is the source of truth and
// overrides factory defaults (level, current stats, post-promotion class
// + abilities). Implemented in BattleScene's unit hydration path.
//
// `stats` is the FULL stat block at the unit's current level — we don't
// reconstruct from baseline + growth rolls because growths are random and
// the rolls aren't seeded per-character. Just snapshot the current values.
export interface CharacterRecord {
  level: number;
  xp: number;
  stats: UnitStats;
  // Set after Tier 1 → Tier 2 promotion. When absent, unit uses its
  // factory-defined classKind + abilities.
  classKind?: ClassKind;
  abilities?: Ability[];
}

export interface SaveState {
  unlockedBattles: string[];
  completedBattles: string[];
  lastBattleResult: { id: string; outcome: "victory" | "defeat" } | null;
  // Light flags for the future strategic layer.
  flags: Record<string, boolean | number | string>;
  // Per-character progression keyed by UnitDef.id. Optional for
  // backward-compat with saves created before the progression system
  // landed; missing characters fall back to factory defaults the first
  // time they appear in a battle.
  characters?: Record<string, CharacterRecord>;
  // Bookkeeping (optional — only set when loaded from a remote slot).
  updatedAt?: string;
}

export type SlotIndex = 1 | 2 | 3;

export const defaultSave = (): SaveState => ({
  unlockedBattles: ["b01_palace_coup"],
  completedBattles: [],
  lastBattleResult: null,
  flags: {}
});

// --- Slot bookkeeping ---------------------------------------------------------

const CURRENT_SLOT_KEY = "ravage:current_slot:v1";

const slotLocalKey = (slot: SlotIndex): string => `${GAME_STATE_KEY}:slot${slot}`;

export const getCurrentSlot = (): SlotIndex | null => {
  const raw = localStorage.getItem(CURRENT_SLOT_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return n === 1 || n === 2 || n === 3 ? n : null;
};

export const setCurrentSlot = (slot: SlotIndex | null): void => {
  if (slot === null) {
    localStorage.removeItem(CURRENT_SLOT_KEY);
    // Also clear the active save mirror so the next session can't accidentally
    // bleed into a different slot.
    localStorage.removeItem(GAME_STATE_KEY);
    return;
  }
  localStorage.setItem(CURRENT_SLOT_KEY, String(slot));
};

// --- Sync localStorage API (the gameplay code uses these) --------------------
//
// loadSave / writeSave operate on the active mirror at GAME_STATE_KEY.
// Every writeSave fires a background push to Supabase if a slot is active.

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
    // Mirror into the per-slot localStorage cache too, so slot previews stay
    // accurate even if the remote push fails.
    const slot = getCurrentSlot();
    if (slot) {
      localStorage.setItem(slotLocalKey(slot), JSON.stringify(s));
      void pushSlotRemote(slot, s); // fire-and-forget
    }
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

// Read a character's progression record. Returns undefined if the character
// has never been persisted (first appearance — caller should use factory
// defaults and apply the catch-up rule if applicable).
export const getCharacterRecord = (s: SaveState, id: string): CharacterRecord | undefined =>
  s.characters?.[id];

// Write or update a single character's progression record. Pure — returns
// a new SaveState; caller still has to writeSave() the result.
export const setCharacterRecord = (
  s: SaveState,
  id: string,
  rec: CharacterRecord
): SaveState => ({
  ...s,
  characters: { ...(s.characters ?? {}), [id]: rec }
});

// --- Slot operations (async; used by SaveSlotScene) ---------------------------

export interface SlotPreview {
  slot: SlotIndex;
  exists: boolean;
  completedCount: number;
  lastBattleId: string | null;
  updatedAt: string | null;
}

const previewFromState = (slot: SlotIndex, s: SaveState | null): SlotPreview => {
  if (!s) return { slot, exists: false, completedCount: 0, lastBattleId: null, updatedAt: null };
  return {
    slot,
    exists: true,
    completedCount: s.completedBattles.length,
    lastBattleId: s.lastBattleResult?.id ?? null,
    updatedAt: s.updatedAt ?? null
  };
};

const readSlotLocal = (slot: SlotIndex): SaveState | null => {
  try {
    const raw = localStorage.getItem(slotLocalKey(slot));
    return raw ? (JSON.parse(raw) as SaveState) : null;
  } catch {
    return null;
  }
};

const writeSlotLocal = (slot: SlotIndex, s: SaveState | null): void => {
  if (s === null) localStorage.removeItem(slotLocalKey(slot));
  else localStorage.setItem(slotLocalKey(slot), JSON.stringify(s));
};

// Fetch all three slot previews. Tries Supabase first, falls back to local
// per-slot caches.
export const fetchSlotPreviews = async (): Promise<SlotPreview[]> => {
  const sb = getSupabase();
  const slots: SlotIndex[] = [1, 2, 3];

  if (sb) {
    const { data: userData } = await sb.auth.getUser();
    const user = userData.user;
    if (user) {
      const { data, error } = await sb
        .from("saves")
        .select("slot, data, updated_at")
        .eq("user_id", user.id);
      if (!error && data) {
        const byslot = new Map<number, { data: SaveState; updated_at: string }>();
        for (const row of data) {
          byslot.set(row.slot as number, {
            data: row.data as SaveState,
            updated_at: row.updated_at as string
          });
        }
        // Refresh local caches with whatever the server has.
        for (const s of slots) {
          const remote = byslot.get(s);
          if (remote) {
            const merged = { ...remote.data, updatedAt: remote.updated_at };
            writeSlotLocal(s, merged);
          }
        }
        return slots.map((s) => {
          const remote = byslot.get(s);
          if (remote) {
            return previewFromState(s, { ...remote.data, updatedAt: remote.updated_at });
          }
          return previewFromState(s, null);
        });
      }
    }
  }

  // Offline / no auth: read from local caches only.
  return slots.map((s) => previewFromState(s, readSlotLocal(s)));
};

// Load a specific slot into the active mirror so the rest of the game can
// read it via loadSave().
export const activateSlot = async (slot: SlotIndex): Promise<SaveState> => {
  const sb = getSupabase();
  let state: SaveState | null = null;

  if (sb) {
    const { data: userData } = await sb.auth.getUser();
    const user = userData.user;
    if (user) {
      const { data, error } = await sb
        .from("saves")
        .select("data, updated_at")
        .eq("user_id", user.id)
        .eq("slot", slot)
        .maybeSingle();
      if (!error && data) {
        state = { ...(data.data as SaveState), updatedAt: data.updated_at as string };
        writeSlotLocal(slot, state);
      }
    }
  }

  if (!state) state = readSlotLocal(slot);
  if (!state) state = defaultSave();

  setCurrentSlot(slot);
  localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
  return state;
};

// Wipe a slot (both local cache and remote row).
export const deleteSlot = async (slot: SlotIndex): Promise<void> => {
  writeSlotLocal(slot, null);
  if (getCurrentSlot() === slot) setCurrentSlot(null);
  const sb = getSupabase();
  if (!sb) return;
  const { data: userData } = await sb.auth.getUser();
  const user = userData.user;
  if (!user) return;
  await sb.from("saves").delete().eq("user_id", user.id).eq("slot", slot);
};

// Background push of a save state to its slot row. Used by writeSave().
const pushSlotRemote = async (slot: SlotIndex, s: SaveState): Promise<void> => {
  const sb = getSupabase();
  if (!sb) return;
  try {
    const { data: userData } = await sb.auth.getUser();
    const user = userData.user;
    if (!user) return;
    const payload = {
      user_id: user.id,
      slot,
      data: { ...s, updatedAt: undefined } // server stamps its own time
    };
    await sb.from("saves").upsert(payload, { onConflict: "user_id,slot" });
  } catch {
    // Never throw from a background sync — gameplay code expects writeSave to be silent.
  }
};

// Reset the active mirror to a fresh save (used by "New Game" on a slot).
export const resetActiveSave = (): SaveState => {
  const fresh = defaultSave();
  writeSave(fresh);
  return fresh;
};
