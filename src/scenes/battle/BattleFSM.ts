// Explicit input/turn state machine for BattleScene.
//
// Pure module — no Phaser, no DOM, no scene refs. Side effects (drawing
// overlays, animating sprites, rebuilding button rows) happen in the scene
// AFTER it observes a state change. The FSM only decides "given my current
// state and this event, what's the next state?".
//
// This replaces an earlier design where four orthogonal flags
// (`mode`, `acting`, `ended`, `inspectedUnitId`) were mutated from many
// scattered call sites. That design produced recurring bugs whenever an
// illegal combo slipped through (dead clicks after a cancel, AP refilling on
// re-selection, button handlers firing during animations, etc.). The FSM
// makes the illegal combos unrepresentable.
//
// `inspectedUnitId` is intentionally NOT part of this FSM — it's a UI display
// concern (which unit's stats to show in the side panel) that's orthogonal to
// input gating. The scene clears it at well-defined boundaries (turn change,
// targeting entry).

import type { TilePos, Unit } from "../../combat/types";

export type BattleFSMState =
  // Player turn, awaiting menu/click. Tile clicks toggle inspect/swap.
  | { tag: "idle" }
  // Move targeting active. `tiles` are the valid destinations. Click on a
  // listed tile transitions to playerAnimating; click off cancels to idle.
  | { tag: "move"; tiles: readonly TilePos[] }
  // Attack targeting active. `targets` are valid hostiles in range.
  | { tag: "attack"; targets: readonly Unit[] }
  // Roam targeting (free 1-tile move after AP=0, granted by Roam ability).
  // `tiles` are valid destinations. Cancellation must refund the free AP.
  | { tag: "roam"; tiles: readonly TilePos[] }
  // A player action animation is running. All input blocked.
  | { tag: "playerAnimating" }
  // Enemy phase: AI loop is sequencing its own actions/animations. All input
  // blocked. Internal AI animations don't change FSM state — the AI loop
  // itself owns sequencing and signals END_ENEMY_TURN when done.
  | { tag: "enemyTurn" }
  // Victory or defeat reached. Terminal — no events except ignored.
  | { tag: "ended" };

export type BattleFSMEvent =
  | { tag: "ENTER_MOVE"; tiles: readonly TilePos[] }
  | { tag: "ENTER_ATTACK"; targets: readonly Unit[] }
  | { tag: "ENTER_ROAM"; tiles: readonly TilePos[] }
  // ESC, or click off a valid target while in move/attack/roam.
  | { tag: "CANCEL_TARGETING" }
  // A valid move/attack tile was clicked — animation about to start.
  | { tag: "BEGIN_PLAYER_ACTION" }
  // Animation finished, scene wants to go back to idle (or transition into
  // the enemy turn — caller decides which event to send next based on AP).
  | { tag: "ACTION_COMPLETE" }
  | { tag: "BEGIN_ENEMY_TURN" }
  | { tag: "END_ENEMY_TURN" }
  | { tag: "BATTLE_END" };

export class BattleFSM {
  private state: BattleFSMState = { tag: "idle" };

  current(): BattleFSMState {
    return this.state;
  }

  /**
   * Attempt a transition. Returns true if the event was accepted, false if
   * the event is illegal in the current state (caller can log/ignore).
   * Callers should always check the return value when the input source is
   * untrusted (e.g., a button handler that fires after a state change).
   */
  send(event: BattleFSMEvent): boolean {
    const next = transition(this.state, event);
    if (!next) return false;
    this.state = next;
    return true;
  }

  // ---- Convenience queries used by the scene ----

  /** True when player input (tile clicks, action buttons) should be ignored. */
  isInputBlocked(): boolean {
    return (
      this.state.tag === "playerAnimating" ||
      this.state.tag === "enemyTurn" ||
      this.state.tag === "ended"
    );
  }

  /** True if any targeting overlay is currently showing. */
  isTargeting(): boolean {
    return (
      this.state.tag === "move" ||
      this.state.tag === "attack" ||
      this.state.tag === "roam"
    );
  }

  /** True for the move/roam targeting states (clicking a tile picks a tile). */
  isTargetingTiles(): boolean {
    return this.state.tag === "move" || this.state.tag === "roam";
  }

  /** True for attack targeting (clicking a tile picks a unit on it). */
  isTargetingUnits(): boolean {
    return this.state.tag === "attack";
  }

  /** True for the roam variant — used when canceling needs to refund AP. */
  isRoaming(): boolean {
    return this.state.tag === "roam";
  }

  isEnded(): boolean {
    return this.state.tag === "ended";
  }

  /** Returns the move/roam tile list, or undefined if not in those states. */
  currentTiles(): readonly TilePos[] | undefined {
    if (this.state.tag === "move" || this.state.tag === "roam") {
      return this.state.tiles;
    }
    return undefined;
  }

  /** Returns the attack target list, or undefined if not in attack state. */
  currentTargets(): readonly Unit[] | undefined {
    return this.state.tag === "attack" ? this.state.targets : undefined;
  }
}

// ---- Pure transition function ----
//
// Returns the next state, or null if the event isn't valid in the given
// state. BATTLE_END short-circuits from anywhere except `ended`. Re-entering
// targeting from another targeting state (e.g., player clicks Move then
// Attack without canceling first) is allowed — the new targeting overrides.

function transition(
  s: BattleFSMState,
  e: BattleFSMEvent
): BattleFSMState | null {
  // Terminal: ended absorbs everything.
  if (s.tag === "ended") return null;

  // Battle end is always reachable.
  if (e.tag === "BATTLE_END") return { tag: "ended" };

  switch (s.tag) {
    case "idle":
      switch (e.tag) {
        case "ENTER_MOVE":   return { tag: "move",   tiles: e.tiles };
        case "ENTER_ATTACK": return { tag: "attack", targets: e.targets };
        case "ENTER_ROAM":   return { tag: "roam",   tiles: e.tiles };
        case "BEGIN_ENEMY_TURN": return { tag: "enemyTurn" };
        // ACTION_COMPLETE from idle is a no-op (defensive — the scene's own
        // flow shouldn't emit it, but if it does it's harmless).
        case "ACTION_COMPLETE": return s;
        // CANCEL_TARGETING from idle is a no-op too.
        case "CANCEL_TARGETING": return s;
        case "BEGIN_PLAYER_ACTION": return null; // illegal: no targeting active
        case "END_ENEMY_TURN": return null;
      }
      break;

    case "move":
    case "attack":
    case "roam":
      switch (e.tag) {
        case "BEGIN_PLAYER_ACTION": return { tag: "playerAnimating" };
        case "CANCEL_TARGETING":    return { tag: "idle" };
        // Re-entering a different targeting mode overrides the current one
        // (player clicked one menu button then immediately another).
        case "ENTER_MOVE":   return { tag: "move",   tiles: e.tiles };
        case "ENTER_ATTACK": return { tag: "attack", targets: e.targets };
        case "ENTER_ROAM":   return { tag: "roam",   tiles: e.tiles };
        // Any other event from a targeting state is illegal.
        case "ACTION_COMPLETE": return null;
        case "BEGIN_ENEMY_TURN": return null;
        case "END_ENEMY_TURN": return null;
      }
      break;

    case "playerAnimating":
      switch (e.tag) {
        case "ACTION_COMPLETE":   return { tag: "idle" };
        case "BEGIN_ENEMY_TURN":  return { tag: "enemyTurn" };
        // Pointer/menu events during animation are illegal — caller's
        // isInputBlocked() guard should already drop them.
        case "ENTER_MOVE":   return null;
        case "ENTER_ATTACK": return null;
        case "ENTER_ROAM":   return null;
        case "CANCEL_TARGETING": return null;
        case "BEGIN_PLAYER_ACTION": return null;
        case "END_ENEMY_TURN": return null;
      }
      break;

    case "enemyTurn":
      switch (e.tag) {
        case "END_ENEMY_TURN":   return { tag: "idle" };
        // Sub-step animations within an enemy turn don't move us out of
        // enemyTurn — the AI loop owns sequencing and only exits via
        // END_ENEMY_TURN. Allowing these as no-ops keeps the scene's
        // animation helpers callable from both player AND enemy code paths
        // without needing two flavors.
        case "ACTION_COMPLETE":   return s;
        case "BEGIN_ENEMY_TURN":  return s; // queue advanced to next enemy
        // Player input during enemy turn is illegal.
        case "ENTER_MOVE":   return null;
        case "ENTER_ATTACK": return null;
        case "ENTER_ROAM":   return null;
        case "CANCEL_TARGETING": return null;
        case "BEGIN_PLAYER_ACTION": return null;
      }
      break;
  }

  // Inner switches above return on every event branch, so this is unreachable
  // — present only to satisfy TS's control-flow analysis with the outer
  // `break` statements.
  return null;
}
