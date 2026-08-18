import { GAME_STATE_KEY } from "./constants";
import type { Ability, ClassKind, Item, ItemKind, UnitStats } from "../combat/types";
import type { SuspendedBattle } from "../combat/Suspend";
import { createItem } from "../combat/items";
import type { SevenPath } from "../data/contentIds";

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
  // Squad-wide inventory pool. Persistent across battles. Items
  // consumed in battle are removed from the pool permanently; items
  // unused (still in a deployed character's bag at battle end) return
  // to the pool. Pre-battle the player distributes from this pool to
  // each deploying character (max 5 per character). Trades made at
  // the trading post operate on this pool. Optional for back-compat
  // with pre-inventory saves; defaultSave seeds a starter pack.
  squadInventory?: Item[];
  // Per-character assigned inventory carried forward from BattlePrep.
  // Cleared back to squadInventory after each battle resolves; this
  // field exists primarily so a player who closes the browser between
  // BattlePrep and BattleScene doesn't lose their distribution. Keyed
  // by UnitDef.id.
  assignedInventory?: Record<string, Item[]>;
  // Cumulative count of player units that have fallen across the whole
  // campaign. There is no per-unit permadeath — a fallen character is
  // back at full HP for the next battle — but the squad as a whole has
  // a hard budget of MAX_PERMITTED_DEATHS losses. The (MAX+1)th death
  // routes to the GameOverScene instead of the normal post-battle flow.
  // Counted only on victories (a defeat already loops the player back
  // through BattlePrep, so deaths in failed attempts don't accumulate).
  // Optional for back-compat with pre-lives saves; treat undefined as 0.
  squadDeaths?: number;
  // Mid-battle suspend snapshot. Written by BattleScene at every turn
  // boundary, cleared when the battle resolves or the player marches in
  // fresh from BattlePrep. Riding inside SaveState means it persists to
  // localStorage + slot cache through the existing writeSave pipeline —
  // a battle interrupted by closing the tab resumes on reopening.
  // Optional for back-compat with pre-suspend saves.
  suspendedBattle?: SuspendedBattle | null;
  // Progression as it stood at the Seven Paths fork (written when B18 is
  // completed). The another-path rewind restores THIS, so a second road
  // starts with the squad the player actually had at the fork — the
  // levels they'd earned and the items they were carrying — rather than
  // the level-20 veterans who finished the campaign.
  pathForkSnapshot?: {
    characters: Record<string, CharacterRecord>;
    squadInventory: Item[];
    takenAt: string;
  };
  // Bookkeeping — stamped by every writeSave. Used by pickFresher to
  // break ties between the slot cache and the active mirror.
  updatedAt?: string;
}

// Maximum cumulative player-unit losses tolerated across the whole
// campaign before the run ends. Exceeding this number routes the player
// to GameOverScene at the end of the offending battle. Tuned to give
// the player real room for bad reads / unlucky crit RNG across the
// 13-battle slice — 3 proved too punishing in playtest, 7 keeps the
// lives system meaningful without ending a run on a couple of swings
// of the RNG.
export const MAX_PERMITTED_DEATHS = 7;

export type SlotIndex = 1 | 2 | 3;

// Starter inventory pool for a fresh slot. Tuned so the player has
// enough to experiment with distribution + the trading post in B1's
// prep without being immediately resource-starved. 6 potions covers
// 1-2 per starting character with room left to trade for an Elixir or
// Mask. Equipment trickles in as battle rewards from B2 onward.
const starterSquadInventory = (): Item[] => [
  createItem("potion"),
  createItem("potion"),
  createItem("potion"),
  createItem("potion"),
  createItem("potion"),
  createItem("potion")
];

export const defaultSave = (): SaveState => ({
  unlockedBattles: ["b01_palace_coup"],
  completedBattles: [],
  lastBattleResult: null,
  flags: {},
  squadInventory: starterSquadInventory(),
  assignedInventory: {}
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
// loadSave / writeSave operate on the active mirror at GAME_STATE_KEY,
// and mirror into the active slot's cache. There is no remote: Ravage
// keeps every save on the player's own machine.

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
  // Stamp every write with a client-side timestamp — slot previews use it
  // to break ties between the per-slot cache and the active mirror.
  const stamped: SaveState = { ...s, updatedAt: new Date().toISOString() };
  try {
    localStorage.setItem(GAME_STATE_KEY, JSON.stringify(stamped));
  } catch (err) {
    // Surface the failure rather than swallowing it — a quota error here
    // means the player's progress just vanished and they deserve to know.
     
    console.error("[save] failed to write active mirror:", err);
    return;
  }
  // Mirror into the per-slot localStorage cache so slot previews stay
  // accurate. Wrapped in its own try/catch so a slot-cache failure
  // doesn't lose the active mirror write.
  const slot = getCurrentSlot();
  if (slot) {
    try {
      localStorage.setItem(slotLocalKey(slot), JSON.stringify(stamped));
    } catch (err) {
       
      console.error(`[save] failed to write slot ${slot} cache:`, err);
    }
  } else if (import.meta.env.DEV) {
    // Defensive: if there's no active slot at write time, the slot cache
    // never updates and SaveSlotScene later shows the slot as empty.
    // Active mirror still has the data — fetchSlotPreviews will rescue
    // it via the active-mirror fallback below — but log loudly so we
    // notice if a code path forgot to set the slot.
     
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

// ---- Lives system (campaign-wide death budget) ----------------------------

// Defensive read — undefined means "0 deaths" (pre-lives save).
export const getSquadDeaths = (s: SaveState): number => s.squadDeaths ?? 0;

// Bump the campaign-wide death counter by `count`. Pure — caller writes
// the result back. `count` is the number of player-faction units that
// fell in the just-resolved battle.
export const recordSquadDeaths = (s: SaveState, count: number): SaveState => {
  if (count <= 0) return s;
  return { ...s, squadDeaths: getSquadDeaths(s) + count };
};

// Set the tally outright. recordSquadDeaths only ever ADDS; restarting a
// chapter has to give losses BACK, refunding the failed attempt so the
// player retries with the budget they entered the chapter holding.
export const setSquadDeaths = (s: SaveState, count: number): SaveState => ({
  ...s,
  squadDeaths: Math.max(0, Math.floor(count))
});

// True when the campaign has burned through its death budget. Consumed
// by BattleScene.checkEnd post-victory to choose between EndScene and
// GameOverScene.
export const hasExceededDeathLimit = (s: SaveState): boolean =>
  getSquadDeaths(s) > MAX_PERMITTED_DEATHS;

// ---- Seven Paths (B18 divergence choice) ----------------------------------
//
// At Battle 18 ("Seven Names, One Choice") the player picks which of the
// seven philosophies Amar carries forward; the pick gates which B19 path
// opener (and, later, path climax/final) becomes playable. Stored as a
// string flag so it rides the existing save-sync path with zero schema
// change. SEVEN_PATHS_FLAG is the single canonical key — read/write only
// through these helpers so a typo can't split the value across two keys.
export const SEVEN_PATHS_FLAG = "seven_paths.choice";

// The chosen path, or null if the player hasn't reached / resolved B18 yet.
// Validates against the SevenPath union so a corrupt or hand-edited save
// can't return a bogus path the routing layer doesn't understand.
const SEVEN_PATHS: ReadonlySet<string> = new Set<SevenPath>([
  "vengeance", "restoration", "revolution", "duty", "exile", "mercy", "forgetting"
]);

export const getSevenPath = (s: SaveState): SevenPath | null => {
  const raw = s.flags[SEVEN_PATHS_FLAG];
  return typeof raw === "string" && SEVEN_PATHS.has(raw) ? (raw as SevenPath) : null;
};

// Persist the chosen path. Pure — returns a new SaveState; caller writeSave()s.
export const setSevenPath = (s: SaveState, path: SevenPath): SaveState => ({
  ...s,
  flags: { ...s.flags, [SEVEN_PATHS_FLAG]: path }
});

// Wipe the active save back to a fresh slot. Used by GameOverScene's
// "Restart" affordance so a wiped run doesn't have to navigate back
// to TitleScene + delete + recreate the slot manually. Preserves the
// slot binding (we're restarting THIS slot, not switching).
export const resetSaveSlot = (): SaveState => {
  const fresh = defaultSave();
  writeSave(fresh);
  return fresh;
};

// ---- Campaign completion + the another-path rewind -------------------------
//
// Set the moment a war path's campaign is finished (the post-credits
// epilogue victory). Permanent: it survives the rewind below, so a
// player who walks a second road never loses the record that they
// finished the first one.
export const CAMPAIGN_COMPLETE_FLAG = "campaign.completed";

// The battle whose completion is the Seven Paths fork.
export const PATH_FORK_BATTLE = "b18_path_chosen";

// Freeze progression at the fork. Called when B18 resolves; idempotent,
// so replaying B18 refreshes the snapshot rather than stacking one.
export const capturePathForkSnapshot = (s: SaveState): SaveState => ({
  ...s,
  pathForkSnapshot: {
    characters: JSON.parse(JSON.stringify(s.characters ?? {})) as Record<string, CharacterRecord>,
    squadInventory: JSON.parse(JSON.stringify(s.squadInventory ?? [])) as Item[],
    takenAt: new Date().toISOString()
  }
});

export const markCampaignComplete = (s: SaveState, path: SevenPath | null): SaveState => {
  const prior = String(s.flags[CAMPAIGN_COMPLETE_FLAG] ?? "");
  const walked = prior.split(",").filter(Boolean);
  if (path && !walked.includes(path)) walked.push(path);
  return { ...s, flags: { ...s.flags, [CAMPAIGN_COMPLETE_FLAG]: walked.join(",") } };
};

export const pathsWalked = (s: SaveState): SevenPath[] =>
  String(s.flags[CAMPAIGN_COMPLETE_FLAG] ?? "")
    .split(",")
    .filter((p): p is SevenPath => SEVEN_PATHS.has(p));

// Rewind a finished campaign to the Seven Paths fork (post-B18), so the
// player can walk a different road. Progression is DELIBERATELY kept —
// levels, promotions, inventory — because the point of a second run is
// the story you didn't see, not re-earning a curve you already beat.
//
// Pure: returns a new SaveState. Callers decide which SLOT it lands in
// (see findEmptySlot) — the finished run is never overwritten in place.
const REWIND_KEEP_THROUGH = 18;
export const rewindToPathChoice = (s: SaveState): SaveState => {
  // Everything up to and including B18 stays completed; B19+ (the path
  // openers, the war arc, the fleet arc, the epilogue) is un-walked.
  // Battle ids are `b<NN>_slug`, so the chapter number is the key —
  // read it explicitly rather than relying on string ordering.
  const keep = (id: string): boolean => {
    const n = Number.parseInt(id.slice(1, 3), 10);
    return Number.isFinite(n) && n <= REWIND_KEEP_THROUGH;
  };
  const completed = s.completedBattles.filter(keep);
  const unlocked = s.unlockedBattles.filter(keep);
  const flags = { ...s.flags };
  delete flags[SEVEN_PATHS_FLAG];
  delete flags[ROMANCE_FLAG_KEY];
  const snap = s.pathForkSnapshot;
  return {
    ...s,
    completedBattles: completed,
    unlockedBattles: unlocked.length > 0 ? unlocked : ["b01_palace_coup"],
    lastBattleResult: null,
    flags,
    assignedInventory: {},
    suspendedBattle: null,
    // Roll progression back to the fork when we have it. Saves made
    // before snapshots existed keep what they have — losing the run
    // would be worse than starting the second road over-levelled.
    characters: snap ? JSON.parse(JSON.stringify(snap.characters)) as Record<string, CharacterRecord> : s.characters,
    squadInventory: snap ? JSON.parse(JSON.stringify(snap.squadInventory)) as Item[] : s.squadInventory
  };
};

// Duplicated literal rather than an import: src/data/romance.ts imports
// contentIds which imports nothing from here, and pulling romance into
// save.ts would create a content->save->content cycle.
const ROMANCE_FLAG_KEY = "romance.partner";
// Re-exported for tests, which assert the rewind clears it.
export const ROMANCE_FLAG_TEST_KEY = ROMANCE_FLAG_KEY;

// Every occupied slot, read straight from the local cache. Synchronous
// on purpose: the title screen decides whether to offer "Another Road"
// during create(), and an async round-trip would flash the button in.
export const listLocalSlots = (): Array<{ slot: SlotIndex; save: SaveState }> => {
  const out: Array<{ slot: SlotIndex; save: SaveState }> = [];
  for (const slot of [1, 2, 3] as SlotIndex[]) {
    try {
      const raw = localStorage.getItem(slotLocalKey(slot));
      if (!raw) continue;
      out.push({ slot, save: { ...defaultSave(), ...(JSON.parse(raw) as Partial<SaveState>) } });
    } catch {
      // Unreadable slot — skip it rather than blocking the menu.
    }
  }
  return out;
};

// Saves that have passed the fork, and can therefore walk another road.
export const slotsPastThePathFork = (): Array<{ slot: SlotIndex; save: SaveState }> =>
  listLocalSlots().filter((s) => s.save.completedBattles.includes(PATH_FORK_BATTLE));

// First slot with no saved game, or null when all three are occupied.
export const findEmptySlot = (): SlotIndex | null => {
  for (const slot of [1, 2, 3] as SlotIndex[]) {
    try {
      if (!localStorage.getItem(slotLocalKey(slot))) return slot;
    } catch {
      return null;
    }
  }
  return null;
};

// Write a state into a specific slot and make it active. Used by the
// another-path flow so the second run starts in its own slot with the
// finished run left untouched.
export const writeSaveToSlot = (slot: SlotIndex, s: SaveState): void => {
  setCurrentSlot(slot);
  writeSave(s);
};

// ---- Inventory helpers ----------------------------------------------------
//
// Pure (return new SaveStates) so callers can compose without worrying
// about mutating cached references. All callers still need to writeSave
// the result.

// Read the squad inventory, returning a defensively-copied snapshot. Empty
// if the field is missing (pre-inventory save).
export const getSquadInventory = (s: SaveState): Item[] =>
  s.squadInventory ? [...s.squadInventory] : [];

// Replace the squad inventory wholesale. Used by the trading post + by
// post-battle reconciliation when items return from deployed bags to
// the pool.
export const setSquadInventory = (s: SaveState, items: Item[]): SaveState => ({
  ...s,
  squadInventory: [...items]
});

// Read a character's PRE-BATTLE assigned inventory. Empty if no
// assignment has been made yet for this character. The
// BattlePrepScene's inventory panel writes to this field via
// setAssignedInventory; BattleScene's unit-hydration path reads from
// it and falls back to [] so a character with no assignment fights
// empty-handed.
export const getAssignedInventory = (s: SaveState, characterId: string): Item[] =>
  s.assignedInventory?.[characterId] ? [...s.assignedInventory[characterId]!] : [];

export const setAssignedInventory = (
  s: SaveState,
  characterId: string,
  items: Item[]
): SaveState => ({
  ...s,
  assignedInventory: {
    ...(s.assignedInventory ?? {}),
    [characterId]: [...items]
  }
});

// Wipe assigned-inventory after battle resolves. Caller has already
// gathered survivor inventories back into squadInventory.
export const clearAssignedInventory = (s: SaveState): SaveState => ({
  ...s,
  assignedInventory: {}
});

// Cumulative count of all assigned items across all characters. Used
// by the trading post UI to show how many items are committed vs
// available in the squad pool.
export const totalAssignedCount = (s: SaveState): number => {
  const a = s.assignedInventory;
  if (!a) return 0;
  let n = 0;
  for (const id of Object.keys(a)) n += a[id]?.length ?? 0;
  return n;
};

// Tally items in the squad pool by ItemKind. Used by the trading post
// UI to show "you have 5 potions, 1 mask" at-a-glance.
export const squadInventoryCounts = (s: SaveState): Partial<Record<ItemKind, number>> => {
  const counts: Partial<Record<ItemKind, number>> = {};
  for (const it of s.squadInventory ?? []) {
    counts[it.kind] = (counts[it.kind] ?? 0) + 1;
  }
  return counts;
};

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

// Fetch all three slot previews. Ravage is a LOCAL game: saves live in
// this browser's localStorage and nowhere else, so this reads the
// per-slot caches and uses the active mirror as a rescue when a slot
// cache is missing the latest progress.
//
// Kept async because SaveSlotScene awaits it; there is simply nothing
// to await anymore.
export const fetchSlotPreviews = async (): Promise<SlotPreview[]> => {
  const slots: SlotIndex[] = [1, 2, 3];
  const resolved: Record<SlotIndex, SaveState | null> = { 1: null, 2: null, 3: null };

  for (const s of slots) resolved[s] = readSlotLocal(s);

  // Rescue: if CURRENT_SLOT_KEY names a slot, the active mirror is that
  // slot's latest state — use it when it beats the cache (covers a slot
  // cache write that was dropped, e.g. a quota hiccup).
  const activeSlot = getCurrentSlot();
  if (activeSlot) {
    try {
      const raw = localStorage.getItem(GAME_STATE_KEY);
      if (raw) {
        const active = JSON.parse(raw) as SaveState;
        resolved[activeSlot] = pickFresher(resolved[activeSlot], active);
      }
    } catch { /* ignore */ }
  }

  // Persist whatever we resolved so the next session reads it directly.
  for (const s of slots) {
    if (resolved[s]) writeSlotLocal(s, resolved[s]);
  }

  return slots.map((s) => previewFromState(s, resolved[s]));
};

// Load a slot into the active mirror so the rest of the game can read it
// via loadSave(). Folds in the active mirror when it's the same slot, in
// case the last write hadn't reached the slot cache.
export const activateSlot = async (slot: SlotIndex): Promise<SaveState> => {
  let state = readSlotLocal(slot);

  if (getCurrentSlot() === slot) {
    try {
      const raw = localStorage.getItem(GAME_STATE_KEY);
      if (raw) state = pickFresher(state, JSON.parse(raw) as SaveState);
    } catch { /* ignore */ }
  }

  if (!state) state = defaultSave();

  setCurrentSlot(slot);
  writeSlotLocal(slot, state);
  localStorage.setItem(GAME_STATE_KEY, JSON.stringify(state));
  return state;
};

// Wipe a slot.
export const deleteSlot = async (slot: SlotIndex): Promise<void> => {
  writeSlotLocal(slot, null);
  if (getCurrentSlot() === slot) setCurrentSlot(null);
};

// ---- Mid-battle suspend ------------------------------------------------------

// Stash the turn-boundary battle snapshot. Rides the normal writeSave
// pipeline (active mirror + slot cache).
export const writeSuspendedBattle = (snap: SuspendedBattle): void => {
  const s = loadSave();
  s.suspendedBattle = snap;
  writeSave(s);
};

// Drop the suspend — called when a battle resolves (EndScene/GameOver
// transition) and when the player marches into a battle fresh from
// BattlePrep. No-op (and no save churn) when nothing is suspended.
export const clearSuspendedBattle = (): void => {
  const s = loadSave();
  if (!s.suspendedBattle) return;
  s.suspendedBattle = null;
  writeSave(s);
};

// Reset the active mirror to a fresh save (used by "New Game" on a slot).
export const resetActiveSave = (): SaveState => {
  const fresh = defaultSave();
  writeSave(fresh);
  return fresh;
};
