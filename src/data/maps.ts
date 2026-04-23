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

// ============== Battle 3 — Mountain Bandits / Ndari ==============
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
