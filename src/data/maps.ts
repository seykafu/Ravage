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
// 18×14 throne hall — significantly expanded from the v1 13×9 to give
// the climactic opening battle the spatial weight the script asks for
// ("a grand, almost boss-fight encounter"). The hall is taller than
// the viewport (14 × 48 = 672px > ~588 visible), so the camera scrolls
// vertically — players see the squad at the south doors and have to
// pan up to see Nebu on the throne. Pillars in two staggered ranks
// + a third rank below break long sight lines into the throne so
// archers can't snipe across the whole map.
const _ = t("carpet");
const S = t("stone");
const P = t("stone", "pillar");
const TH = t("carpet", "throne");
const TO = t("stone", "torch");
const palaceRows = [
  [S,  S,  S,  S,  S,  P,  S,  S,  S, TH, S,  S,  S,  P,  S,  S,  S,  S ],
  [S,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  S ],
  [S,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  S ],
  [S,  P,  _,  _,  _,  _,  _,  P,  _,  _,  P,  _,  _,  _,  _,  _,  P,  S ],
  [S,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  S ],
  [S,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  S ],
  [S,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  S ],
  [S,  P,  _,  _,  _,  _,  _,  P,  _,  _,  P,  _,  _,  _,  _,  _,  P,  S ],
  [S,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  S ],
  [S,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  S ],
  [S,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  S ],
  [S,  P,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  P,  S ],
  [S,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  _,  S ],
  [TO, S,  S,  S,  S,  S,  S,  S,  S,  S,  S,  S,  S,  S,  S,  S,  S,  TO]
] as const;

export const palaceMap: MapDef = buildMap("palace_coup", "Royal Throne Hall", palaceRows, {
  // Player enters from south doors at row 13. Five-unit fan formation
  // hugs the south wall — Amar center with the originals on either side.
  player: [
    { x: 8,  y: 12 }, // Amar (center, lead)
    { x: 9,  y: 12 }, // Ranatoli (right of center)
    { x: 7,  y: 12 }, // Selene (left of center)
    { x: 10, y: 12 }, // unseen comrade right
    { x: 6,  y: 12 }  // unseen comrade left
  ],
  // Nebu on the throne at (9, 0); Royal Guards flanking him on row 1;
  // Crown Archers + a second rank of guards on rows 3–4 controlling
  // the long north-south sight lines.
  enemy: [
    { x: 9,  y: 0 },  // King Nebu on the throne
    { x: 6,  y: 1 },  // Royal Guard flanking left
    { x: 12, y: 1 },  // Royal Guard flanking right
    { x: 3,  y: 4 },  // Royal Guard mid-hall west
    { x: 14, y: 4 },  // Royal Guard mid-hall east
    { x: 6,  y: 5 },  // Crown Archer firing south
    { x: 11, y: 5 }   // Crown Archer firing south
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
// 20×13 mountain pass — expanded from the v1 14×10 to give the squad
// room to flank the elevated parapet where Ndari + the bandit speartons
// hold the high ground. The map is right at the horizontal limit of the
// viewport (20 × 48 = 960px = playW) and exceeds vertically (13 × 48 =
// 624 > ~588 visible), so the camera scrolls vertically. Trees + rocks
// scattered through rows 7–12 break up the open snow approach into
// multiple paths.
const SN = t("snow");
const SR = t("snow", "rock");
const ST = t("snow", "tree");
const SS = t("stone");
const SE = t("stone");

const mountainRows = [
  [SR, SN, SN, SN, SN, SS, SS, SS, SS, SS, SS, SS, SS, SS, SS, SN, SN, SN, SN, SR],
  [SN, SN, SN, SN, SS, SS, SE, SS, SS, SS, SE, SS, SS, SS, SE, SS, SN, SN, SN, SN],
  [SN, ST, SN, SS, SE, SE, SE, SE, SE, SE, SE, SE, SE, SE, SE, SE, SS, SN, ST, SN],
  [SN, SN, SN, SS, SE, SE, SE, SE, SE, SE, SE, SE, SE, SE, SE, SE, SS, SN, SN, SN],
  [SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN],
  [SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN],
  [SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN],
  [SN, ST, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, ST, SN],
  [SN, SN, SR, SN, SN, ST, SN, SN, ST, SN, SN, ST, SN, SN, SR, SN, SN, SR, SN, SN],
  [SN, SN, SN, SR, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SR, SN, SR, SN, SN, SN],
  [SR, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SN, SR],
  [SN, SN, SR, SN, SN, SN, SN, ST, SN, SN, SN, ST, SN, SN, SN, SN, SR, SN, SN, SN],
  [SR, SN, SN, SR, SN, SR, SN, SN, SR, SN, SN, SN, SR, SN, SR, SN, SN, SR, SN, SR]
] as const;

export const mountainMap: MapDef = buildMap("mountain_pass", "Ravaged Mountain Village", mountainRows, {
  // Squad spread along the south snow line (row 12) — wide enough to
  // pick a flanking approach via the gaps in the tree/rock obstacles
  // in rows 7–11.
  player: [
    { x: 4,  y: 12 },
    { x: 7,  y: 12 },
    { x: 10, y: 12 },
    { x: 13, y: 12 },
    { x: 16, y: 12 }
  ],
  // Ndari + flanking speartons on the stone parapet (row 1); 2 swordsmen
  // at the parapet edge (row 3); 2 archers in the open mid-pass (row 5)
  // ranging on the squad's south approach.
  enemy: [
    { x: 10, y: 1 }, // Ndari on the parapet, dead center
    { x: 7,  y: 1 }, // bandit spearton flanking left
    { x: 13, y: 1 }, // bandit spearton flanking right
    { x: 5,  y: 3 }, // bandit swordsman west edge
    { x: 15, y: 3 }, // bandit swordsman east edge
    { x: 8,  y: 5 }, // bandit archer mid-pass
    { x: 12, y: 5 }  // bandit archer mid-pass
  ]
});

// ============== Battle 6 — The Caravan ==============
// 13×9 canyon road. The middle three rows (3–5) are the dirt road the
// caravan is travelling east → west; the top three rows (0–2) are the
// north canyon shelf where archers perch behind rock cover; the bottom
// three rows (6–8) mirror it. Two wagons block the middle of the road
// (the actual caravan being escorted) — they're treated as obstacles
// the bandits can shelter behind and the squad has to flow around.
//
// The squad enters from the west; bandits seal the east end and rain
// arrows from the perches. The script's "civilian drivers" aren't
// modeled mechanically (no ally faction yet); the wagons being
// preserved is the narrative payoff for routing the bandits.
const Sn = t("stone");
const SnR = t("stone", "rock");

const caravanRows = [
  [Sn,  Sn,  SnR, Sn,  Sn,  Sn,  Sn,  Sn,  Sn,  SnR, Sn,  Sn,  Sn ],
  [Sn,  SnR, Sn,  Sn,  Sn,  SnR, Sn,  Sn,  SnR, Sn,  Sn,  SnR, Sn ],
  [Sn,  Sn,  Sn,  Sn,  Sn,  Sn,  Sn,  Sn,  Sn,  Sn,  Sn,  Sn,  Sn ],
  [Di,  Di,  Di,  Di,  Di,  Di,  Di,  Di,  Di,  Di,  Di,  Di,  Di ],
  [Di,  Di,  Di,  Di,  Di,  Wg,  Di,  Di,  Wg,  Di,  Di,  Di,  Di ],
  [Di,  Di,  Di,  Di,  Di,  Di,  Di,  Di,  Di,  Di,  Di,  Di,  Di ],
  [Sn,  Sn,  Sn,  Sn,  Sn,  Sn,  Sn,  Sn,  Sn,  Sn,  Sn,  Sn,  Sn ],
  [Sn,  SnR, Sn,  Sn,  SnR, Sn,  Sn,  SnR, Sn,  Sn,  SnR, Sn,  Sn ],
  [Sn,  Sn,  SnR, Sn,  Sn,  Sn,  Sn,  Sn,  Sn,  SnR, Sn,  Sn,  Sn ]
] as const;

export const caravanMap: MapDef = buildMap("caravan", "Foothill Canyon Road", caravanRows, {
  // Squad enters from the west, formation tight on the road.
  player: [
    { x: 1, y: 4 }, // Amar (lead)
    { x: 0, y: 4 }, // Lucian (anchor)
    { x: 1, y: 3 }, // Ning (north flank — has bowline up the perch)
    { x: 1, y: 5 }, // Maya (south flank — the script's "took command of one flank")
    { x: 2, y: 4 }  // Leo (mounted, can swing wide either way)
  ],
  // Eight bandits — coordinated ambush per the script. Two perched
  // archers each on the N and S shelves; two speartons sealing the east
  // end of the road; two swordsmen pressing west from the road itself.
  enemy: [
    { x: 4, y: 1 },  // North-shelf archer (advance west to engage)
    { x: 9, y: 1 },  // North-shelf archer
    { x: 4, y: 7 },  // South-shelf archer
    { x: 9, y: 7 },  // South-shelf archer
    { x: 12, y: 4 }, // Spearton sealing east entrance
    { x: 11, y: 5 }, // Spearton sealing east
    { x: 11, y: 3 }, // Swordsman pressing west
    { x: 10, y: 4 }  // Swordsman pressing west
  ]
});

// ============== Battle 7 — The Ghost from Para (monastery) ==============
// 16×15 abandoned monastery — expanded from the v1 12×10 to give the
// "climb up to the bell tower" arc the vertical real estate the script
// describes. Five rooms now stack vertically: vestibule (row 14, squad
// entry) → outer chapel (rows 9–12) → middle chamber (rows 5–8) →
// inner sanctum (rows 1–4) → bell tower altar (row 0). Each room is
// separated by a pillar wall with a single gap that the squad must
// push through under fire from the next room. The map exceeds the
// viewport vertically (15 × 48 = 720 > ~588 visible) so the camera
// scrolls — the player sees Selene at the top only after a few moves
// of advance.
const PP = t("stone", "pillar");
const Th = t("stone", "throne");

const monasteryRows = [
  [Sn, Sn, PP, Sn, Sn, Sn, Sn, Th, Sn, Sn, Sn, Sn, Sn, PP, Sn, Sn], // ← bell tower altar
  [Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn],
  [Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn],
  [Sn, Sn, PP, PP, PP, Sn, Sn, Sn, Sn, Sn, Sn, PP, PP, PP, Sn, Sn], // ← inner sanctum wall (gap rows 5–10)
  [Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn],
  [Sn, PP, Sn, Sn, PP, Sn, Sn, Sn, Sn, Sn, Sn, PP, Sn, Sn, PP, Sn], // ← middle-chamber pillar funnel
  [Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn],
  [Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn],
  [Sn, Sn, PP, PP, PP, Sn, Sn, Sn, Sn, Sn, Sn, PP, PP, PP, Sn, Sn], // ← middle-chamber north wall
  [Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn],
  [Sn, PP, Sn, Sn, PP, Sn, Sn, Sn, Sn, Sn, Sn, PP, Sn, Sn, PP, Sn], // ← outer-chapel pillar funnel
  [Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn],
  [Sn, Sn, PP, PP, PP, Sn, Sn, Sn, Sn, Sn, Sn, PP, PP, PP, Sn, Sn], // ← outer-chapel south wall
  [Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn],
  [Sn, Sn, PP, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, Sn, PP, Sn, Sn]  // ← vestibule (squad spawns here)
] as const;

export const monasteryMap: MapDef = buildMap("monastery", "Abandoned Monastery", monasteryRows, {
  // Squad breaches from the south at the vestibule. Leo at the rear
  // because his mount can't push through the narrowest pillar gaps
  // until the front line clears them.
  player: [
    { x: 7,  y: 13 }, // Amar
    { x: 8,  y: 13 }, // Lucian (per script: stays on Amar's flank)
    { x: 6,  y: 14 }, // Ning (bowline up the central nave)
    { x: 9,  y: 14 }, // Maya
    { x: 5,  y: 14 }  // Leo (rear)
  ],
  // Selene at the bell tower (north of the altar's gap). Two archers
  // perched in the inner sanctum, two swordsmen in the middle chamber,
  // one spearton anchoring the outer-chapel funnel.
  enemy: [
    { x: 7,  y: 1 },  // Selene — boss
    { x: 5,  y: 2 },  // Raider archer (inner sanctum, west)
    { x: 10, y: 2 },  // Raider archer (inner sanctum, east)
    { x: 3,  y: 6 },  // Raider swordsman (middle chamber, west)
    { x: 12, y: 6 },  // Raider swordsman (middle chamber, east)
    { x: 7,  y: 10 }  // Raider spearton (outer chapel funnel)
  ]
});
