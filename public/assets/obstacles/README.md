# Obstacles — `public/assets/obstacles/`

Things that sit on top of a terrain tile — trees, rocks, fences, the throne.
The engine draws the base tile first, then composites the matching obstacle
PNG over it. Missing files fall back to the procedural painter in
`src/art/TileArt.ts`.

## Spec

| Property | Value |
|---|---|
| Dimensions | **48 × 48 px** (matches `TILE_SIZE`) |
| Format | PNG, **transparent background** |
| Style | Top-down with slight pseudo-3D bevel — light from upper-left |
| Anchor | Object sits on the **bottom edge** of the tile (where a unit's feet would land). Footprint occupies roughly the bottom 2/3; tall objects (tree, throne, pillar, torch) may extend up to the top edge but **must stay inside the 48×48 box** |
| Outline | 1px pure black silhouette outline (matches tiles + units) |

## Filenames (must match exactly — these map 1:1 to `ObstacleKind`)

| File | Obstacle | Visual cue |
|---|---|---|
| `hay.png` | Haystack | Yellow straw bundle, dark twine, soft rounded top |
| `fence.png` | Wooden fence segment | Two horizontal rails on three short posts, weathered wood |
| `wagon.png` | Cart / wagon | Wooden body with iron-rimmed wheels, peasant transport |
| `barricade.png` | Defensive barricade | Cross-braced timber with iron pins — military, hasty build |
| `pillar.png` | Stone pillar | Carved column with capital + base, palace masonry |
| `throne.png` | Throne | Tall-backed seat, deep red cushion, gold trim |
| `tree.png` | Tree (canopy view) | Round green canopy with a hint of trunk peeking out |
| `rock.png` | Boulder | Rounded grey stone, mossy on the upper-left, shadow lower-right |
| `torch.png` | Wall torch | Stone sconce with a small flame above |

## Rules

The grid renders one tile per cell at 48 × 48. Anything in the obstacle PNG
that goes *outside* the 48 × 48 box is clipped by the next tile, so:

- **Don't paint a drop shadow on the ground** — adjacent tiles already have
  shadowed edges. The obstacle should appear to sit on the tile.
- **Don't paint half on the next tile.** Trees lean inward, never over a
  neighbour. (If you want a forest look, use the `forest` *terrain* tile
  instead — those tile seamlessly.)
- **Faction-neutral.** Same haystack on a player tile or an enemy tile.
- **Light from upper-left** so highlights and shadows match the tile bevel.

## Block / cover behavior (for reference — set in `src/combat/Grid.ts`)

| Obstacle | Blocks movement | Blocks LoS | Defender bonus | Hit penalty |
|---|---|---|---|---|
| `hay` | yes | yes | 1.00 | 0 |
| `fence` | no | no | 0.85 | 10 |
| `wagon` | yes | yes | 1.00 | 0 |
| `barricade` | no | no | 0.85 | 10 |
| `pillar` | yes | yes | 1.00 | 0 |
| `throne` | no | no | 0.80 | 5 |
| `tree` | yes | yes | 1.00 | 0 |
| `rock` | yes | yes | 1.00 | 0 |
| `torch` | yes | no | 1.00 | 0 |

## Don't

- No transparency on the obstacle itself — only the background should be
  alpha 0. Hard pixel edges everywhere else.
- No animation frames — the engine doesn't tween obstacle textures.
- No grid lines, gradients, or anti-aliased outlines.
