# Ravage — Procedural Art Fidelity (HD-2× track)

How the procedurally generated art is rendered at higher fidelity, and where
the quality ceiling goes next.

## What's implemented: HD-2× supersampling (SSAA)

All runtime-generated textures — unit sprites, portraits, tiles, and backdrops —
are now drawn at **2× resolution and downsampled** to their original logical
size. The result is anti-aliased, higher-fidelity art (smoother gradients,
rounder curves, cleaner edges) with **zero changes to layout or display code**,
because every texture keeps the exact dimensions it always had.

### How it works
- `src/util/constants.ts` → `ART_SCALE` (default `2`) is the single knob.
- `src/art/PixelCanvas.ts` draws into a buffer `ART_SCALE×` larger than the
  logical size, with the 2D context pre-scaled by that factor. **All existing
  generator code is unchanged** — it still draws in logical coordinates
  (`px.width` / `px.height` report logical size); the transform maps each
  logical unit onto a `scale×scale` device block.
- The `canvas` getter downsamples that high-res buffer once (smoothed) back to
  the logical dimensions, so `textures.addCanvas` receives a texture of the
  original size — just anti-aliased.
- Curves and gradients (`ctx.ellipse`, `createRadialGradient`, the sky/ridge
  loops in `BackdropArt`, the foot-shadow ellipse in `UnitArt`) are rasterised
  at the higher device resolution, so they gain genuine detail. Hand-placed 1px
  features survive downsampling at full strength (a fully-covered 2×2 block
  averages back to a solid pixel), so detail isn't lost — only jagged edges are
  smoothed.
- Global `pixelArt: true` is untouched: textures display 1:1 in the 1280×720
  scene, and the crisp FIT-upscale presentation on large monitors is preserved.

### Tuning
`ART_SCALE` sets the global factor (`1` = no supersampling, byte-identical to
pre-change output; `2` = current default, the best fidelity/cost balance;
`3`/`4` = diminishing returns, more memory + generation cost per texture).

Each generator then reads its own per-kind knob so they can be dialled
independently:

| Constant | Default | Applies to |
|---|---|---|
| `UNIT_ART_SCALE` | `1` (crisp) | unit sprites (`UnitArt`) |
| `PORTRAIT_ART_SCALE` | `ART_SCALE` (2×) | portraits (`PortraitArt`) |
| `TILE_ART_SCALE` | `ART_SCALE` (2×) | terrain + obstacle tiles (`TileArt`) |
| `BACKDROP_ART_SCALE` | `ART_SCALE` (2×) | battle/scene backdrops (`BackdropArt`) |

**Unit sprites default to crisp (scale 1).** They're tiny (32×40) hand-placed
pixel art where downsampling softens the deliberately hard edges, so they ship
byte-identical to the pre-HD output while the larger art — which has the
headroom to benefit — runs at 2× SSAA. Bump `UNIT_ART_SCALE` to `ART_SCALE`
after a visual pass if you prefer the anti-aliased look on units too.

### Cost
Generation is one-time per unique texture (cached by texture key). The transient
high-res buffer for a full-screen backdrop is 2560×1440; sprites/tiles/portraits
are negligible. No per-frame cost.

## Roadmap — beyond procedural

The manifest (`src/assets/manifest.ts`) already lets a real asset override the
procedural fallback per-id, so these are incremental, not all-or-nothing:

1. **Real class sprite sheets.** `ASSET_SPEC.unitAnim` already defines the frame
   contract (idle/walk/attack/hit/death). Register sheets per class; the
   procedural fallback retires itself.
2. **Painted backdrops** per `backdropKey` — the biggest first-impression lift.
3. **Dynamic lighting** (Phaser Light2D + normal maps) and **particle VFX** for
   crits / deaths / the Ravage state (slots reserved in `ASSET_SPEC.vfx`).
4. **3D look:** pre-render Blender models to sprite sheets from the game's fixed
   camera and feed them through the manifest (the FF-Tactics / HD-2D approach) —
   a 3D-quality result with no engine change. True 2.5D billboards in a Three.js
   scene is the natural escalation but rewrites the grid projection
   (`tileToPixel` / `screenToTile`) and should be scoped as its own prototype.
