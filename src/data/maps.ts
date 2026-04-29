import type { MapDef, ObstacleKind, TerrainKind, TilePos } from "../combat/types";

const t = (terrain: TerrainKind, obstacle: ObstacleKind = "none") => ({ terrain, obstacle });

// Helper: build a rectangle map from a 2D array of cell descriptors.
const buildMap = (
  id: string,
  name: string,
  rows: ReadonlyArray<ReadonlyArray<{ terrain: TerrainKind; obstacle?: ObstacleKind }>>,
  starts: { player: TilePos[]; enemy: TilePos[]; ally?: TilePos[] }
): MapDef => {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const flat: { terrain: TerrainKind; obstacle?: ObstacleKind }[] = [];
  for (const r of rows) {
    if (r.length !== width) throw new Error(`Map ${id} row mismatch`);
    for (const c of r) flat.push(c);
  }
  return { id, name, width, height, tiles: flat, startPositions: starts };
};

// ============== Battle 1 — The Palace Coup ==============
// 13×9 throne room: carpet aisle, pillars, throne at far end.
const _ = t("carpet");
const S = t("stone");
const P = t("stone", "pillar");
const TH = t("carpet", "throne");
const TO = t("stone", "torch");
const palaceRows = [
  [S, S, P, S, S, S, TH, S, S, S, P, S, S],
  [S, _, _, _, _, _, _, _, _, _, _, _, S],
  [S, _, _, _, _, _, _, _, _, _, _, _, S],
  [S, P, _, _, _, _, _, _, _, _, _, P, S],
  [S, _, _, _, _, _, _, _, _, _, _, _, S],
  [S, _, _, _, _, _, _, _, _, _, _, _, S],
  [S, P, _, _, _, _, _, _, _, _, _, P, S],
  [S, _, _, _, _, _, _, _, _, _, _, _, S],
  [TO, S, S, S, S, S, S, S, S, S, S, S, TO]
] as const;

export const palaceMap: MapDef = buildMap("palace_coup", "Royal Throne Hall", palaceRows, {
  // Player enters from south doors.
  player: [
    { x: 5, y: 8 },
    { x: 6, y: 8 },
    { x: 7, y: 8 },
    { x: 4, y: 7 },
    { x: 8, y: 7 }
  ],
  enemy: [
    { x: 6, y: 0 }, // King Nebu on throne
    { x: 4, y: 1 },
    { x: 8, y: 1 },
    { x: 2, y: 3 },
    { x: 10, y: 3 },
    { x: 5, y: 4 },
    { x: 7, y: 4 }
  ]
});

// ============== Battle 2 — Bandits in the Farmland ==============
// 12×10 farmland: open grass, hay bales, fences, two wagons.
const G = t("grass");
const H = t("grass", "hay");
const F = t("grass", "fence");
const W = t("dirt", "wagon");
const D = t("dirt");

const farmlandRows = [
  [G, G, G, G, G, G, G, G, G, G, G, G],
  [G, G, F, F, F, F, F, F, G, G, G, G],
  [G, G, G, G, G, H, G, G, G, G, G, G],
  [G, H, G, G, G, G, G, G, H, G, G, G],
  [D, D, W, D, D, D, D, D, D, W, D, D],
  [D, D, D, D, D, D, D, D, D, D, D, D],
  [G, G, H, G, G, G, G, G, H, G, G, G],
  [G, G, G, G, G, G, F, G, G, G, G, G],
  [G, G, G, G, G, G, F, G, G, G, G, G],
  [G, G, G, G, G, G, G, G, G, G, G, G]
] as const;

export const farmlandMap: MapDef = buildMap("farmland", "Thuling Farmland", farmlandRows, {
  player: [
    { x: 1, y: 9 },
    { x: 2, y: 9 },
    { x: 3, y: 9 }
  ],
  enemy: [
    { x: 8, y: 0 },
    { x: 10, y: 0 },
    { x: 5, y: 1 },
    { x: 11, y: 2 }
  ]
});

// ============== Battle 3 — Madame Dawn's Bandits ==============
// 12×9 outskirts of Thuling: a dirt road running E-W (rows 3–5) with
// open grass farms to the south (player-friendly territory) and rubble
// from a recently burned-out smallholding to the north (where the Dawn
// raiders have set up). Two derelict wagons (Wg) on the road act as
// movement blockers and force the squad to commit to one flank or the
// other. Hay bales (Hy) at the corners and the rubble field give the
// raiders' archers a few cover tiles to fire from on round 1.
//
// `Gr` (grass) is hoisted to this section because it's the first map in
// source order to use it; the swamp section below shares the const.
const Gr = t("grass");
const Di = t("dirt");
const Hy = t("grass", "hay");
const Wg = t("dirt", "wagon");
const Ru = t("rubble");
const Fn = t("grass", "fence");

const dawnBanditsRows = [
  [Gr, Gr, Hy, Gr, Ru, Gr, Gr, Ru, Gr, Hy, Gr, Gr],
  [Gr, Fn, Fn, Gr, Ru, Ru, Ru, Ru, Gr, Fn, Fn, Gr],
  [Gr, Gr, Gr, Gr, Gr, Gr, Gr, Gr, Gr, Gr, Gr, Gr],
  [Di, Di, Di, Di, Di, Di, Di, Di, Di, Di, Di, Di],
  [Di, Di, Wg, Di, Di, Di, Di, Di, Di, Wg, Di, Di],
  [Di, Di, Di, Di, Di, Di, Di, Di, Di, Di, Di, Di],
  [Gr, Gr, Gr, Gr, Gr, Gr, Gr, Gr, Gr, Gr, Gr, Gr],
  [Gr, Fn, Fn, Gr, Gr, Gr, Gr, Gr, Gr, Fn, Fn, Gr],
  [Gr, Hy, Gr, Gr, Gr, Gr, Gr, Gr, Gr, Gr, Hy, Gr]
] as const;

export const dawnBanditsMap: MapDef = buildMap("dawn_bandits", "Outskirts of Thuling", dawnBanditsRows, {
  // Squad braced south of the road, defending the farms behind them.
  // Maya enters from the east flank — narratively she "joins mid-fight"
  // (her appearance in pre-battle dialog is foreshadowed; mechanically
  // she just starts on the field separated from the main squad).
  player: [
    { x: 5, y: 7 }, // Amar
    { x: 6, y: 7 }, // Lucian
    { x: 4, y: 8 }, // Ning
    { x: 10, y: 5 } // Maya — east flank, separated
  ],
  // Five raiders in/around the rubble at the north field. Two archers
  // perched on hay/rubble for first-round shots, two swordsmen pressing
  // down the road, one spearton holding the rubble line.
  enemy: [
    { x: 5, y: 0 }, // Swordsman, north-center
    { x: 7, y: 0 }, // Swordsman
    { x: 5, y: 1 }, // Spearton in rubble cover
    { x: 4, y: 0 }, // Archer
    { x: 8, y: 0 }  // Archer
  ]
});

// ============== Battle 4 — Ambush in the Swamp ==============
// 12×9 marsh on the road home. The squad is moving through a clear lane in
// the middle (rows 3–5, cols 4–7 are open grass) when bandits burst from
// the tree-line at the four corners. Mud and water frame the playable
// area for atmosphere; the only fully blocking cover is the four FT (forest+tree)
// chokes at (2,1)/(9,1)/(2,7)/(9,7) and a few mud "puddles" mid-map that
// constrain pathing without prohibiting it. Forest tiles at the corners
// (Fo) give the ambushers a 0.90 defend bonus on round 1 — they're shooting
// from cover until the squad pushes out to engage them.
const Mu = t("mud");
const Wa = t("water");
// Gr (grass) is shared with the Battle 3 section above — declared once there.
const Fo = t("forest");
const FT = t("forest", "tree");

const swampRows = [
  [Wa, Mu, Mu, Fo, Gr, Gr, Gr, Gr, Fo, Mu, Mu, Wa],
  [Mu, Mu, FT, Gr, Gr, Gr, Gr, Gr, Gr, FT, Mu, Mu],
  [Wa, Mu, Gr, Gr, Mu, Mu, Mu, Mu, Gr, Gr, Mu, Wa],
  [Mu, Gr, Gr, Gr, Mu, Gr, Gr, Mu, Gr, Gr, Gr, Mu],
  [Mu, Gr, Gr, Gr, Gr, Gr, Gr, Gr, Gr, Gr, Gr, Mu],
  [Mu, Gr, Gr, Gr, Mu, Gr, Gr, Mu, Gr, Gr, Gr, Mu],
  [Wa, Mu, Gr, Gr, Mu, Mu, Mu, Mu, Gr, Gr, Mu, Wa],
  [Mu, Mu, FT, Gr, Gr, Gr, Gr, Gr, Gr, FT, Mu, Mu],
  [Wa, Mu, Mu, Fo, Gr, Gr, Gr, Gr, Fo, Mu, Mu, Wa]
] as const;

export const swampMap: MapDef = buildMap("swamp", "Marsh Road Ambush", swampRows, {
  // Squad walking single-file down the road, Maya scouting ahead.
  player: [
    { x: 6, y: 4 }, // Amar (center of formation)
    { x: 5, y: 4 }, // Lucian (left flank)
    { x: 7, y: 4 }, // Kian (right flank)
    { x: 6, y: 3 }, // Maya (point)
    { x: 6, y: 5 }  // Ning (rear, bow ready)
  ],
  // Six bandits ringing the squad. Speartons close on the lane, archers
  // open up from forest cover at the back corners, swordsmen flank from
  // the SW/SE corner cover. Distance from the corner forests to the squad
  // is ~6–7 tiles, so the archers spend round 1 advancing or shooting one
  // exposed scout (Maya/Ning), then settle into their effective range.
  enemy: [
    { x: 5, y: 1 }, // Spearton — north blocker
    { x: 6, y: 7 }, // Spearton — south blocker
    { x: 3, y: 0 }, // Archer in NW forest cover
    { x: 8, y: 0 }, // Archer in NE forest cover
    { x: 3, y: 8 }, // Swordsman in SW forest cover
    { x: 8, y: 8 }  // Swordsman in SE forest cover
  ]
});

// ============== Battle 5 — Mountain Bandits / Ndari ==============
// 14×10 jagged mountain pass: rocks, trees, snow patches, choke points.
const SN = t("snow");
const SR = t("snow", "rock");
const ST = t("snow", "tree");
const SS = t("stone");
const SE = t("stone");

const mountainRows = [
  [SR, SN, SN, SN, SS, SS, SS, SS, SS, SS, SN, SN, SN, SR],
  [SN, SN, SN, SS, SS, SE, SS, SS, SE, SS, SS, SN, SN, SN],
  [SN, ST, SN, SS, SE, SE, SE, SE, SE, SE, SS, SN, ST, SN],
  [SN, SN, SN, SS, SE, SE, SE, SE, SE, SE, SS, SN, SN, SN],
  [SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN],
  [SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN],
  [SN, ST, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, ST, SN],
  [SN, SN, SR, SN, SN, ST, SN, SN, ST, SN, SN, SR, SN, SN],
  [SN, SN, SN, SR, SN, SN, SN, SN, SN, SN, SR, SN, SN, SN],
  [SR, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SR]
] as const;

export const mountainMap: MapDef = buildMap("mountain_pass", "Ravaged Mountain Village", mountainRows, {
  player: [
    { x: 2, y: 9 },
    { x: 4, y: 9 },
    { x: 6, y: 9 },
    { x: 8, y: 9 },
    { x: 10, y: 9 }
  ],
  enemy: [
    { x: 7, y: 1 }, // Ndari on the parapet
    { x: 5, y: 1 },
    { x: 9, y: 1 },
    { x: 4, y: 4 },
    { x: 10, y: 4 },
    { x: 6, y: 5 },
    { x: 8, y: 5 }
  ]
});
