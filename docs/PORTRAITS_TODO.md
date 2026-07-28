# Portrait generation checklist

Audit date: 2026-07-28 (17-battle slice, B1–B17 + Seven Paths content).
Cross-references every `portraitId`/`expression` used in `src/story/beats.ts`
and `src/data/battles.ts` against `public/assets/portraits/` and the registry
in `src/assets/expressions.ts`.

## Current file spec (what the live pipeline expects)

| Property | Value |
|---|---|
| Dimensions | **1024 × 1536** (2:3 portrait) |
| Format | PNG, **transparent background** |
| Framing | Bust — head + shoulders, shoulders reaching the bottom edge |
| Naming | `<character>_<expression>.png`, exact slugs below |
| Location | `public/assets/portraits/` |

Every slug below is already registered in `expressions.ts`, so a dropped file
"just works" with zero code changes. Until the file exists, the beat falls
back to the character's neutral portrait.

## 1. Missing art the writing already asks for (ranked by screen time)

| File to generate | Uses | Where it matters |
|---|---|---|
| `amar_guarded.png` | 18 | Amar's wary register through the whole Grude betrayal arc (B14–B17) — the single biggest gap |
| `kian_wounded.png` | 5 | Kian's captivity + cliff-duel beats |
| `leo_ready.png` | 5 | Leo's B8 defection — the emotional centre of his arc |
| `maya_alarmed.png` | 3 | Maya's clipped mid-fight warnings |
| `ndari_grim_resolve.png` | 2 | Ndari's later commanding beats |
| `kian_alarmed.png` | 1 | |
| `kian_cold_contempt.png` | 1 | |
| `kian_fatherly_smile.png` | 1 | |
| `leo_resolute.png` | 1 | |
| `lucian_alarmed.png` | 1 | |
| `ndari_knowing_smile.png` | 1 | |

## 2. Named officers currently wearing the generic royal-guard stand-in

These three speak across 14 beats using `royal_guard.png`. Bespoke portraits
would be a real upgrade (each also needs a `PortraitId` + registry entry —
ask Claude to wire them once art exists):

| Character | Battle | Personality anchor for the prompt |
|---|---|---|
| Lord Castor | B14 | Grey-templed household-guard commander; courteous, duty-bound, faintly sad |
| Wren | B16 | The King's Knife — plain-faced professional assassin, unsettlingly relaxed |
| Marshal Othren | B17 | True-believer rebellion loyalist; older, granite conviction |

## 3. Full regeneration sets (for the consistency pass)

Current sets drift because each expression was generated as a fresh image —
faces gain/lose features between expressions. If you regenerate, do a
character's ENTIRE set in one session (workflow below). Complete lists,
`(missing)` = doesn't exist yet:

- **amar** — neutral, guarded (missing), quiet_rage, resolute, shocked, warm_half_smile, wounded
- **lucian** — neutral, alarmed (missing), dying, fatherly_smile, grim_resolve
- **ning** — neutral, eager_grin, exhausted, focused_bow, startled
- **maya** — guarded_neutral (her default), alarmed (missing), calculating_side_glance, soft_genuine_smile, steel_cold_confession_face, tearful
- **leo** — neutral, cocky_smirk, fury, ready (missing), resolute (missing), wide-eyed_horror, wounded_pride
- **ranatoli** — neutral, alarmed, dry_skeptical, lecturing, satisfied
- **selene** — base, breaking, cold_contempt
- **kian** — neutral, alarmed (missing), cold_contempt (missing), fatherly_smile (missing), knowing_smile, pure_menace, wounded (missing)
- **ndari** — regal_neutral (his default), grim_resolve (missing), knowing_smile (missing), scornful, surprised
- **nebu** — neutral, cruel_amusement, fury
- **dawn** — measured_neutral (her default), charismatic_warm_smile, ideologue_intensity, mask_slipping
- **fergus** — neutral, false_sincerity, unmasked_treachery
- **ndara** — neutral, commanding, grim, military_neutral
- **archbold** — neutral, offering_peace, righteous_fury
- **khione** — neutral, ancient_sadness, revelation, serene_neutral
- **rose** — neutral, brisk, falling
- **mira**, **tali**, **coyne** — single portrait each, no expression set needed

## 4. Consistency workflow for ChatGPT image generation

The drift happens because each expression was a fresh generation. Fix:

1. **Generate the neutral master first.** Iterate until the face is right.
2. **Feed the master back as an input image for every expression** — prompt
   as an EDIT: "Same character, same face, same lighting, same crop. Change
   ONLY the expression to: <expression>." Never generate an expression from
   text alone.
3. One session per character; don't mix characters in one conversation.
4. Keep a fixed tail on every prompt: "1024×1536 portrait, transparent
   background, bust framing with shoulders reaching the bottom edge,
   painted fantasy style matching previous image, no text, no watermark."
5. Regenerate a whole character or don't touch them — a half-new set drifts
   worse than an old-but-uniform one.

## 5. Housekeeping (optional, ask Claude)

Legacy square base renders (`amar.png`, `lucian.png`, `leo.png`,
`kian.png`, `ndara.png`, `nebu.png`, `ning.png`, `fergus.png`,
`khione.png`, `ranatoli.png`, `archbold.png`, `maya.png`, `ndari.png`)
are superseded by `DEFAULT_VARIANT_FOR` in `expressions.ts` and are never
loaded — deletable once the regen lands. `archbold_offering_peace`,
`archbold_righteous_fury`, `khione_revelation`, `kian_pure_menace`,
`nebu_fury`, `leo_fury`, `maya_tearful`, `ndari_surprised`,
`ranatoli_dry_skeptical`, `ranatoli_satisfied`, `dawn_charismatic_warm_smile`
are loaded but not yet used by any written beat — they're inventory for
future arcs (B18+ finale), keep them.
