# Unit Sprites — `public/assets/sprites/`

Per-class animation strips. One PNG per (class, state) pair.

## Folder layout

```
sprites/
  swordsman/
    idle.png
    walk.png
    attack.png
    hit.png
    death.png
  spearton/
    ...
  knight/
  archer/
  shinobi/
  sentinel/
  wyvern_rider/
  swordmaster/
  boss/
```

## Spec

| Property | Value |
|---|---|
| Frame size | **32 × 40 px** per frame |
| Format | PNG spritesheet, frames laid out **horizontally**, transparent bg |
| Origin | Foot-anchored: feet at the bottom edge, head near the top |
| Facing | Sprites face **screen-right**. The engine flips horizontally for left-facing |
| Outline | 1px pure black silhouette outline (matches portraits) |

## Frame counts per state (must match exactly)

| State | Frames | Frame rate | Loop | Notes |
|---|---|---|---|---|
| `idle` | 2 | ~2 fps | yes | Subtle breathing — torso bob, blink |
| `walk` | 4 | ~8 fps | yes | One full step cycle (LR LL RR RL or similar) |
| `attack` | 5 | ~14 fps | no | Wind-up → swing → impact → recover (×2) |
| `hit` | 2 | ~12 fps | no | Flinch + recover. Stays facing same direction |
| `death` | 4 | ~6 fps | no | Stagger → fall → settle → fade-friendly final frame |

The engine reads the file as a horizontal strip, so a 4-frame walk file is
**128 × 40 px** total (4 × 32 wide).

## Class silhouette guide

Each class must read at thumbnail size. Distinguishing features:

| Class | Silhouette cue |
|---|---|
| swordsman | Light cape, short sword in hand, no helm |
| spearton | Tall spear above head, round shield on back |
| knight | Heavy plate, full helm, kite shield |
| archer | Bow drawn diagonally, hood/cowl |
| shinobi | Hooded, two short blades, lithe pose |
| sentinel | Robed, staff, glowing focus |
| wyvern_rider | Wing silhouette behind, rider on top |
| swordmaster | Long blade held two-handed, topknot/long hair |
| boss | Oversized — give bosses a 1.5× silhouette via wider shoulders/horns |

## Palette per faction

- **Player units** — warm, saturated. Reds, golds, leather browns.
- **Enemy units** — cool, desaturated. Slate blue, dull green, bone white.
- This makes the battlefield readable at a glance even before HP bars are visible.

## Don't

- Don't anti-alias edges. Hard pixels only.
- Don't add ground shadows in the sprite — the engine draws those.
- Don't include weapon trails — those go in `vfx/`.
- Don't rotate or scale frames — paint each pose by hand.
