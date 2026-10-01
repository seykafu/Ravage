// Where things stand in the camp diorama. Pure — no Phaser — and tested.
//
// World space is the camp board's, before the camera's keystone tilt: x
// across, y down the board toward the viewer. The board is a strip of
// ground the full width of the screen and a little more (so its left and
// right edges never show), its back edge just below the backdrop's
// treeline and its front a slab of earth above the bottom of the screen,
// the same object the battle board is.

export const CAMP_BOARD = {
  cols: 22,
  rows: 6,
  tileW: 64,
  tileH: 48,
  originX: -64,
  originY: 340,
  elevStep: 18,
  slabDepth: 40
} as const;

/** Camera tilt; the battle board's is 0.12. */
export const CAMP_KEYSTONE_K = 0.14;

/** The fire: centre of the pit on the ground, and how far its light reaches. */
export const FIRE = { x: 640, y: 500, radius: 430 } as const;

/** World px per art px for every camp billboard (the unit sheets' 32x40 at 64x80). */
export const ART_SCALE = 2;

export interface Slot {
  x: number;
  y: number;
  /** Facing the fire means facing left (the sheets face right). */
  faceLeft: boolean;
}

// The squad stands in a ring round the fire with its front left open, so
// the fire is never hidden from the player, and nobody stands straight
// behind the flames. Angles are on the ground: 0° to the right of the
// fire, 90° toward the viewer.
//
// Up to eight, each new arrival takes the next of these hand-placed spots
// (sides first, then the back, then the front corners), so a small squad
// looks gathered rather than spaced out on a clock face.
const INNER = { rx: 200, ry: 82 } as const;
const INNER_ANGLES = [160, 20, 215, 325, 125, 55, 250, 290];

// More than eight widen the ring and spread everyone evenly round it,
// still leaving the front open and the back of the flames clear.
const OUTER = { rx: 262, ry: 106 } as const;
const OUTER_ARC: readonly [number, number][] = [[118, 256], [284, 422]];

const at = (deg: number, r: { rx: number; ry: number }): Slot => {
  const a = (deg * Math.PI) / 180;
  const x = FIRE.x + Math.cos(a) * r.rx;
  return { x, y: FIRE.y + Math.sin(a) * r.ry, faceLeft: x > FIRE.x };
};

export const ringSlots = (count: number): Slot[] => {
  if (count <= 0) return [];
  if (count <= INNER_ANGLES.length) return INNER_ANGLES.slice(0, count).map((d) => at(d, INNER));
  const lengths = OUTER_ARC.map(([a, b]) => b - a);
  const total = lengths.reduce((s, l) => s + l, 0);
  const step = total / count;
  const out: Slot[] = [];
  for (let i = 0; i < count; i++) {
    let along = step * (i + 0.5);
    let arc = 0;
    while (along > lengths[arc]!) { along -= lengths[arc]!; arc++; }
    out.push(at(OUTER_ARC[arc]![0] + along, OUTER));
  }
  return out;
};
