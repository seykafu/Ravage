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
  // Mirrors UnitDef.spriteClassOverride. Used post-promotion when the new
  // Tier 2 classKind doesn't have a shipped sprite folder yet — the
  // promoted unit renders with its Tier 1 sprite until proper assets ship.
  spriteClassOverride?: ClassKind;
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
  // Stamp every write with a client-side timestamp. fetchSlotPreviews uses
  // this to decide between a fresh local cache and an in-flight remote
  // (Supabase push is async and can finish AFTER the user navigates).
  const stamped: SaveState = { ...s, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(stamped));
  } catch (err) {
    // Surface the failure rather than swallowing it — a quota error here
    // means the player's progress just vanished and they deserve to know.
    // eslint-disable-next-line no-console
    console.error("[save] failed to write active mirror:", err);
    return;
  }
  // Mirror into the per-slot localStorage cache so slot previews stay
  // accurate even if the remote push fails. Wrapped in its own try/catch
  // so a slot-cache failure doesn't lose the active mirror write.
  const slot = getCurrentSlot();
  if (slot) {
    try {
      localStorage.setItem(slotLocalKey(slot), JSON.stringify(stamped));
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`[save] failed to write slot ${slot} cache:`, err);
    }
    void pushSlotRemote(slot, stamped); // fire-and-forget
  } else if (import.meta.env.DEV) {
    // Defensive: if there's no active slot at write time, the slot cache
    // never updates and SaveSlotScene later shows the slot as empty.
    // Active mirror still has the data — fetchSlotPreviews will rescue
    // it via the active-mirror fallback below — but log loudly so we
    // notice if a code path forgot to set the slot.
    // eslint-disable-next-line no-console
    console.warn("[save] writeSave: no currentSlot; only the active mirror was updated.");
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

// Compare two SaveStates and return the one that should be treated as
// authoritative. Progress monotonically increases (battles only get added,
// never removed by gameplay), so the state with more completed battles
// wins; ties break by updatedAt timestamp; missing data loses.
const pickFresher = (a: SaveState | null, b: SaveState | null): SaveState | null => {
  if (!a) return b;
  if (!b) return a;
  const ac = a.completedBattles?.length ?? 0;
  const bc = b.completedBattles?.length ?? 0;
  if (ac !== bc) return ac > bc ? a : b;
  const at = a.updatedAt ? Date.parse(a.updatedAt) : 0;
  const bt = b.updatedAt ? Date.parse(b.updatedAt) : 0;
  return bt > at ? b : a;
};

// Fetch all three slot previews. Tries Supabase first, falls back to local
// per-slot caches. Critically, NEVER lets a stale Supabase row clobber a
// fresher local cache (writeSave's remote push is async + fire-and-forget,
// so a fast-clicking player can land here before the push completes), and
// uses the active mirror (GAME_STATE_KEY) as a final rescue if the slot
// cache is somehow missing the latest progress.
export const fetchSlotPreviews = async (): Promise<SlotPreview[]> => {
  const sb = getSupabase();
  const slots: SlotIndex[] = [1, 2, 3];

  // Resolve the per-slot state by merging remote (if any) with local cache,
  // then with the active mirror as a last-resort rescue.
  const resolved: Record<SlotIndex, SaveState | null> = { 1: null, 2: null, 3: null };

  // Phase 1: pull from Supabase if configured + signed in.
  if (sb) {
    const { data: userData } = await sb.auth.getUser();
    const user = userData.user;
    if (user) {
      const { data, error } = await sb
        .from("saves")
        .select("slot, data, updated_at")
        .eq("user_id", user.id);
      if (!error && data) {
        for (const row of data) {
          const s = row.slot as SlotIndex;
          if (s !== 1 && s !== 2 && s !== 3) continue;
          resolved[s] = { ...(row.data as SaveState), updatedAt: row.updated_at as string };
        }
      }
    }
  }

  // Phase 2: fold in local caches. pickFresher ensures we never downgrade
  // progress — if the local cache has more completed battles than the
  // remote (because writeSave's push is still in flight), the local one
  // wins and we'll repush it on the next write.
  for (const s of slots) {
    const local = readSlotLocal(s);
    resolved[s] = pickFresher(resolved[s], local);
  }

  // Phase 3: rescue. If CURRENT_SLOT_KEY identifies a slot, the active
  // mirror at GAME_STATE_KEY is the latest authoritative state for that
  // slot. Use it if it beats both local + remote (catches the case where
  // writeSave stamped GAME_STATE_KEY but the slot cache write was dropped
  // for any reason).
  const activeSlot = getCurrentSlot();
  if (activeSlot) {
    try {
      const raw = localStorage.getItem(GAME_STATE_KEY);
      if (raw) {
        const active = JSON.parse(raw) as SaveState;
        const fresher = pickFresher(resolved[activeSlot], active);
        resolved[activeSlot] = fresher;
      }
    } catch { /* ignore */ }
  }

  // Phase 4: persist whatever we resolved back to local cache so the next
  // session reads the canonical state directly without needing to re-merge.
  for (const s of slots) {
    if (resolved[s]) writeSlotLocal(s, resolved[s]);
  }

  return slots.map((s) => previewFromState(s, resolved[s]));
};

// Load a specific slot into the active mirror so the rest of the game can
// read it via loadSave(). Merges remote + local cache + active mirror via
// pickFresher so an in-flight Supabase push never demotes the player's
// progress, mirroring the defensive logic in fetchSlotPreviews.
export const activateSlot = async (slot: SlotIndex): Promise<SaveState> => {
  const sb = getSupabase();
  let remote: SaveState | null = null;

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
        remote = { ...(data.data as SaveState), updatedAt: data.updated_at as string };
      }
    }
  }

  const local = readSlotLocal(slot);
  let state = pickFresher(remote, local);

  // If the same slot is currently active, the active mirror may be even
  // fresher than the slot cache (last write hadn't flushed). Fold it in.
  const currentActive = getCurrentSlot();
  if (currentActive === slot) {
    try {
      const raw = localStorage.getItem(GAME_STATE_KEY);
      if (raw) {
        const active = JSON.parse(raw) as SaveState;
        state = pickFresher(state, active);
      }
    } catch { /* ignore */ }
  }

  if (!state) state = defaultSave();

  setCurrentSlot(slot);
  writeSlotLocal(slot, state);
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
