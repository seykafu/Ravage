# Ravage — Art Assets

This directory holds **real art** that overrides the game's procedural pixel
fallbacks. Drop a file at the right path with the right dimensions and the
manifest in `src/assets/manifest.ts` will pick it up automatically the next
time the game loads.

Nothing here is required. Every asset has a procedural fallback, so the game
runs the moment you clone it. Real assets are purely an upgrade.

## Style target

GBA-era Fire Emblem. Specifically:

- **Palette** — limited (16–32 colors per sprite max), saturated mid-tones,
  dark pure-black outlines. No gradients on sprites.
- **Resolution** — chunky pixels. We're rendering at integer scale, so do
  *not* anti-alias edges. PNGs should be exported with nearest-neighbor
  scaling preserved.
- **Lighting** — single light from upper-left, hard cel-shaded. Backdrops can
  be painterly; foreground tiles & sprites stay crisp.
- **Silhouettes** — every unit must read at 32×40 pixels. Squint test: if you
  can't tell a swordsman from an archer at thumbnail size, redo the silhouette.

## Folder layout

| Folder        | What goes here              | See README                     |
|---------------|-----------------------------|--------------------------------|
| `portraits/`  | 64×72 character portraits   | [portraits/README.md](portraits/README.md) |
| `sprites/`    | 32×40 unit animation strips | [sprites/README.md](sprites/README.md) |
| `tiles/`      | 48×48 terrain tiles         | [tiles/README.md](tiles/README.md) |
| `backdrops/`  | 1280×720 scene backgrounds  | [backdrops/README.md](backdrops/README.md) |
| `vfx/`        | Slash arcs, hit sparks      | [vfx/README.md](vfx/README.md) |
| `ui/`         | Panel, button states        | [ui/README.md](ui/README.md) |

## Format rules (apply to all)

- **PNG** with transparent background where applicable.
- **Power-of-two padding is not required** — Phaser handles arbitrary sizes.
- **No metadata** — strip color profiles. They confuse browsers and inflate
  file size. (`pngcrush -rem alla` or similar.)
- **Naming** — lowercase, snake_case for multi-word ids. Match the manifest
  exactly. Wrong filename = silent fallback to procedural.

## Adding a new asset

1. Drop the file at the path the manifest expects.
2. Reload the game. That's it. Confirm in the browser DevTools network tab
   that the file returned 200, not 404.
3. If you want to register a *new* asset that isn't in the manifest yet, edit
   `src/assets/manifest.ts` and add an entry.

## Removing or fixing an asset

If a real asset looks worse than the procedural fallback, delete the file —
the game will silently revert to the procedural version on the next reload.
