# Portraits — `public/assets/portraits/`

Character bust shots used in dialogue and the prep roster.

## Spec

| Property | Value |
|---|---|
| Dimensions | **64 × 72 px** |
| Format | PNG, transparent background |
| Style | GBA Fire Emblem portrait — head + shoulders, ¾ angle |
| Palette | 24–32 colors max, hard cel-shading |
| Outline | 1px pure black (`#000000`) silhouette outline |

## Filenames (must match exactly)

| File | Character |
|---|---|
| `amar.png` | Amar — protagonist swordsman |
| `lucian.png` | Lucian — adviser |
| `ning.png` | Ning — archer |
| `maya.png` | Maya — mage / sentinel |
| `leo.png` | Leo — knight |
| `ranatoli.png` | Ranatoli — wyvern rider |
| `selene.png` | Selene — swordmaster |
| `kian.png` | Kian — shinobi |
| `ndari.png` | Ndari — antagonist (Mountain arc boss) |
| `nebu.png` | Nebu — antagonist |
| `narrator.png` | Generic narrator frame |

## Composition

- Face fills the upper 2/3 of the canvas.
- Eyes at roughly y=20–24 (the same "eye line" across all portraits keeps
  dialogue overlays consistent).
- Shoulders cropped at the bottom edge — no body.
- Looking screen-right by convention; the engine flips horizontally for
  enemy-side dialogue.

## Reference palette

Match the in-game UI. Skin midtones around `#d9a37a`, hair shadows around
`#3a1f0a`, gold trim `#d9b257`, royal red `#91382f`. Cool tones for
antagonists (`#3a4a6a` muted blues), warm tones for protagonists.

## Don't

- No anti-aliasing on the outline. Hard pixels.
- No gradients. Use 2–3 shades per surface (highlight / midtone / shadow).
- No backgrounds. Transparent only.
- No 128px portraits scaled down — paint at 64×72 native.
