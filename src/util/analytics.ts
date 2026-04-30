// Analytics — thin wrapper around the gtag.js snippet shipped from
// /index.html and /play/index.html. Every call is no-op'd if any of the
// following are true:
//
//   - window.gtag isn't defined (ad-blocker, script load failed, SSR-ish env)
//   - hostname is localhost / 127.0.0.1 (dev playtests don't pollute prod data)
//   - import.meta.env.DEV (defense-in-depth — same intent, build-time check)
//
// The triple-gate is intentional: the HTML snippet's hostname check stops the
// initial pageview hit, but custom events still need to be silenced if any
// of the three conditions trip independently.
//
// All public functions are typed and accept structured params so the call
// sites can't accidentally drift the schema. New events: add a new exported
// function + document the params + sprinkle the call at the right hook in
// scene code. GA4 will pick them up under "Reports → Engagement → Events"
// within ~30 minutes of first fire (no schema setup required).

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}

const isLocalHost = (): boolean => {
  if (typeof location === "undefined") return true;
  return location.hostname === "localhost" || location.hostname === "127.0.0.1";
};

const isAnalyticsActive = (): boolean => {
  if (typeof window === "undefined") return false;
  if (typeof window.gtag !== "function") return false;
  if (isLocalHost()) return false;
  if (import.meta.env.DEV) return false;
  return true;
};

// Internal one-liner. Every public tracker funnels through this so the gate
// logic only lives in one place. Errors swallowed — analytics must NEVER
// throw into gameplay code.
const event = (name: string, params: Record<string, unknown> = {}): void => {
  if (!isAnalyticsActive()) return;
  try {
    window.gtag!("event", name, params);
  } catch {
    /* analytics is best-effort; never propagate */
  }
};

// ---- Public trackers ----------------------------------------------------

// Fired once per "new game" intent — user picked a fresh slot or hit
// "New Game" from the title. Lets us see how many distinct attempts the
// vertical slice gets vs. how many people just bounce after the title.
export const trackNewGameStarted = (): void =>
  event("new_game_started", {});

// Fired when a story arc opens. arc_id matches src/data/contentIds.ts ArcId.
// Useful for measuring how far into the script the average player reaches
// (e.g., what % see post_mountain vs. cold_open_dawn).
export const trackArcStarted = (arcId: string): void =>
  event("arc_started", { arc_id: arcId });

// Fired when a battle's combat scene actually starts (not when prep opens —
// prep is the loading screen). battle_id matches src/data/contentIds.ts
// BattleId. Pairs with battle_completed to compute drop-off / abandon rates.
export const trackBattleStarted = (battleId: string): void =>
  event("battle_started", { battle_id: battleId });

// Fired when a battle resolves — victory or defeat. `rounds` is the round
// counter from Initiative when the resolution fires (so we can see if a
// battle is consistently long, indicative of pacing issues). Win rate by
// battle is the headline drop-off metric.
export const trackBattleCompleted = (
  battleId: string,
  outcome: "victory" | "defeat",
  rounds: number
): void =>
  event("battle_completed", { battle_id: battleId, outcome, rounds });

// Fired each time a player unit gains a level. Lets us see the leveling
// curve in aggregate — if everyone hits L20 by B5 the curve is too fast,
// if no one cracks L8 it's too slow.
export const trackCharacterLeveledUp = (characterId: string, newLevel: number): void =>
  event("character_leveled_up", { character_id: characterId, new_level: newLevel });

// Fired when PromotionScene applies a promotion. to_class is the new
// classKind string (e.g., "swordmaster"). Lets us confirm story-gated
// promotions are firing and roughly when in the playthrough.
export const trackCharacterPromoted = (characterId: string, toClass: string): void =>
  event("character_promoted", { character_id: characterId, to_class: toClass });
