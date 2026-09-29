// The sun on the ¾ board.
//
// The board is lit from the viewer's front-left (south-west): raised tops
// catch light along their west and front edges and fall into shade on the
// east. Figures standing on it had only a round contact blob under their
// feet — lit from nowhere. A cast shadow, the figure's own silhouette laid
// on the ground and thrown away from the light, puts them IN the same
// light as the board, and it is the strongest single cue that a figure is
// standing on a surface rather than pasted over a picture.
//
// With the sun low at the front-left, shadows fall up the board to the
// north-east: behind the figures, onto open ground. (Thrown toward the
// camera they landed under each unit's own HP bar and the row in front,
// and could hardly be seen.)
//
// A silhouette is the figure's texture tinted black, squashed about a
// foot-level origin so it stays planted, and leaned over to the north-east.
// Off on dark battles, where the light is torches and there is no sun.

export interface Sun {
  /** Lean of the silhouette, degrees clockwise from upright. */
  angle: number;
  /** Length of the shadow as a fraction of the figure's height. */
  squash: number;
  /** Opacity of the shadow. */
  alpha: number;
}

export const SUN: Sun = { angle: 58, squash: 0.55, alpha: 0.32 };

/**
 * Where the feet are in a unit sheet frame, as an origin-y fraction. The
 * sheets are foot-anchored with a few rows of padding under the boots:
 * row 36 of 40 is where the figure meets the ground.
 */
export const UNIT_FOOT_ORIGIN = 0.9;

/** Lay a black silhouette of `src`'s current look on the ground. */
export const castFrom = (
  shadow: Phaser.GameObjects.Image,
  src: { scaleX: number; scaleY: number; flipX: boolean },
  sun: Sun
): void => {
  shadow.setScale(Math.abs(src.scaleX), Math.abs(src.scaleY) * sun.squash);
  shadow.setFlipX(src.flipX);
  shadow.setAngle(sun.angle);
};
