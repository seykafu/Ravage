import type { ArcId, BattleId, SevenPath } from "./contentIds";

// Post-battle story routing — which arc plays after each victory.
//
// Lived inside EndScene originally, which put the campaign's connective
// tissue somewhere the data-level integrity tests couldn't reach: eight
// endgame battles (b20, b21, b23-b28) silently fell through EndScene's
// "no arc -> camp" fallback and the story just stopped progressing after
// chapter 19. As data, the routing is now testable: campaignIntegrity
// asserts every non-terminal playable battle routes into a real arc.
//
// Both sides are typed: a stale BattleId or arc id is a compile error.
export const POST_ARC: Partial<Record<BattleId, ArcId>> = {
  b01_palace_coup: "post_palace",
  b02_farmland: "post_farmland",
  b03_dawn_bandits: "post_dawn_bandits",
  b04_swamp: "post_swamp",
  b05_mountain_ndari: "post_mountain",
  b06_caravan: "post_caravan",
  b07_monastery: "post_monastery",
  b08_orinhal: "post_orinhal",
  b09_ravine: "post_ravine",
  b10_leaving_thuling: "post_leaving_thuling",
  b11_cliffs: "post_cliffs",
  b12_ravage: "post_ravage",
  b13_dawn_rebellion: "post_dawn_rebellion",
  b14_origin: "post_origin",
  b15_inner_coup: "post_inner_coup",
  b16_proposal: "post_proposal",
  b17_lie: "post_lie",
  b18_path_chosen: "post_path_chosen",
  // B19 path openers — each routes to its own epilogue arc. The five
  // war-facing paths (vengeance/restoration/revolution/duty/mercy) roll
  // onward into B20 (Dawn's War); exile and forgetting are ENDINGS and
  // roll credits. Only the chosen path's entry is ever reached in a run.
  b19_path_opener_vengeance: "post_path_opener_vengeance",
  b19_path_opener_restoration: "post_path_opener_restoration",
  b19_path_opener_revolution: "post_path_opener_revolution",
  b19_path_opener_duty: "post_path_opener_duty",
  b19_path_opener_exile: "post_path_opener_exile",
  b19_path_opener_mercy: "post_path_opener_mercy",
  b19_path_opener_forgetting: "post_path_opener_forgetting",
  // War arc + fleet arc — every endgame battle bridges into the next
  // battle's prep through its epilogue, same cadence as the early game
  // but without overworld detours.
  b20_dawn_war: "post_dawn_war",
  b21_archbold_advances: "post_archbold_advances",
  b22_grude_burns: "post_grude_burns",
  b23_path_climax_a: "post_path_climax_a",
  b24_path_climax_b: "post_path_climax_b",
  b25_fleet_arrival: "post_fleet_arrival",
  b26_coastal_hold: "post_coastal_hold",
  b27_orbital_descent: "post_orbital_descent",
  // The campaign's final battle. post_path_final ends the war (the fleet
  // withdraws) and its next: "ending" routes to the chosen path's
  // post_ending_* coda — see StoryScene.routeNext.
  b28_path_final: "post_path_final",
  // Post-credits epilogue (reached from CreditsScene, not the unlock chain).
  b29_epilogue: "post_epilogue"
};

// The campaign's terminal battles. Exile and forgetting end at their B19
// epilogues (walking away from the war IS the ending); the five war
// paths run the full campaign to B28 (The Path Ends), whose shared
// epilogue routes into the per-path ending coda.
export const FINAL_PLAYABLE = new Set<BattleId>([
  "b19_path_opener_exile",
  "b19_path_opener_forgetting",
  "b28_path_final"
]);

// Post-battle arc for a given victory. The path parameter is kept for
// call-site stability (EndScene always has it in hand) even though the
// per-path branch now lives in post_path_final's "ending" route.
export const resolvePostArc = (battleId: BattleId, _path: SevenPath | null): ArcId | undefined => {
  return POST_ARC[battleId];
};
