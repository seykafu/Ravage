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
// Seven Paths token. Set on save.flags["seven_paths.choice"] when the
// player picks at B18; gates which path-specific chapters are visible
// in the OverworldScene from B19 onward. See docs/RAVAGE_DESIGN.md §6.
export type SevenPath =
  | "vengeance"     // Selene's path — kill Archbold personally
  | "restoration"   // Lucian's path — rebuild Anthros as a free state
  | "revolution"    // Maya's path — burn down all kingdoms
  | "duty"          // Khonu's path — return to the army
  | "exile"         // Tev's path — leave it all behind
  | "mercy"         // Yul's path — spare what you can
  | "forgetting";   // Sera's path — let the amnesia win

export type BattleId =
  // First half — Anthros / Thuling / journey (linear; no path branching).
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
  // Grude arc — squad arrives in Grude, learns the Ravage truth, meets
  // Madame Dawn, the proposal lands, the lie comes out.
  | "b12_ravage"
  | "b13_dawn_rebellion"
  | "b14_origin"
  | "b15_inner_coup"
  | "b16_proposal"
  | "b17_lie"
  // B18 = Seven Paths divergence. Player picks Amar's stance; the
  // remaining campaign branches from here.
  | "b18_path_chosen"
  // B19 = path-specific opener. Each path has its own chapter; only the
  // chosen path's id plays in a given playthrough.
  | "b19_path_opener_vengeance"
  | "b19_path_opener_restoration"
  | "b19_path_opener_revolution"
  | "b19_path_opener_duty"
  | "b19_path_opener_exile"
  | "b19_path_opener_mercy"
  | "b19_path_opener_forgetting"
  // B20-B22 = shared mid-finale. All paths play these, but with
  // path-flavoured cutscenes (dialogue / arcs differ per path while
  // maps + win conditions stay the same — keeps authoring tractable).
  | "b20_dawn_war"
  | "b21_archbold_advances"
  | "b22_grude_burns"
  // B23-B24 = path-specific climax pair. Two unique chapters per
  // chosen path exploring that ending's specific stakes.
  | "b23_path_climax_a"
  | "b24_path_climax_b"
  // B25-B27 = shared penultimate. The Ravage fleet arrives no matter
  // which path you walked.
  | "b25_fleet_arrival"
  | "b26_coastal_hold"
  | "b27_orbital_descent"
  // B28 = path-specific final battle (one of seven distinct boss /
  // climax encounters). B29 shared cleanup. B30 = path-flavoured
  // epilogue (text + portraits; not a fight in most paths).
  | "b28_path_final"
  | "b29_aftermath"
  | "b30_epilogue";

// ---- Story arcs -----------------------------------------------------------
// Must stay in sync with the keys of ARCS in src/story/beats.ts. Currently
// covers the playable vertical-slice arcs (chapters 1–9):
//
//   cold_open_dawn → pre_palace → b01 → post_palace → thuling_arrival
//     → b02 → post_farmland → before_dawn_bandits → b03 → post_dawn_bandits
//     → before_swamp → b04 → post_swamp → before_mountain → b05 → post_mountain
//     → before_caravan → b06 → post_caravan → before_monastery → b07
//     → post_monastery → before_orinhal → b08 → post_orinhal
//     → before_ravine → b09 → post_ravine → credits
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
  | "post_mountain"
  | "before_caravan"
  | "post_caravan"
  | "before_monastery"
  | "post_monastery"
  | "before_orinhal"
  | "post_orinhal"
  | "before_ravine"
  | "post_ravine";

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
