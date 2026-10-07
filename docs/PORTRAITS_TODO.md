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

## 1-2. Done (2026-10-06, Codex — scripts/art/gen_portrait_art.py)

Generated with the Codex pipeline (`gen_portrait_art.py` → review →
`process_portrait_art.py`, raw renders in `art_sources/portraits/`):

- **Missing expressions, now in-set:** `kian_wounded`, `kian_fatherly_smile`,
  `kian_alarmed`, `kian_cold_contempt`, `ndari_grim_resolve`,
  `ndari_knowing_smile` (each an edit of the character's own master).
- **Drifted expressions, redrawn from their set's master:** `maya_alarmed`
  (read younger / rounder than the rest), `lucian_neutral` +
  `lucian_grim_resolve` (closer crop, different beard and scar),
  `khione_revelation` + `khione_serene_neutral` (different face, gold
  hair), `rose_neutral`, `ning_neutral`.
- **Coyne** redrawn in the house style (was near-photographic).
- **The named generals have their own faces:** Lord Castor (`castor`),
  Marshal Othren (`othren` — he wore TWO different stand-ins), Wren,
  General Serrick, Captain Brask, Colonel Vasse, Warden Sarto; and the
  Ravage's Herald and Commander (`herald`, `ravage_commander` — alien,
  teal-black carapace and mint light; they wore a human bandit's face).
  Wired in `PORTRAIT_IDS`, the PortraitId union, their dialogue, and their
  units' `portraitId` (side panel, turn bar).

Still on the stand-ins (unnamed, a line or two): the Imperial Captain
(B18), the Holdout Captain (B19 mercy), Captain Halden (B21, no lines).

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
