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
// within ~30 minutes of first fire. Their PARAMETERS only show in reports
// once registered under Admin → Data display → Custom definitions, and
// only from that day on.

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

// Fired when battle 1 is won: the clearest sign that a visit (an ad click,
// say) turned into someone actually playing. A named event of its own,
// rather than battle_completed filtered on its parameters, so GA4 can mark
// it a key event and Google Ads can import it as a conversion as it is.
export const trackFirstBattleWon = (): void =>
  event("first_battle_won", {});

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

// ---- The front of the funnel ---------------------------------------------
// play_click (landing page) → game_ready → new_game_started →
// tutorial_step → first_battle_won. Without game_ready, someone who gave
// up on the loading bar looked the same as someone who saw the title and
// left.

// GA4 drops parameter values longer than 100 characters.
const clip = (s: string): string => (s.length > 100 ? s.slice(0, 100) : s);

let readySent = false;
// Fired once per page load, when the title screen first appears. load_ms
// is the time since the page started loading. renderer is "canvas" when
// the browser refused WebGL (main.ts falls back): the game runs, but
// without its post-FX.
export const trackGameReady = (renderer: "webgl" | "canvas"): void => {
  if (readySent) return;
  readySent = true;
  event("game_ready", { load_ms: Math.round(performance.now()), renderer });
};

// Fired when the game fails. where: "start" (the Phaser game couldn't
// be built at all), "uncaught" (an error or rejected promise nothing
// caught) or "asset" (a file the build knows exists failed to arrive).
// Capped per page load so one broken session can't flood the reports:
// a flaky connection fails file after file, so only its first asset
// failure is sent.
const ERROR_CAPS = { start: 1, uncaught: 3, asset: 1 } as const;
const errorCounts: Record<keyof typeof ERROR_CAPS, number> = { start: 0, uncaught: 0, asset: 0 };
const errorsSeen = new Set<string>();
let errorScene: () => string = () => "boot";
export const trackGameError = (where: keyof typeof ERROR_CAPS, message: string): void => {
  const key = `${where}:${message}`;
  if (errorsSeen.has(key) || errorCounts[where] >= ERROR_CAPS[where]) return;
  errorsSeen.add(key);
  errorCounts[where]++;
  let scene = "unknown";
  try { scene = errorScene(); } catch { /* keep "unknown" */ }
  event("game_error", { where, message: clip(message), scene: clip(scene) });
};

// Reports uncaught errors and rejections as game_error. getScene names
// the scenes running at the time, which is most of what makes an error
// report actionable. Call once, before the game is built.
export const installErrorReporting = (getScene: () => string): void => {
  errorScene = getScene;
  if (typeof window === "undefined") return;
  window.addEventListener("error", (e) => {
    // Errors from other origins (browser extensions, injected scripts)
    // arrive as a bare "Script error." with nothing to act on.
    if (!e.message || e.message === "Script error.") return;
    if (e.filename && !e.filename.startsWith(location.origin)) return;
    // Harmless browser chatter, not a fault in the game.
    if (e.message.includes("ResizeObserver loop")) return;
    // "TypeError: x is undefined", not the browser's "Uncaught TypeError: ...".
    trackGameError("uncaught", e.error instanceof Error ? `${e.error.name}: ${e.error.message}` : e.message);
  });
  window.addEventListener("unhandledrejection", (e) => {
    const r: unknown = e.reason;
    const name = r instanceof Error ? r.name : "";
    // Browsers refuse audio until the first click, and Phaser retries
    // after it; an interrupted play() rejects with AbortError. Neither
    // is a failure.
    if (name === "NotAllowedError" || name === "AbortError") return;
    trackGameError("uncaught", r instanceof Error ? `${r.name}: ${r.message}` : String(r));
  });
};

// Fired as each card of battle 1's tutorial appears. step is its place
// in the run (1-based), step_title its heading. The step where the count
// falls off is where new players give up. (Someone who presses "Skip
// tutorial" stops sending steps too; first_battle_won tells the two apart.)
export const trackTutorialStep = (step: number, title: string): void =>
  event("tutorial_step", { step, step_title: title });

let continuedSent = false;
// Fired once per page load when a player loads an existing save: from
// the slot picker ("slot_picker") or the title's Resume Last Slot button
// ("resume_button"). battles_won is how far that save has got;
// mid_battle is true when it was left in the middle of a fight. A
// player who comes back is the clearest sign an ad found a real one.
export const trackGameContinued = (
  via: "slot_picker" | "resume_button",
  battlesWon: number,
  midBattle: boolean
): void => {
  if (continuedSent) return;
  continuedSent = true;
  event("game_continued", { via, battles_won: battlesWon, mid_battle: midBattle });
};
