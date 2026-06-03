import type { TilePos } from "../combat/types";

// ─────────────────────────────────────────────────────────────────────────
// Projection — the single seam that owns ALL tile ↔ world coordinate math.
//
// This is Phase 1 of the HD-2D / 2.5D track (see docs/RAVAGE_HD2D_PLAN.md
// §5). It is deliberately a *no-visual-change* refactor: the only concrete
// implementation today, OrthographicProjection, reproduces the exact pixel
// math that used to live inline in `UnitArt.tileToPixel` and
// `BattleScene.screenToTile`. The value is structural — once every call
// site goes through one interface, swapping in a tilted/dimetric (Approach
// C) or a true-3D unproject (Approach B) projection is a LOCAL change to
// this file, not a 14-site edit scattered through BattleScene.
//
// Coordinate spaces (kept rigorously distinct):
//
//   TILE   — integer grid cell {x, y}. Pure combat space. Never pixels.
//   WORLD  — pixel position in the scene's world, BEFORE the camera
//            transform. This is what Phaser GameObjects use for their
//            x/y; the camera (scroll + zoom + origin) maps world→screen.
//   SCREEN — pixel position in the backing buffer (what the pointer
//            reports). Converting SCREEN→WORLD is the camera's job
//            (`camera.getWorldPoint`), NOT this module's — so Projection
//            stays free of any Phaser dependency and remains unit-testable
//            in pure Node. The host scene composes the two:
//                screenToTile = projection.worldToTile(getWorldPoint(...))
//
// Why no Phaser import: keeping this pure means the whole projection can be
// exhaustively tested without a browser or a WebGL context — exactly the
// kind of load-bearing code that most needs deterministic tests before a
// renderer swap.
// ─────────────────────────────────────────────────────────────────────────

export interface PixelPoint {
  x: number;
  y: number;
}

export interface Projection {
  /**
   * World-space pixel CENTER of a tile. Equivalent to the legacy
   * `tileToPixel(tile, originX, originY)`.
   */
  tileToWorld(tile: { x: number; y: number }): PixelPoint;

  /**
   * Inverse of tileToWorld: a world-space pixel coordinate → the tile that
   * contains it, or null if the point is outside the grid. The caller is
   * responsible for converting SCREEN→WORLD first (via the camera) when the
   * input came from a pointer.
   */
  worldToTile(worldX: number, worldY: number): TilePos | null;

  /** Grid dimensions this projection was built for (used for bounds tests). */
  readonly gridWidth: number;
  readonly gridHeight: number;
}

// Parameters for the orthographic (screen-aligned, top-left origin)
// projection — the flat 2D look the game has always shipped with.
export interface OrthographicParams {
  /** World-pixel x of the grid's top-left corner. */
  originX: number;
  /** World-pixel y of the grid's top-left corner. */
  originY: number;
  /** Edge length of one square tile in world pixels. */
  tileSize: number;
  gridWidth: number;
  gridHeight: number;
}

/**
 * The flat, screen-aligned projection. Byte-for-byte identical to the old
 * inline math:
 *
 *   tileToWorld:  x = originX + tile.x*tileSize + tileSize/2
 *                 y = originY + tile.y*tileSize + tileSize/2
 *
 *   worldToTile:  x = floor((worldX - originX) / tileSize)
 *                 y = floor((worldY - originY) / tileSize)   (+ bounds check)
 *
 * A future ApproachC/2.5D projection would change only the basis vectors
 * here (dimetric axes, per-tile elevation offset); a true-3D projection
 * would replace worldToTile with a ray/plane intersection. Neither touches
 * any call site.
 */
export class OrthographicProjection implements Projection {
  private readonly originX: number;
  private readonly originY: number;
  private readonly tileSize: number;
  readonly gridWidth: number;
  readonly gridHeight: number;

  constructor(p: OrthographicParams) {
    this.originX = p.originX;
    this.originY = p.originY;
    this.tileSize = p.tileSize;
    this.gridWidth = p.gridWidth;
    this.gridHeight = p.gridHeight;
  }

  tileToWorld(tile: { x: number; y: number }): PixelPoint {
    return {
      x: this.originX + tile.x * this.tileSize + this.tileSize / 2,
      y: this.originY + tile.y * this.tileSize + this.tileSize / 2
    };
  }

  worldToTile(worldX: number, worldY: number): TilePos | null {
    const x = Math.floor((worldX - this.originX) / this.tileSize);
    const y = Math.floor((worldY - this.originY) / this.tileSize);
    if (x < 0 || y < 0 || x >= this.gridWidth || y >= this.gridHeight) return null;
    return { x, y };
  }
}
