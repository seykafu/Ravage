import type { Unit } from "./types";

// Mid-battle suspend snapshots — the data layer for "close the tab,
// come back, resume the fight".
//
// BattleScene captures a SuspendedBattle at every turn boundary
// (beginCurrentTurn) and stashes it in the SaveState, which already
// mirrors to localStorage and the per-slot cache. The
// snapshot is cleared the moment the battle resolves
// (transitionToEndScene) or the player marches in fresh from
// BattlePrep. Resuming rebuilds the exact board: units (stats AND
// live state), initiative order + cursor + round, and the
// fired-dialogue bookkeeping so story beats don't replay.
//
// Everything here is pure data-in/data-out so it can be unit-tested
// without Phaser. The one non-JSON-safe field on Unit is
// `tags?: ReadonlySet<string>` — a Set stringifies to {} — so
// serialization converts it to an array and restore rebuilds the Set.

export interface InitiativeSnapshot {
  round: number;
  cursor: number;
  orderIds: string[];
}

export interface DialogueSnapshot {
  fired: string[];
  lastSeenRound: number;
}

export type SerializedUnit = Omit<Unit, "tags"> & { tags?: string[] };

export interface SuspendedBattle {
  battleId: string;
  savedAt: string;
  units: SerializedUnit[];
  initiative: InitiativeSnapshot;
  dialogue: DialogueSnapshot;
}

// Deep-copy the unit into a JSON-safe shape. Explicit copies (not just a
// spread) so the snapshot can't alias live battle state between capture
// and the JSON.stringify inside writeSave.
export const serializeUnit = (u: Unit): SerializedUnit => ({
  ...u,
  tags: u.tags ? [...u.tags] : undefined,
  stats: { ...u.stats },
  growths: u.growths ? { ...u.growths } : undefined,
  palette: u.palette ? { ...u.palette } : undefined,
  holdPositionUntil: u.holdPositionUntil ? { ...u.holdPositionUntil } : undefined,
  abilities: u.abilities ? [...u.abilities] : undefined,
  state: {
    ...u.state,
    position: { ...u.state.position },
    inventory: u.state.inventory.map((it) => ({ ...it }))
  }
});

export const deserializeUnit = (s: SerializedUnit): Unit => ({
  ...s,
  tags: s.tags ? new Set(s.tags) : undefined,
  stats: { ...s.stats },
  growths: s.growths ? { ...s.growths } : undefined,
  palette: s.palette ? { ...s.palette } : undefined,
  holdPositionUntil: s.holdPositionUntil ? { ...s.holdPositionUntil } : undefined,
  abilities: s.abilities ? [...s.abilities] : undefined,
  state: {
    ...s.state,
    position: { ...s.state.position },
    inventory: s.state.inventory.map((it) => ({ ...it }))
  }
});
