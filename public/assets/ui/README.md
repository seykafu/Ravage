# UI — `public/assets/ui/`

Optional replacements for the procedural parchment panel + button states.
Drop these in only if you want a more bespoke look — the procedural ones
are perfectly serviceable.

## Files

| File | Spec | Notes |
|---|---|---|
| `panel.png` | 9-slice ready, ~96×96 px source | Parchment / wood frame, used by `drawPanel` |
| `button_idle.png` | 9-slice ready, ~64×32 px source | Default button background |
| `button_hover.png` | Same dimensions as idle | Hover/active button background |

## 9-slice convention

If you provide these files, the engine will treat them as 9-slice with a
**12px border** (corners are 12×12 each). So a panel needs at minimum:

- 12px border + 1px center + 12px border = 25×25 minimum source
- We recommend at least 96×96 to give the texture room to breathe

## Style

- **Panel** — aged parchment with darker frame edge. Subtle grain, no
  drop shadow (engine adds one).
- **Buttons** — slightly raised idle, pressed-in or glowing hover. Match
  the panel palette so they sit naturally inside it.

## Color reference

The procedural UI uses these shades — match or harmonize:

| Use | Hex |
|---|---|
| Panel fill | `#dad3bd` (parchment) |
| Panel edge | `#3a2b1e` (dark wood) |
| Title text | `#f4d999` (gold) |
| Body text | `#dad3bd` |
| Subtitle / muted | `#c9b07a` |
| Danger / error | `#91382f` |

## Don't

- Don't include the button label baked into the image — labels are drawn
  by the engine.
- Don't include arrow glyphs (◂ ▸) in the panel — those are text too.
- Don't add transparency outside the 9-slice border. Borders need to be
  fully opaque to slice cleanly.
