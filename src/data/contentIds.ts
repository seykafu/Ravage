// Central ID registry for content authoring.
//
// Every cross-file string identifier in the game's content layer (battle ids,
// story-arc ids, backdrop selectors, post-arc routing refs) is defined here
// as a discriminated string-literal union. Once a field is typed against one
// of these unions, TypeScript catches stale references at compile time
// instead of letting them die silently at runtime.
//
// **When adding new content, ADD THE ID HERE FIRST.** The compiler will then
// walk you through every file that needs a corresponding entry — battles.ts,
// beats.ts, the route refs in another arc's `next`, etc. — and refuse to
// build until they all exist.

// ---- Battles --------------------------------------------------------------
// Must stay in sync with the entries in src/data/battles.ts. The BattleNode
// definition uses `Record<BattleId, ...>`-shaped checks so a missing entry
// fails type-check the moment the union is wider than the data.
export type BattleId =
  | "b01_palace_coup"
  | "b02_farmland"
  | "b03_dawn_bandits"
  | "b04_swamp"
  | "b05_mountain_ndari"
  | "b06_caravan"
  | "b07_monastery"
  | "b08_orinhal"
  | "b09_ravine"
  | "b10_leaving_thuling"
  | "b11_cliffs"
  | "b12_ravage"
  | "b13_dawn_rebellion"
  | "b14_origin"
  | "b15_inner_coup"
  | "b16_proposal"
  | "b17_lie"
  | "b18_choosing"
  | "b19_archbold_or_anthros"
  | "b20_kingdom"
  | "b21_final_boss";

// ---- Story arcs -----------------------------------------------------------
// Must stay in sync with the keys of ARCS in src/story/beats.ts. Currently
// covers the playable vertical-slice arcs (chapters 1–5):
//
//   cold_open_dawn → pre_palace → b01 → post_palace → thuling_arrival
//     → b02 → post_farmland → before_dawn_bandits → b03 → post_dawn_bandits
//     → before_swamp → b04 → post_swamp → before_mountain → b05 → post_mountain
//     → credits
export type ArcId =
  | "cold_open_dawn"
  | "pre_palace"
  | "post_palace"
  | "thuling_arrival"
  | "post_farmland"
  | "before_dawn_bandits"
  | "post_dawn_bandits"
  | "before_swamp"
  | "post_swamp"
  | "before_mountain"
  | "post_mountain";

// ---- Backdrops ------------------------------------------------------------
// `bg_<label>` selector strings used by BattleNode.backdropKey. The mapping
// from BackdropKey to the procedural spec object lives next to BACKDROPS in
// src/art/BackdropArt.ts (BACKDROP_KEY_TO_SPEC). The `bg_` prefix exists so
// the same string can double as the Phaser texture cache key for the
// generated/loaded image.
export type BackdropKey =
  | "bg_palace_coup"
  | "bg_thuling"
  | "bg_farmland"
  | "bg_mountain"
  | "bg_swamp"
  | "bg_caravan"
  | "bg_monastery"
  | "bg_orinhal"
  | "bg_cliffs"
  | "bg_grude"
  | "bg_finalBoss";

// ---- Story-arc routing ---------------------------------------------------
// Where a StoryArc.next sends the player after its last beat. Discriminated
// by prefix:
//   "story:<ArcId>"   — chain into another arc
//   "prep:<BattleId>" — open the battle-prep screen for that battle
//   "credits"         — roll the credits scene
//   "overworld"       — return to the overworld map
//
// Because BattleId and ArcId are themselves typed unions, a typo like
// "prep:b04_swmap" (or pointing at a battle that doesn't exist) is a
// compile error rather than a silent fall-through to OverworldScene.
export type RouteRef =
  | `story:${ArcId}`
  | `prep:${BattleId}`
  | "credits"
  | "overworld";
