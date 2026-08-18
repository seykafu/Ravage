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
  // B28 = the path-specific final battle. B29 = the post-credits
  // epilogue (the smallhold skirmish); the path-flavoured ending itself
  // is story, not a battle — the codas, the marriage question and the
  // credits all live in beats.ts.
  | "b28_path_final"
  | "b29_epilogue";

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
  | "post_ravine"
  // -------- B10 + B11: Leaving Thuling + The Cliffs --------
  // Mid-game pivot. Squad escapes Thuling under Kian's blockade,
  // reaches the harbor, learns the colony truth from Kian on the
  // cliffs above Madame Dawn's ship, and pays Lucian's life for the
  // crossing. Closes out the first half of the campaign.
  | "before_leaving_thuling"
  | "post_leaving_thuling"
  | "before_cliffs"
  | "post_cliffs"
  // -------- B12: The Ravage (Grude arrival) --------
  // Opens the second half. Squad arrives at Grude's east port after
  // the 14-month crossing; Archbold's interception meets them on
  // the dock; Madame Dawn finishes the colony-truth speech Kian
  // started at the cliffs.
  | "before_ravage"
  | "post_ravage"
  // -------- B13: Madame Dawn's Rebellion (Rose's death) --------
  | "before_dawn_rebellion"
  | "post_dawn_rebellion"
  // -------- B14: The Origin (Amar's parentage; the empire's first
  // retrieval attempt) --------
  | "before_origin"
  | "post_origin"
  // -------- B15: A Coup Within a Coup (Coyne the mole; Ndara
  // is left in a coma; Dawn hardens) --------
  | "before_inner_coup"
  | "post_inner_coup"
  // -------- B16: Dawn's Proposal (the throne offer; Archbold
  // switches from retrieve to kill) --------
  | "before_proposal"
  | "post_proposal"
  // -------- B17: Dawn's Lie (Khione's revelation; the break with
  // Dawn; the squad leaves Grude) --------
  | "before_lie"
  | "post_lie"
  // -------- B18: Seven Names, One Choice (the path divergence — the squad
  // is on open water; Amar finally chooses which philosophy he carries
  // forward). before_path_chosen frames the fork; post_path_chosen is the
  // beat that hands off to the ChoiceScene where the pick is committed. --------
  | "before_path_chosen"
  | "post_path_chosen"
  // -------- B19: the seven path-opener epilogues. Only the chosen path's
  // arc is ever reached in a run; each closes its opener and (for now)
  // rolls credits — the slice's seven possible endings. --------
  | "post_path_opener_vengeance"
  | "post_path_opener_restoration"
  | "post_path_opener_revolution"
  | "post_path_opener_duty"
  | "post_path_opener_exile"
  | "post_path_opener_mercy"
  | "post_path_opener_forgetting"
  // War-arc bridge: after B22 (Grude Burns), into the fleet arc.
  | "post_dawn_war"
  | "post_archbold_advances"
  | "post_grude_burns"
  // Fleet arc epilogues: B23-B28 each bridge into the next battle.
  | "post_path_climax_a"
  | "post_path_climax_b"
  | "post_fleet_arrival"
  | "post_coastal_hold"
  | "post_orbital_descent"
  | "post_path_final"
  // Post-credits epilogue (B29): the small job, and the road after it.
  | "before_epilogue"
  | "post_epilogue"
  // Campaign endings: after B29 (The Aftermath), one coda per
  // war-facing path. Exile and forgetting ended at their B19 epilogues.
  | "post_ending_vengeance"
  | "post_ending_restoration"
  | "post_ending_revolution"
  | "post_ending_duty"
  | "post_ending_mercy"
  // Romance codas. Each war path's ending routes through RomanceScene
  // (RouteRef "romance"), where the player chooses the path's woman, the
  // path's man, or no one — then one of these plays before credits.
  // Partner availability per path lives in src/data/romance.ts.
  | "wed_maya"
  | "wed_selene"
  | "wed_ning"
  | "wed_veya"
  | "wed_ndara"
  | "wed_leo"
  | "wed_corin"
  | "end_alone"
  // Shared closing arc. Every wedding coda AND end_alone route here
  // before the credits: the wedding closes Amar's story, this closes
  // everyone else's. Deliberately written partner-agnostically — each
  // companion's road has to read true whether or not Amar married them.
  | "where_they_went";

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
//   "camp"            — return to the squad's camp (the new home base)
//   "overworld"       — return to the world map directly (legacy/escape hatch;
//                       most arcs should use "camp" so the player passes
//                       through home before picking the next battle)
//
// Because BattleId and ArcId are themselves typed unions, a typo like
// "prep:b04_swmap" (or pointing at a battle that doesn't exist) is a
// compile error rather than a silent fall-through to OverworldScene.
export type RouteRef =
  | `story:${ArcId}`
  | `prep:${BattleId}`
  | "credits"
  | "camp"
  | "overworld"
  // The Seven Paths divergence. An arc ending in "choice" (post_path_chosen)
  // hands off to ChoiceScene, where the player commits to one of the seven
  // philosophies; ChoiceScene then routes to the chosen path's B19 opener.
  | "choice"
  // Per-path campaign ending. post_path_final (the B28 epilogue — the
  // fleet withdrawing) ends in "ending"; StoryScene resolves the saved
  // war path into its post_ending_* coda. Static next fields can't
  // branch, so the one arc every war path shares routes dynamically.
  | "ending"
  // Post-credits: Khione's invitation to walk one of the roads not
  // taken. AnotherPathScene rewinds a copy of the finished save to the
  // B18 fork and starts it in a fresh slot. See src/scenes/AnotherPathScene.ts.
  | "another_path"
  // The marriage question. War-path ending codas (post_ending_*) hand off
  // to RomanceScene, which offers the path's two partners (one woman, one
  // man — see src/data/romance.ts) or walking on alone, then routes into
  // the matching wed_* / end_alone coda arc.
  | "romance";
