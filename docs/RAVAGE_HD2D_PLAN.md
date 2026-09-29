# Ravage — HD-2D / 2D-3D Hybrid: Technical Plan & Spike

A scoped plan for moving Ravage's battle presentation toward an Octopath-style
"HD-2D" look (a real 3D diorama ground with 2D character sprites, dynamic
lighting, depth-of-field, bloom) — grounded in the actual codebase, with a
de-risking spike defined before any commitment.

> Status: **Approach C shipped** on the `graphics-uplift` branch (September
> 2026). Battles are a tilted ¾ diorama in Phaser; see **§10** for what was
> built, the invariants the tests hold it to, and what is left for art.
> Approach B remains unbuilt and unnecessary for now.

---

## 1. Target look

"HD-2D" (Octopath Traveler / Triangle Strategy) is four things stacked:

1. A **3D environment** — tiles/terrain are real geometry the camera tilts over,
   with parallax depth and a tilt-shift "miniature diorama" feel.
2. **2D sprites as camera-facing billboards** standing on that 3D ground.
3. **Dynamic lighting** — sprites and ground lit by real light sources
   (torches, sun), with normal maps so flat sprites catch light.
4. **Modern post** — bloom, depth-of-field / tilt-shift, color grading,
   vignette, ambient particles.

For a tactics grid we want a fixed (or lightly tiltable) ¾ overhead camera, not
a free camera — closer to Triangle Strategy than a 3D action game.

---

## 2. Current architecture — what's coupled to flat 2D

The good news: the render coupling is small and concentrated, and **combat is
fully decoupled from rendering.**

| Concern | Where | Coupling to 2D screen-space |
|---|---|---|
| Grid / pathing / terrain rules | `src/combat/Grid.ts`, `combat/*` | **None.** Pure tile-coordinate logic, zero Phaser imports. Survives any render rewrite untouched. |
| Tile→world projection | `tileToPixel()` in `src/art/UnitArt.ts:230` | Single function: `(tile, originX, originY) → {x,y}`. Orthographic, screen-aligned. **The one place** world placement is computed. |
| Screen→tile (input picking) | `screenToTile()` in `BattleScene.ts:817` | Inverts the projection + adds camera scroll. The other half of the coupling. |
| Placement / animation / depth | `BattleScene.ts` (~33 projection call sites), `battle/RavageVfx.ts` | Sprites placed at `tileToPixel`, manual `setDepth` layers (tiles, units 25–30, UI 40–1000), shadows as ellipses. |
| Cameras | `BattleScene.ts` two-camera split (world + `uiCamera`), scroll-pan, no zoom/rotate | World camera carries `CinematicFX` (bloom + grade); UI camera is post-FX-free. |
| Lighting (partial) | fog-of-war spotlight RenderTexture, torch obstacles | A screen-space darkness mask, not real lights — but proof the team already thinks in "lit scene" terms. |
| Backdrops | `src/art/BackdropArt.ts` | 2D painted parallax-ish image behind the grid. |
| Post FX | `src/art/CinematicFX.ts` | Bloom + color matrix already wired; vignette + DOF available but unused. |

**Implication:** an HD-2D rewrite is a *rendering-layer* project. It touches
`tileToPixel`, `screenToTile`, the placement/depth code in `BattleScene`, and
the camera — and nothing in `combat/`. That's the whole reason this is feasible
without risking the game logic.

---

## 3. Prerequisite — Tier 0 crisp render

Independent of which approach we pick, the game currently renders a fixed
1280×720 buffer and `Scale.FIT`-upscales it (`main.ts`), so output is capped at
720p and `crispText` only helps on high-DPI displays. **Render at native
resolution first** (keep the 1280×720 logical coordinate system; back it with a
full-res buffer). This fixes text blur on all monitors, makes the SSAA art
(ART_SCALE / `PixelCanvas`) visible, and is a hard prerequisite for any
3D layer (which must render at device resolution to look "HD"). Small, low-risk,
do it before anything below.

---

## 4. Candidate approaches

### A. Pre-rendered 3D → 2D sprites (no engine change)
Model/animate in Blender, render to sprite sheets from the fixed game camera,
register through the existing manifest. The classic FF Tactics / Octopath
*character* pipeline.
- **Pros:** zero render-architecture change; reuses the manifest + `ASSET_SPEC`
  contract; cheap at runtime; no projection rewrite; combat untouched.
- **Cons:** the *environment* stays 2D — you get 3D-quality sprites, not a 3D
  diorama with camera tilt and real lights. It's "HD sprites," not "HD-2D."
- **Effort:** medium, mostly art production. **Risk: low.**

### B. True hybrid — 3D ground + 2D billboards (the real HD-2D)
Introduce a 3D scene (Three.js or Babylon.js) that renders the tile diorama and
lights, with character sprites as camera-facing billboards on it; Phaser stays
for UI/overlays, composited on top.
- **Pros:** the genuine Octopath look — tilted diorama, real dynamic lights,
  DOF/tilt-shift, normal-mapped sprites, elevation.
- **Cons:** biggest change. Rewrites `tileToPixel`/`screenToTile`, the camera,
  depth sorting, and the placement code; introduces a second renderer to
  composite with Phaser; new asset needs (tile meshes/heightmaps, normal maps).
- **Effort:** high / multi-week. **Risk: medium-high** (compositing two
  renderers, input picking via raycast, perf, art pipeline).

### C. Phaser-only "2.5D" (middle path)
Stay in Phaser but fake depth: dimetric/tilted tile art, stacked tiles for
elevation + drop shadows, `Light2D` + normal maps for dynamic lighting, and the
unused `CinematicFX` DOF/vignette for the diorama feel.
- **Pros:** no second renderer, no projection rewrite (just change the
  `tileToPixel` basis to dimetric); reuses everything; much of the "HD-2D vibe"
  for a fraction of B's cost.
- **Cons:** not true 3D — no free camera tilt, elevation is faked.
- **Effort:** medium. **Risk: low-medium.**

**Recommendation:** ship **Tier 0** now; pursue **C** as the pragmatic "HD-2D
feel" that de-risks most of the look; treat **B** as the aspirational target and
**only commit to it after the spike in §6 passes.** Use **A** for character art
quality regardless of A/B/C, since it feeds sprites into all three.

---

## 5. Detailed plan for the hybrid (Approach B)

Phased so each phase is shippable/abortable on its own.

### Phase 0 — Crisp render (Tier 0)
Native-resolution rendering + `crispText` always-on. Prerequisite.

### Phase 1 — Coordinate-system abstraction (no visual change) — ✅ SHIPPED
Introduce a single `Projection` interface that owns **all** tile↔world↔screen
math, and route the existing `tileToPixel`/`screenToTile` through it. Ship the
current orthographic projection as the first implementation. This is the
keystone: once every call site goes through one seam, swapping in a 3D
projection (camera unproject / raycast) is a local change, not a 33-site edit.
- Deliverable: `Projection` with `tileToWorld`, `worldToScreen`,
  `screenToTile`; `BattleScene` + `RavageVfx` consume only that.
- Verified by: pixel-identical behavior to today.

**Status — done.** `src/render/Projection.ts` defines the `Projection`
interface (`tileToWorld`, `worldToTile`, grid dims) plus the concrete
`OrthographicProjection`. The interface is deliberately split so SCREEN→WORLD
stays the camera's job (`getWorldPoint`) and Projection holds only WORLD↔TILE
— which keeps it **pure (no Phaser import)** and fully unit-testable in Node.
`BattleScene` builds one `OrthographicProjection` after the grid origin is
fixed; all 14 `tileToPixel` call sites + `screenToTile` route through it, and
`RavageVfx.refreshRavageAura` now takes the `Projection` instead of raw
origins. `UnitArt.tileToPixel` is deprecated (kept only for compile-compat).
Pixel-identity is locked by `src/render/__tests__/Projection.test.ts` (10
cases asserting the new math equals the verbatim legacy formulas across a
spread of real battle origins, including a tile→world→tile round trip and
out-of-bounds rejection). Full suite 105/105 green, `tsc --noEmit` clean.

> Next swap target behind this seam: a dimetric/tilted `Projection` (Approach
> C) changes ONLY the basis vectors in `tileToWorld` + the inverse in
> `worldToTile`. A true-3D `Projection` (Approach B) replaces `worldToTile`
> with a ray/ground-plane intersection. Neither touches a BattleScene call
> site — that's the whole payoff of Phase 1.

### Phase 2 — 3D layer behind a flag
Stand up a Three.js scene rendered to a canvas composited **under** the Phaser
UI canvas (Phaser remains the input + UI owner). Battle-scene-only, gated by a
per-battle flag so 2D remains the default and fallback. Orthographic camera with
a fixed HD-2D tilt.
- Risks to resolve here: canvas compositing/ordering with Phaser, color/gamma
  match, single rAF loop driving both, perf budget.

### Phase 3 — Diorama ground + elevation
Tiles as instanced 3D meshes (or a heightmapped plane) built from the existing
`MapDef`/`Grid` terrain data. Map terrain kinds → materials. Add per-tile
elevation as a new optional `MapDef` field (defaults flat, so existing battles
are unchanged).

### Phase 4 — Billboards + lighting
Character sprites (from Approach A's pipeline, or the current procedural
textures) as camera-facing billboards with **normal maps** so they catch light.
Add light sources (torches from existing obstacle data, a key/sun light, ambient
fill). Real shadow blobs or projected shadows replace the ellipse shadows.

### Phase 5 — Post & atmosphere
DOF/tilt-shift on far rows, bloom, color grade, vignette (carry the
`CinematicFX` intent over to the 3D pipeline), ambient particles (dust, embers,
snow) using the reserved `ASSET_SPEC.vfx` slots.

### Phase 6 — Input picking
Replace `screenToTile` with a raycast from the pointer against the ground plane →
tile (behind the Phase 1 `Projection` seam, so call sites don't change).

### Migration / safety
Everything battle-scene-only and flag-gated; 2D path stays as the fallback until
B is proven across all 17 battles. Combat (`combat/*`) is never touched.

---

## 6. The spike (do this BEFORE committing to B)

A throwaway branch, ~2–4 days, that answers the load-bearing unknowns. **Not**
production code — a proof-of-concept on one map.

**Build:** render **one** battle map's grid as a Three.js diorama (flat tiles
from `MapDef`), place 3–4 **billboard** sprites on it, one torch **light** + one
key light, an orthographic tilted camera, composited **under** a Phaser overlay
showing a fake HUD. Wire pointer raycast → tile and log the picked tile.

**Success criteria (all must pass to greenlight B):**
1. Three.js canvas composites cleanly under Phaser UI; one rAF loop; no z-fighting
   with the DOM/UI; colors match.
2. Pointer raycast returns the correct tile, matching today's `screenToTile`.
3. 60 fps at native resolution on a mid laptop with the largest map's tile count
   + a dozen billboards + 2 lights + bloom/DOF.
4. A billboard sprite with a normal map visibly catches the torch light.
5. Effort to extend from "one map" to "all maps + units + overlays" is estimable
   with confidence after the spike.

If any of 1–4 fail or 5 is uncertain, **fall back to Approach C** (Phaser 2.5D),
which delivers most of the look without the second renderer.

---

## 7. Risk register

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Two-renderer compositing (Three.js + Phaser) is fiddly | Med | High | Spike §6 criterion 1; fallback to C |
| Input picking parity (raycast vs screenToTile) | Med | Med | Phase 1 seam + spike criterion 2 |
| Perf at native res with lights + DOF | Med | High | Spike criterion 3; LOD/quality settings |
| Art pipeline cost (tile meshes, normal maps) | High | Med | Start with flat instanced tiles + faked normals; Approach A for characters |
| Scope creep vs the vertical slice's actual needs | High | Med | Tier 0 + C deliver 80% of the look; treat B as post-slice |
| I can't visually verify in this environment | High | Med | Headless screenshot harness; user verifies on-device |

---

## 8. Effort & sequencing (rough)

1. **Tier 0 crisp render** — ~days. Do now; standalone value.
2. **Approach C (2.5D)** — ~1–2 weeks. Biggest look-per-hour; low risk.
3. **Approach A character pipeline** — art-led; parallelizable; feeds B/C.
4. **Spike for B** — 2–4 days; gate.
5. **Approach B phases 1–6** — multi-week; only if spike passes.

---

## 9. Open questions

- Target hardware / min spec? (Sets the perf budget for lights + DOF.)
- Fixed camera, or allow slight tilt/rotate? (Affects billboard math + picking.)
- Art capacity for a Blender pipeline (A) and normal maps (B)? (Often the real
  bottleneck, not code.)
- Is "HD-2D feel" (Approach C) acceptable, or is true 3D ground a hard
  requirement? — this single answer decides B vs C.

---

## 10. What shipped — Approach C, the ¾ diorama

Chosen over B for the reasons in §4: all of the look that matters, one
renderer, no raycast picking. `?flat=1` renders the old flat board through
the same code path, so the flat look survives as a fallback rather than a
second renderer.

### The board
- **Projection seam** (`render/Projection.ts`, `render/ObliqueProjection.ts`):
  48×36 foreshortened tile tops, 14px per elevation level, front faces where
  a tile stands above the one in front, a 30px slab under the last row.
  `worldToTile` resolves front-to-back over tops and faces.
- **Elevation is presentation only** (`render/elevation.ts`). Walls stand
  +2, water sinks −1; maps opt in per alias (`t(terrain, obstacle, elev)`)
  or per cell (`buildMap`'s `elevation(x, y, cell)`). Mountain parapet,
  palace gallery and dais, the cliff staircase, the ravine high ground and
  the final processional are authored. Combat never reads it.
- **Playability invariants, tested on every battle map:** a tile never
  rises more than one level above standable ground behind it (the
  clearance clamp), every standable tile and every deployment tile is
  clickable at its centre, and `ELEV_STEP < TILE_H / 2`.
- **Keystone perspective** (`render/keystone.ts` + `PerspectivePipeline`):
  a post pass narrows the far edge (k = 0.12). Picking runs the exact
  inverse before `worldToTile`.
- **Depth contract** (`render/depth.ts`): named bands from backdrop to
  floaters; actors y-sort every frame by their feet; terrain overlays
  (shimmer, foam, AO, grid) sort per row so raised tiles in front hide them.

### Light and atmosphere
- **Bloom** (`render/BloomPipeline.ts`) replaces Phaser's, whose 50/50
  mix left every battle ~25% dark, half-blurred and see-through. It keys on
  luminance AND saturation, so flames glow and marble or snow don't blow out.
- **Sun shadows** (`render/sun.ts`): in daylight every unit and prop casts
  its silhouette up the board from a low south-west sun. On dark battles
  torches cast them instead, away from the flame, above the light pool.
- Raised tops are lit on west and front edges and shaded on the east;
  ambient occlusion under taller neighbours; stone caps on raised walls.
- Water sits deeper and cooler, with foam along every bank.
- **Depth of field:** the backdrop, in its own scene under the battle
  (`BattleBackdropScene`, parallax 0.14), is blurred once at load.

### Animation
- Units are 48×60 billboards (a clean 3× of the 32×40 sheets), anchored
  at the feet.
- Walks hop per stride and climb visibly; footfall dust sorts with actors.
- Melee is a step with lift, plant (dust) and recovery. Arrows cast a
  ground streak that shows the arc as height. Crits kick up heel dust.
- Deaths topple about the feet away from the blow, land with dust, lie a
  beat and fade. (They had never been visible: the defender was refreshed,
  and so hidden, before the death played.)
- Reinforcements stride in from the nearest board edge.

### Board camera (turn, zoom, drag, x-ray)
On a tilted board the rows in front cover part of the rows behind, so the
player can move the camera to see and click what is hidden:
- **Turn** the board in quarter-turns: the ↺ ↻ top-bar buttons or Q / E.
  `render/ViewRotation.ts` maps grid cells to VIEW cells and
  `RotatedProjection` wraps the tilted projection, so every call site
  still passes grid tiles. The diorama is rebuilt in view space. Heights
  are re-clamped per view, so the playability tests hold from all four
  sides of every map. Facing is kept in grid terms and shown on screen.
- **Zoom** 1×–2× with the wheel (or + / -), anchored on the cursor.
- **Drag** any board: the camera has slack around the board, so boards
  that fit the playfield can be dragged too. The opening view is framed
  exactly as before.
- **R** resets the view.
- **Hover x-ray:** when the tile or unit under the pointer is hidden behind
  a unit or a tall prop in front, its outline draws through.

### Capture harness (`npm run capture <list> [out]`)
`Date.now` follows the virtual clock (Phaser tweens run on it, and ran
~12× fast in every capture before). Lists: `baseline` (one still per
biome), `quick` (`CAP_IDS=a,b`), `anim` (melee kill, arrow, torch walk,
arrival), `scenes`, `probe` (`CAP_MAGENTA`, `CAP_NOFOG`, `CAP_STRIP`).

### Art (generated with Codex, September 2026)
- Every unit class — the ten Tier 1 classes and the seven Tier 2
  promotion classes — has idle, walk, attack, hit and death sheets.
  Pipeline and sources: art_sources/README.md, scripts/art/.
- Standing tree and palace column for the diorama
  (public/assets/obstacles/tall/), faded while a unit is behind them.

### Left for art
- Front faces reuse the top texture's material; purpose-painted side
  textures (strata, masonry, root-bound earth) would sharpen elevation.

