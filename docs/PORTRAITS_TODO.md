# Portrait generation checklist

Updated: 2026-08-05 (full campaign B1–B29, seven endings). Regenerated so
far on the new standard: **Amar ✓, Leo ✓, Lucian ✓** (master-reference
consistency; Lucian is the first with a transparent background).

## Current file spec

| Property | Value |
|---|---|
| Dimensions | **1024 × 1536** (2:3 portrait) |
| Format | PNG, **fully transparent background** (real alpha — new standard) |
| Framing | Bust — head + shoulders reaching the bottom edge |
| Naming | `<character>_<expression>.png`, exact slugs |
| Workflow | One master per character, every expression as an EDIT of it |

## 1. Missing expressions the script actively uses (fall back to neutral today)

| File to generate | Uses | Where it matters |
|---|---|---|
| `maya_alarmed.png` | 6 | Her clipped mid-fight warnings — grew with the war arc |
| `kian_wounded.png` | 5 | Captivity + the cliff duel |
| `ndari_grim_resolve.png` | 2 | His later commanding beats |
| `kian_alarmed.png` | 1 | |
| `kian_cold_contempt.png` | 1 | |
| `kian_fatherly_smile.png` | 1 | |
| `ndari_knowing_smile.png` | 1 | |

## 2. Named characters with NO portrait (all wear the royal-guard stand-in)

Ranked by speaking beats. Each needs art + a small code wire-up (ask
Claude once the PNG exists):

| Character | Beats | Anchor for the prompt |
|---|---|---|
| Lord Castor | 6 | Grey-templed household-guard commander; courteous, duty-bound, faintly sad |
| Wren | 3 | The King's Knife — plain-faced professional assassin, unsettlingly relaxed |
| Marshal Othren | 2 | True-believer rebellion loyalist; older, granite conviction |
| General Serrick | 1 | Career field general; heavy, immovable, correct |
| Captain Brask | 1 | Incendiary-war specialist; quick-eyed, unbothered by fire |
| Colonel Vasse | 1 | Survivor of a broken army fighting on out of grief |
| Warden Sarto | 1 | Old shield-wall of one; thirty years keeping one bell |

Deliberately faceless (design choice, revisit if wanted): **The Herald**
and **The Ravage Commander** speak with no portrait at all — the fleet
doesn't show faces. A single alien-commander portrait for B27/B28 would
be striking if you ever want to overturn this.

## 3. Old-generation sets to regenerate (face drift + painted backgrounds)

Priority by screen time and campaign weight:

1. **Maya** — the most dialogue in the game after Amar; do `alarmed` in-set: guarded_neutral (default), alarmed (missing), calculating_side_glance, soft_genuine_smile, steel_cold_confession_face, tearful
2. **Kian** — two-act antagonist; four missing slugs land in-set: neutral, alarmed, cold_contempt, fatherly_smile, knowing_smile, pure_menace, wounded
3. **Dawn** — 39 beats AND the revolution path's final boss; `mask_slipping` carries B28: measured_neutral (default), charismatic_warm_smile, ideologue_intensity, mask_slipping
4. **Ning** — high screen time: neutral, eager_grin, exhausted, focused_bow, startled
5. **Archbold** — final boss of two paths: neutral, offering_peace, righteous_fury
6. **Ndari** — two missing slugs in-set: regal_neutral (default), grim_resolve (missing), knowing_smile (missing), scornful, surprised
7. **Khione** — neutral, ancient_sadness, revelation, serene_neutral
8. Then: Ndara, Selene, Nebu, Fergus, Rose, Ranatoli, Coyne, Mira, Tali

## Workflow reminder

One ChatGPT session per character. Master first, iterate until right,
then every expression as "same character, same lighting, same transparent
background, change ONLY the expression." Whole set or nothing. Exact
filenames into `public/assets/portraits/` — everything in section 1 and 3
is pre-registered and works on drop-in. Tell Claude when files land so
they get committed and pushed (they are not code; they need an explicit
sweep).
