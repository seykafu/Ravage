# Tiles — `public/assets/tiles/`

Battlefield terrain tiles. Drop-in replacements for the procedural tile
painter in `src/art/TileArt.ts`.

## Spec

| Property | Value |
|---|---|
| Dimensions | **48 × 48 px** |
| Format | PNG, opaque (no transparency needed) |
| Style | Top-down, slight pseudo-3D bevel — light from upper-left |
| Edges | **Tileable on all four sides** — must seamless-tile in a 4×4 grid |

## Filenames

| File | Terrain |
|---|---|
| `grass.png` | Open grass field |
| `stone.png` | Stone floor (interiors, courtyards) |
| `wood.png` | Wooden boards (decks, floors) |
| `marble.png` | Polished marble (palace) |
| `dirt.png` | Bare earth, paths |
| `snow.png` | Snow / frost |
| `sand.png` | Desert sand / beach |
| `water.png` | Shallow water (impassable) |
| `forest.png` | Dense canopy — readable as forest from above |
| `wall.png` | Solid wall (impassable) |
| `door.png` | Door / archway |
| `rubble.png` | Broken stone |

## Bevel rules

The procedural tiles use a 1px highlight on top + left, 1px shadow on bottom
+ right. Real tiles should follow the same convention so they composite
visually with any procedural tile next to them.

```
  hilite hilite hilite hilite
  hilite ░ ░ ░ ░ ░ ░ ░ ░ ░
  hilite ░               ░
  hilite ░    body       ░
  hilite ░               ░
         ░ ░ ░ ░ ░ ░ ░ ░ ░
   shadow shadow shadow shadow
```

## Obstacles are NOT in this folder

Things that sit on top of tiles (haystacks, fences, wagons, trees, rocks,
torches, throne, pillar, barricade) are drawn procedurally on top of the
base tile. There's no manifest entry for them yet — if you want real
obstacle art, that's a separate pass.

## Don't

- Don't include a grid line — adjacent tiles already have shadows on the
  shared edge.
- Don't paint half-and-half transitions (grass-to-dirt) into a single tile.
  The map renders one terrain per cell.
- Don't make water obviously animated — the engine doesn't tween tile
  textures.
