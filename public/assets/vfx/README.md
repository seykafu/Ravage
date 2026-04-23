# VFX — `public/assets/vfx/`

Combat effects: slash arcs, hit sparks, projectile trails. Played as
overlays on top of unit sprites during attacks.

## Files

| File | Spec | Frames | Notes |
|---|---|---|---|
| `slash.png` | 64×64 per frame, horizontal strip | 5 | Arc swing — wind-up → crescent → fade |
| `hit_spark.png` | 32×32 per frame, horizontal strip | 4 | Burst at impact point — radial particles, white→yellow→fade |
| `arrow.png` | 24×8 single image | 1 | Projectile in flight; engine rotates to face direction |

## Spec

| Property | Value |
|---|---|
| Format | PNG, transparent background |
| Style | Bright + saturated, additive-friendly (white core, color falloff) |
| Origin | Centered — engine positions effect at impact x/y |

## Color guidance

- **Slash** — start cold-white core (`#ffffff`), fade through pale yellow
  (`#fff7c0`) to transparent. Crit slashes get tinted red at the call site.
- **Hit spark** — white core, orange ring, fades to transparent. Engine
  tints these per-element if needed (no separate files for fire/ice).
- **Arrow** — solid silhouette, dark shaft + lighter fletching. No glow.

## Animation rate

| Effect | Rate | Loop? |
|---|---|---|
| slash | ~24 fps | no |
| hit_spark | ~20 fps | no |
| arrow | static | n/a |

## Don't

- Don't paint impact sounds into the visual (no "POW!" text).
- Don't include a shadow on the ground — VFX float above the unit layer.
- Don't make slash arcs longer than 64px — they'd clip across multiple
  tiles and look weird.
