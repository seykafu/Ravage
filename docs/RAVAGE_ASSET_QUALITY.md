# Ravage — Visual Fidelity & 3D Exploration

A grounded look at how to make Ravage *show* in higher quality, written against
the pipeline that actually exists today. Nothing here requires a rewrite — the
manifest already supports dropping in better assets one ID at a time.

## 1. Where we are today

- **Renderer:** Phaser 3, `Phaser.WEBGL`, fixed `1280×720` canvas with
  `Scale.FIT` + center (`src/main.ts`).
- **Render flags:** `pixelArt: true`, `roundPixels: true`, `antialias: false`
  — i.e. nearest-neighbor scaling, the classic crisp-pixel look.
- **Art source:** everything except music and the named-character portraits is
  generated procedurally at runtime via offscreen Canvas
  (`src/art/*` → `PixelCanvas`, `UnitArt`, `PortraitArt`, `TileArt`,
  `BackdropArt`, `CinematicFX`).
- **Asset sizes** (`src/assets/manifest.ts` → `ASSET_SPEC`):
  - unit sprites `32×40`, single static frame (anim strips speced but mostly
    procedural)
  - portraits `64×72`
  - tiles `48×48`
  - backdrops `1280×720`
- **The escape hatch already exists:** every art helper consults the manifest
  first and only falls back to procedural generation if no real file is
  registered. So fidelity can be raised **incrementally and per-asset** with
  zero combat-code churn — register a PNG/sheet, the procedural painter steps
  aside.

The upshot: the engine is already a capable 2D renderer that's *deliberately*
running in low-fidelity placeholder mode. Most of the quality ceiling is asset
work, not engine work.

## 2. Quick wins (low effort, immediate payoff)

These are days, not weeks, and don't touch combat:

1. **Ship real sprite sheets for the core classes.** `ASSET_SPEC.unitAnim`
   already defines the frame contract (idle 2 / walk 4 / attack 5 / hit 2 /
   death 4 at `32×40`). Register sheets in `manifest.ts` for the ~9 classes in
   `manifest.ts:122` and the procedural fallback retires itself. This is the
   single biggest perceived-quality jump available.
2. **HD-2× asset track.** Author assets at 2× (`64×80` sprites, `96×96` tiles,
   `128×144` portraits) and bump the `ASSET_SPEC` constants together. Because
   `Scale.FIT` already upscales `1280×720` to the player's monitor, native-2×
   art removes a lot of the soft upscaling on large displays. Keep the base
   logical resolution; only the *asset* density changes.
3. **Backdrops as painted art, not procedural gradients.** `BackdropArt`
   produces decent procedural scenes, but a set of 17 hand-painted (or
   AI-assisted, then cleaned) `1280×720` battle backdrops registered in the
   manifest would lift every battle's first impression. One file per
   `backdropKey`.
4. **Crisp UI text.** There's already `src/util/crispText.ts` — audit that every
   HUD/dialogue text object routes through it so text stays sharp under
   `FIT` scaling on hi-dpi screens.
5. **Resolution-aware canvas.** Consider `resolution: window.devicePixelRatio`
   on the game config for hi-dpi crispness (test carefully against `pixelArt`
   mode — the two interact).

## 3. Mid-term (bigger 2D fidelity, still no 3D)

- **Dynamic lighting.** Phaser's Light2D pipeline + per-sprite normal maps gives
  torch-lit interiors and dusk harbors real depth. The obstacle assets
  (`public/assets/obstacles/torch.png`, `pillar.png`) are natural light
  anchors.
- **Particle & shader VFX.** `ASSET_SPEC.vfx` already reserves slash/hitSpark/
  arrow slots and `RavageVfx.ts` exists. Real particle emitters for the Ravage
  state, crits, and deaths add a lot of "production value" per hour.
- **Animated backdrops / parallax.** Multi-layer backdrops (sky / mid / fore)
  with slow parallax on camera pan read as far more expensive than they are.
- **Portrait expression sheets.** The expression system (`expressions.ts`) is
  already wired; commissioning the remaining expression variants for named
  characters makes dialogue scenes feel authored rather than placeholder.

## 4. The 3D question

Three honestly-different routes, cheapest to most ambitious:

### Option A — Pre-rendered 3D → 2D sprites (recommended if we want a "3D look")
Model/rig/animate characters in Blender, render them to sprite sheets from the
game's fixed camera angle, and feed those sheets through the **existing
manifest**. This is exactly how the genre's touchstones (Final Fantasy Tactics,
Octopath's characters, many modern tactics games) get a 3D-quality look on a 2D
engine.
- **Pros:** zero engine change — they're just nicer sprites; consistent art
  direction; cheap at runtime; perfectly compatible with the current pipeline.
- **Cons:** fixed camera angle (no free rotation); re-rendering needed if the
  camera design changes.
- **Effort:** medium. The bottleneck is 3D art production, not code.

### Option B — 2.5D billboards in a 3D scene (Three.js layer)
Render a real 3D tile grid/terrain and place camera-facing 2D billboard sprites
on it (the "HD-2D" / Triangle Strategy look). Phaser doesn't do 3D natively, so
this means compositing a `three` canvas under/over Phaser, or migrating the
battle scene to a 3D engine while keeping menus in Phaser.
- **Pros:** real depth, camera tilt/zoom, dramatic lighting; keeps hand-authored
  character charm.
- **Cons:** significant architectural work — the battle grid math, camera, and
  input picking in `BattleScene` all assume a 2D tile→pixel projection
  (`tileToPixel`, `screenToTile`). A 3D ground plane means rewriting those.
- **Effort:** high.

### Option C — Full 3D (engine migration)
Move the battle layer to Three.js / Babylon.js (or a different engine) with real
3D models, animation, and a free camera.
- **Pros:** highest ceiling.
- **Cons:** effectively a rewrite of `BattleScene` and the art pipeline; the
  procedural-2D investment is discarded; large scope.
- **Effort:** very high. Hard to justify for a vertical slice.

### Recommendation
**Option A.** It buys the "3D-quality" visual jump the request is asking about
while reusing the manifest-driven 2D pipeline we already have, and it's the only
3D route that doesn't put the working combat code at risk. If, after the slice,
we want true depth and a movable camera, **Option B** is the natural escalation
— but it should be scoped as its own project because it rewrites the grid
projection and input picking.

## 5. Concrete next steps (in priority order)

1. Define the canonical class roster for sprite sheets and commission/produce
   them at the `ASSET_SPEC.unitAnim` contract; register in `manifest.ts`.
2. Stand up the Blender→sprite-sheet render pipeline (Option A) so steps 1 and 3
   share one source of truth for character art.
3. Replace procedural backdrops with painted `1280×720` art, one per
   `backdropKey`.
4. Author an HD-2× asset track and bump `ASSET_SPEC` + reference sites together.
5. Wire Phaser Light2D + real particle VFX for combat feedback.
6. Spike Option B (Three.js ground plane under Phaser) as a *separate*
   prototype before committing — validate the grid-projection rewrite cost
   before scheduling it.

> Throughout, the manifest fallback means none of this is all-or-nothing: every
> asset upgraded is an immediate, isolated improvement, and anything not yet
> replaced keeps rendering procedurally.
