# Ravage — Design Document

> The narrative and lore live in [`RAVAGE_SCRIPT.md`](./RAVAGE_SCRIPT.md)
> (synced from the canonical Google Doc). This file covers game systems,
> mechanics, data conventions, and engineering decisions. When implementation
> notes here disagree with the actual code, the code is closer to the
> ground truth — open a PR to update this file in the same change.

---

## 1. Game Vision

Ravage is a single-player, save-once-per-slot **tactical RPG** built in
Phaser 3.80 + TypeScript (strict) + Vite. The vertical slice is **21
authored battles** following Amar from the failed palace coup to the
defense against the Ravage fleet. Combat is grid-based with
speed-priority initiative; progression is **level-based with FE-style
stat growths and story-gated class promotion**. Character permadeath is
opt-in via Grave mode, with several hard-scripted deaths that fire
regardless of player skill at specific story beats.

Single playthrough is ~15–25 hours. Replay value comes from (a) Grave
mode, (b) the **Refuse Dawn / Side with Dawn** branch at Battle 16
which forks battles 18–21 and the ending, and (c) random-roll stat
growth variance.

---

## 2. Stack and Conventions

- **Phaser 3.80.1** + **TypeScript strict** + **Vite** multi-page build
- Multi-page: `index.html` (landing), `play/index.html` (game)
- All asset paths under `public/assets/`
- Type-safe content IDs in `src/data/contentIds.ts` — every cross-file
  string id (battle, arc, backdrop, route ref) is a discriminated union.
  Add new ids there first; the compiler walks you through the rest.
- `import.meta.env.DEV` gates dev-only code (DevJumpScene, fallback
  warnings) so it tree-shakes out of production builds.
- Commit-and-push workflow on every game change. See `CLAUDE.md` if
  present at the repo root.

---

## 3. Combat System (existing)

### 3.1 Initiative

- Speed-based round order: every alive unit acts once per round in
  descending speed order, ties broken by faction (player wins ties).
- Implemented in `src/combat/Initiative.ts`. `upcoming(units, n)` returns
  the next n turns; the bar UI dedupes by id before rendering so a unit
  doesn't show twice when the cycle wraps to the next round.

### 3.2 Action Points

- Each unit has an AP pool (typ. 2–3). Move and Attack each cost 1 AP.
- Stances (Ready, Defensive, none) cost 1 AP and persist until the
  unit's next turn or until expended.
- The **Roam** ability lets a unit spend 1 extra AP after the pool is
  empty for one additional Move (not Attack).

### 3.3 Weapon Triangle

| Attacker → | Sword | Spear | Shield | Bow | Dactyl |
|---|---|---|---|---|---|
| **vs Sword** | 1.00 | 0.85 | 1.15 | — | — |
| **vs Spear** | 1.15 | 1.00 | 0.85 | — | — |
| **vs Shield** | 0.85 | 1.15 | 1.00 | — | — |
| **vs Bow** | — | — | — | 1.00 | — |
| **vs Dactyl** | — | — | — | — | 1.00 |

Bow and Dactyl sit outside the triangle. Bow has range 2–4 and cannot
counter via Ready. Dactyl is range 1, mounted, no triangle bonus or penalty.

### 3.4 Stances and Counters

- **Ready stance**: defender retaliates if attacker is in melee range and
  defender's stance is Ready. Ready counter does +25% damage / +5% crit
  and consumes the stance slot.
- **Speed counter** (passive): defender retaliates without consuming
  stance if their speed exceeds attacker's by `SPEED_COUNTER_THRESHOLD`.
  Base damage, no kicker.
- Bow attackers cannot trigger Ready counter (the defender swings empty).

### 3.5 Special Abilities (max 2 per unit)

- **BossFighter**: ×2 damage vs `classKind: "boss"` enemies
- **Aide**: incoming damage ×0.5 while adjacent to any friendly unit
- **Destruct**: on death, the killing-blow attacker also dies (armor-bypassing self-immolation)
- **Roam**: once per turn, after AP spent, spend 1 extra AP for one extra Move

Tier 2 promotion adds a second ability slot — see §6.3.

### 3.6 Items

- 5-slot battle inventory per unit. Currently only `potion` exists
  (`POTION_HEAL = 10`).
- Use during turn for 1 AP. Item count persists across battles (saved).

---

## 4. Progression System

### 4.1 Levels and XP

- **Level cap**: 20.
- **XP curve**: flat 100 XP per level. (Simpler than escalating curves;
  reward scaling — §4.2 — does the heavy lifting on pacing.)
- **Persistence**: per-character `level` and `xp` are written to the
  save slot at end of each battle.

### 4.2 XP Awards

XP is awarded **on kill only** (no assist XP, no damage-based XP).
Cleaner than FE's mixed model and avoids kill-steal frustration.

| Enemy class tag | Base XP |
|---|---|
| Mook (default) | 30 |
| Elite (royal_guard, royal_archer) | 50 |
| Boss (`classKind: "boss"`) | 100 |

**Level-difference modifier**:

```
multiplier = clamp(1 + 0.10 * (enemy.level - attacker.level), 0.30, 2.00)
xp_awarded = round(baseXP * multiplier)
```

Killing a unit 7+ levels below you still gives 30% of base. Killing one
10+ levels above you caps at 200%. Encourages bringing under-leveled
units forward and discourages farming weak enemies.

### 4.3 Stat Growths

Each character has a `growths` table — % chance per stat to gain +1 on
level up. Per-character; hero characters have higher totals than
supports.

**Player growth tables** (initial values; tune in playtest):

| | HP | PWR | ARM | SPD | MOV |
|---|---|---|---|---|---|
| Amar (sword/swordsman) | 70 | 60 | 40 | 50 | 10 |
| Lucian (spear/spearton) | 75 | 50 | 60 | 25 | 5 |
| Ning (bow/archer) | 50 | 60 | 25 | 60 | 15 |
| Maya (sword/shinobi) | 50 | 55 | 30 | 70 | 20 |
| Leo (dactyl/dactyl_rider) | 65 | 60 | 50 | 45 | 10 |
| Ranatoli (shield/sentinel) | 80 | 40 | 70 | 25 | 5 |
| Selene (sword/swordmaster) | 60 | 70 | 35 | 65 | 15 |
| Kian (sword/knight) | 65 | 55 | 55 | 50 | 10 |

Movement growth is intentionally rare across the board — speed already
scales tactical reach, and movement creep breaks map design.

### 4.4 Starting Levels

| Battle | Unit | Starts at level |
|---|---|---|
| 1 (Palace Coup) | Amar (`amarHidden`) | 10 |
| 1 | Selene, Ranatoli, the 5 unseen comrades | 10 |
| 2+ | Amar (`amar`, post-amnesia) | 1 |
| 2+ | Lucian | 1 |
| 2+ | Ning | 1 |
| 3+ | Maya | 1 |
| 4+ | Kian | 1 |
| 5+ | Leo | 1 |

The post-amnesia drop on Amar (10 → 1) is the script's "muscle memory
intact, raw stats reset" framing made mechanical. From Battle 2
onward, every character starts at L1 — the player's own progression
decides the curve, not factory defaults. The original-8 veterans
(Selene, Ranatoli) keep their L10 baseline because they're authored
into Battle 1 specifically as veterans of the original coup attempt;
when they rejoin later, the catch-up rule (§4.5) handles their
re-integration into the current squad's level band.

### 4.5 Original-8 Catch-Up Rule

When Selene rejoins (Battle 7) or Ranatoli rejoins (TBD), they retain
their **L10 baseline**. If the squad's average level exceeds 10 by
that battle, they get a one-time catch-up to **(squad_avg − 2)**, capped
at L20. Catch-up applies the unit's growths once per simulated level.

This keeps "the elites Amar remembers" feeling like elites without
making them dead weight in the late game. Implemented in
`src/combat/Progression.ts`.

### 4.6 Enemy Levels and Scaling

- Each enemy factory in `src/data/units.ts` takes a `level` parameter.
- Stats scale by `(1 + 0.06 × (level - 1))`, rounded.
- Per-battle author sets each enemy's level explicitly when calling
  the factory (e.g., `ENEMIES.banditSwordsman("dawn_sw1", 301, 4)`).
- No procedural curve — the per-battle authoring decides difficulty
  pacing directly. We're already authoring battles individually; this
  just makes the existing tuning visible in the call site.

### 4.7 Difficulty Levels (planned)

Three difficulty levels per the script: **Normal / Hard / Extreme**.
Implementation TBD; likely a global multiplier on enemy `level` (e.g.,
Hard = +1, Extreme = +3). Set at New Game; persisted in save slot.

### 4.8 Level Up UX

- After XP push past 100, the unit triggers a level-up animation in
  `BattleScene` (golden flash + shake).
- A small floater shows which stats gained (`+HP +SPD`). Stats not
  rolled don't show.
- All level-ups for a unit are batched at end-of-battle if multiple
  fired in the same fight.

---

## 5. Class System

### 5.1 Tier 1 Classes

(Existing — see `src/combat/types.ts ClassKind` and `src/data/units.ts`.)

| Class | Weapon | Role |
|---|---|---|
| Swordsman | Sword | Balanced melee |
| Spearton | Spear | Tanky pole-arm |
| Knight | Sword | Mounted (+2 movement bonus from `Actions.mountBonus`) |
| Archer | Bow | Range 2–4, no Ready counter |
| Dactyl Rider | Dactyl | Mounted (+2 mv), range 1, neutral triangle |
| Shinobi | Sword | Fast, fragile, evasive |
| Sentinel | Shield | Slow, very tanky, defensive |
| Swordmaster | Sword | Selene's class — already a Tier 2-ish profile |

(Note: `swordmaster` and `boss` exist as ClassKind values but aren't
strict Tier 1. Selene is unique; bosses are unique.)

### 5.2 Tier 2 Classes (with bond/counter)

Per the script's class table:

| Tier 1 | Promotes to | Bonds with | Weak vs |
|---|---|---|---|
| Swordsman | **Swordmaster** | Khan, Dactyl King | Robinhelm, Shinobi Master |
| Spearton | **Spearton Lord** | Shinobi Master, Guardian | Swordmaster, Khan |
| Knight | **Khan** | Swordmaster, Robinhelm | Dactyl King |
| Archer | **Robinhelm** | Khan, Dactyl King | Spearton Lord, Shinobi Master |
| Dactyl Rider | **Dactyl King** | Swordmaster, Robinhelm | Shinobi Master |
| Shinobi | **Shinobi Master** | Spearton Lord, Guardian | Guardian, Dactyl King |
| Sentinel | **Guardian** | Shinobi Master, Spearton Lord | Swordmaster, Khan |

The mapping is **fixed** — there is no branching choice at promotion.

### 5.3 Promotion (Story-Gated)

Promotion is **not** level-gated. Each character has a fixed story beat
that triggers their promotion. When the beat fires, a `PromotionScene`
modal animates the upgrade.

| Character | Promotes after | Triggering beat |
|---|---|---|
| Lucian | Battle 7 (`post_monastery`) | "I thought it was something like that. I have a wife and a daughter, Amar." — the night Lucian chooses to cover Amar |
| Maya | Battle 9 (`post_ravine`) | "She was planted in the squad by Madame Dawn months ago, she admits." |
| Leo | Battle 8 (`post_orinhal`) | "My father would have had me arrest them." |
| Ning | Battle 9 (`post_ravine`) | The crossbow-bolt moment — Lucian takes a hit pulling her clear |
| Kian | (does not promote — antagonist arc) | n/a |
| Ranatoli | At rejoin (Battle TBD) | Catch-up triggers concurrent promotion |
| Selene | Already promoted (Swordmaster) | Joins as a Swordmaster in B7 |
| Amar | Battle 11 (`post_cliffs`) | The cliffs reveal — Amar stops hiding |

(Beat triggers are encoded in `src/story/beats.ts` via a new optional
`promote: PortraitId` field on a beat.)

### 5.4 Promotion Reward

When a unit promotes:

- **Stat boost**: +5 HP, +2 PWR, +2 ARM, +2 SPD, +1 MOV
- **Class change**: `classKind` updates to the Tier 2 class
- **2nd ability slot fills** with the Tier 2's signature ability (table TBD)
- **Sprite change**: ideally the unit gets a new sprite folder
  (`public/assets/sprites/swordmaster/idle.png` etc.). Until those ship,
  the procedural fallback or `spriteClassOverride` carries.

### 5.5 Tier 2 Signature Abilities (proposal, tunable)

| Tier 2 | New ability | Effect |
|---|---|---|
| Swordmaster | **Crit+** | +15% crit rate on all attacks |
| Spearton Lord | **Phalanx** | Adjacent allies take −20% damage |
| Khan | **Charge** | First attack each turn does +25% damage |
| Robinhelm | **Pierce** | Bow attacks ignore 50% of target armor |
| Dactyl King | **Stoop** | Once per battle, attack any tile within 6 mv (free move) |
| Shinobi Master | **Vanish** | After attacking, take −50% damage until next turn |
| Guardian | **Bulwark** | Cannot be moved by enemy effects; +2 effective armor |

### 5.6 Bond/Counter (DEFERRED)

Will activate post-promotion. Two adjacent Tier 2 units that "bond"
get a damage buff (proposal: +15%). Attacking a counter-class adds the
weak penalty (proposal: ×0.85 on outgoing damage). Implementation
deferred until promotion is stable in playtest.

---

## 6. Permadeath

### 6.1 Grave Mode (player toggle)

Set at New Game. When on, any player unit who falls in battle is
permanently removed from the roster. When off, units return after the
battle ends with full HP.

Grave mode flag lives on the save slot. Cannot be toggled mid-game.

### 6.2 Scripted Deaths (story-driven)

Some units die regardless of player skill or Grave mode. They fire from
story beats, not battle outcomes. Implementation via a new
`scriptedDeath: PortraitId` beat field.

| Beat | Dies |
|---|---|
| `post_cliffs` (B11) | Lucian |
| `post_choosing` (B18, Refuse Dawn route) | Ning, Leo |
| `post_choosing` (B18, Side with Dawn route) | Madame Dawn, Ndara |
| Mid-`b19_*` (Side with Dawn route) | Maya |

When a scripted death fires, the unit is removed from the active roster
(same as Grave mode), the beat displays the death, and any subsequent
beats that referenced the unit either skip or branch.

---

## 7. Battle Authoring

### 7.1 BattleNode Anatomy

(`src/data/battles.ts`)

- `id: BattleId` — typed against `contentIds.ts` union
- `index: number` — display order (1..21)
- `title`, `subtitle` — narrative names
- `intro`, `outro` — 80–160 word framing paragraphs (used in BattlePrep + EndScene)
- `music`, `prepMusic` — `MusicKey` from `audio/Music`
- `backdropKey: BackdropKey` — typed
- `playable: boolean` — false = scaffolded only
- `map?`, `buildPlayers?`, `buildEnemies?` — only required when playable
- `victory?: VictoryCondition` — defaults to `routEnemies` if omitted
- `difficultyLabel: string` — display only

### 7.2 Victory Conditions

(`src/combat/Victory.ts`)

`(state, round) → "player" | "enemy" | null`. Built-ins:

- `routEnemies` — kill all enemies, don't die (default)
- `defeatUnit(idOrPredicate, opts)` — boss kill; mooks irrelevant
- `surviveRounds(n)` — defense; player wins on round n+1
- `escapeToTile(target, opts)` — get a unit to a tile
- `protectUnit(unitId, rounds, opts)` — escort

Combinators:
- `allOf(...conds)` — AND
- `anyOf(...conds)` — OR

Composed labels concatenate with `" + "` and `" or "`. The label shows
in the battle HUD as the goal text.

### 7.3 Map Authoring

(`src/data/maps.ts`)

- Use the `t(terrain, obstacle?)` helper to declare cells
- Hoist shared terrain consts to the section that uses them first
- Each map: 2D array of cell descriptors + `startPositions: { player, enemy, ally? }`
- Validate cell coords are walkable (not blocked by tree/rock/wagon/pillar/hay/torch obstacles)
- Hand-tune so player squad starts with 1–3 turns of breathing room
  before melee contact

### 7.4 Naming Conventions

- Battle ids: `b##_<label>` (e.g., `b04_swamp`)
- Arc ids: `<position>_<label>` (`pre_palace`, `post_farmland`, `before_mountain`)
- Backdrop keys: `bg_<label>` (`bg_swamp`)
- Enemy unit ids: `<faction>_<class>_<n>` (`dawn_sw1`, `amb_a1`, `nd_s1`)

---

## 8. Story Authoring

### 8.1 StoryArc Anatomy

(`src/story/beats.ts`)

- `id: ArcId` — typed
- `title`, `subtitle?` — banner text
- `beats: DialogBeat[]` — ordered dialog screens
- `next: RouteRef` — `story:<arc>` | `prep:<battle>` | `credits` | `overworld`
- `music` — narrow union of arc-appropriate music slugs
- `backdrop?` — backdrop spec key (camelCase, NOT bg_-prefixed)

### 8.2 DialogBeat

- `speaker?` — name shown in heading
- `portraitId?: PortraitId` — character portrait. Use `"narrator"` for omniscient narration (no portrait shown)
- `expression?` — variant slug; resolves to `<id>_<expression>.png`
- `body` — 1–4 sentences. Long beats auto-paginate (5 lines per page) in StoryScene
- `ambient?` — optional palette tint (rarely used)
- `promote?: PortraitId` — (NEW) trigger Tier 2 promotion for this character after the beat advances
- `scriptedDeath?: PortraitId` — (NEW) remove this character from the roster after the beat advances

### 8.3 Pagination

StoryScene auto-paginates beats whose body wraps to more than 5 lines.
The Continue button label flips to "More ▾" while pages remain in the
current beat, then "Continue ▸" on the last page. Portrait + speaker
stay fixed across pages of the same beat.

### 8.4 Music Conventions per Arc

- Cold-open / pre-fight setup → `trailer` or `ravageDaredevil`
- Quiet character beats → `everydayLife` or `emotional`
- Tense build-ups → `danger`
- Travel / arrival sequences → `adventureAnthros` or `adventure1`
- Act 2 (Gruge) → `lifeInGrude`

---

## 9. Asset Conventions

### 9.1 Portraits

- `public/assets/portraits/<character>.png` — base portrait
- `public/assets/portraits/<character>_<expression>.png` — expression variant
- `DEFAULT_VARIANT_FOR` in `src/assets/expressions.ts` lets the base
  file be aliased to a refined variant (e.g., `kian` defaults to
  `kian_neutral.png`)
- All expressions registered in `PORTRAIT_EXPRESSIONS`
- Missing files silently 404 → procedural fallback (only if palette metadata exists)

### 9.2 Sprites

- `public/assets/sprites/<class>/idle.png` (32×40), `walk.png`, `attack.png`, `hit.png`, `death.png`
- Currently only `idle.png` ships for most classes
- Missing files trigger DEV-only console warning at first spawn
  (`UnitArt.ensureUnitTexture`); production silently uses procedural fallback
- `UnitDef.spriteClassOverride?: ClassKind` lets a unit render as a
  different class's sprite while keeping its mechanical class. Used for
  Kian (knight mechanically, swordmaster visually until knight sprites ship).

### 9.3 Backdrops

- `public/assets/backdrops/<key>.png` (1280×720)
- 11 keys defined in `BackdropKey`: palaceCoup, thuling, farmland,
  mountain, swamp, caravan, monastery, orinhal, cliffs, grude, finalBoss
- Story-only backdrops: factory, field_night_camp, rusty_house, study, tavern
  (these aren't `BackdropKey`s — they only appear in `StoryArc.backdrop`)

### 9.4 Tiles and Obstacles

- `public/assets/tiles/<terrain>.png` — replaces procedural tile painter
- `public/assets/obstacles/<obstacle>.png` — drawn over base tile

### 9.5 Audio

- All music files iterated by `BootScene` from `MUSIC_FILES` in `src/audio/Music.ts`
- Adding a new track: register `MUSIC.<key>`, add `MUSIC_FILES` entry, drop file in `public/audio/`
- BGM volume managed by shared `MusicManager` (singleton via game registry)

---

## 10. Save System

### 10.1 Save Slot Schema

(Single source of truth: `src/util/save.ts`. Schema bumped on additions.)

```ts
{
  schemaVersion: 2,                    // bump when shape changes
  characters: {                        // per-character roster
    amar: { level, xp, statBonuses: { hp, power, ... }, classKind, abilities, alive, inventory },
    lucian: { ... },
    // ...
  },
  completedBattles: BattleId[],
  graveMode: boolean,                  // set at New Game; immutable thereafter
  difficulty: "normal" | "hard" | "extreme",
  amarGender: "male" | "female",
  storyChoices: {                      // discrete branch points
    orinhal: "kings" | "dawn",         // Battle 8 choice
    dawn: "refuse" | "side",           // Battle 16 choice
    // ...
  }
}
```

### 10.2 What's NOT in the save slot

- Per-battle state (HP, AP, position) — not persisted; battles are
  atomic units that complete or restart from the BattlePrep entry.
- Settings (volume, etc.) — separate `localStorage` key, shared across slots.

---

## 11. Content ID Registry

Every cross-file string identifier in the game's content layer is a
discriminated string-literal union in `src/data/contentIds.ts`:

- `BattleId` — 21 entries
- `ArcId` — currently 11 entries; growing
- `BackdropKey` — 11 `bg_*` entries
- `RouteRef` — `story:${ArcId}` | `prep:${BattleId}` | "credits" | "overworld"

**When adding new content, ADD THE ID HERE FIRST.** The compiler then
walks you through every consuming file (battles.ts, beats.ts, route refs in
other arcs, EndScene's POST_ARC, etc.) and refuses to build until they
all match. Saves you from a stale-string runtime crash later.

---

## 12. Dev Tools

### 12.1 DevJumpScene

- Press `` ` `` (backquote) anywhere in the game to open a modal panel
- Lists all 21 battles + all story arcs + Title/Overworld/Credits buttons
- Click any cell to jump there (stops the source scene, starts the target)
- Tree-shaken from production via `import.meta.env.DEV` gate in `main.ts`

### 12.2 DEV-only warnings

- `ensureUnitTexture` warns once per (unit, class) when falling back to
  procedural sprite — surfaces missing-asset issues during dev playtest

---

## 13. Decisions Log (chronological)

Each row links a decision to the conversation that spawned it. Useful
when revisiting tradeoffs months later.

| Date | Decision | Rationale |
|---|---|---|
| 2026-04 | Type-safe content IDs | Stale string refs were silently routing to OverworldScene; now compile errors |
| 2026-04 | DevJumpScene hotkey panel | Faster iteration during battle authoring |
| 2026-04 | VictoryCondition primitive | Hard-coded rout-only blocked defense/escort/escape battle archetypes |
| 2026-04 | Battle 4 victory uses `anyOf(surviveRounds(4), routEnemies)` | First combinator use; lore-fit ("weather the ambush or break it") |
| 2026-04 | `spriteClassOverride` on UnitDef | Kian rendered procedural because no `knight` sprite folder; needed mechanical-class / visual-class split |
| 2026-04 | DEV warning at procedural fallback | "LOL crappy sprite" can't sneak past playtest anymore |
| 2026-04 | Initiative bar dedup | `upcoming(N)` cycles into next round → unit duplication; bar/dropdown now strip dupes |
| 2026-04 | Initiative dropdown shows overflow only | Was showing entire upcoming list; now strictly the slice the bar can't fit |
| 2026-04 | Dialog box pagination | Long b03/b04 narrator beats overflowed the 4-line panel |
| 2026-04 | Settings "Return to Map" option | Player needs an escape hatch from in-progress battles |
| 2026-04 | EXP/levels system | This doc; flat 100/level, % growths, level-diff XP scaling, max L20 |
| 2026-04 | Story-gated promotion | Differentiates from FE's grind-gated Master Seal; anchors mechanical growth to emotional beats |
| 2026-04 | Original-8 catch-up rule | L10 baseline + one-time bump to (squad_avg − 2) when rejoining; keeps elites elite without making them dead weight |
| 2026-04 | Wyvern → Dactyl | Codebase used `dactyl_rider` consistently; script had mixed Wyvern/Dactyl |
| 2026-04 | GA4 + custom event tracking | Page views in GA4; six custom events (new_game / arc / battle started/completed, level-up, promotion) for funnel analytics. Triple-gate (no gtag / localhost / DEV) so dev runs don't pollute prod. |
| 2026-04 | GDPR Consent Mode v2 banner | Default consent denied; one-time banner upgrades on Accept and persists choice in `localStorage('ravage:consent:v1')`. Same banner ships on landing + game pages, sharing the storage key. |
| 2026-04 | LV row moved into apText | Adding LV as its own stat row pushed the inventory line into the ACTIONS header below; compressed into the existing AP one-liner ("LV 3 · 45 XP · AP 3/3 · PLAYER") instead. |
| 2026-04 | Per-texture LINEAR filter for painted assets | Phaser's global `pixelArt: true` was forcing nearest-neighbor sampling on every texture, which made high-res portraits / backdrops / painted tiles look posterized when downscaled. BootScene now flips `portrait:` / `backdrop:` / `tile:` / `obstacle:` textures to LINEAR after load; sprites/VFX/UI keep NEAREST. |
| 2026-04 | Painted tile composite uses high-quality smoothing | The tile+obstacle composite path in TileArt was setting `imageSmoothingEnabled = false` when downscaling 600×600 painted source PNGs to 48×48 tiles — produced grainy mosaics. Flipped to `true` + `imageSmoothingQuality: "high"`. |
| 2026-04 | Damage number pop + crit flash | Floaters now scale-pop in (Back.easeOut to 1.2× / 1.45× crit, then settle to 1.0). Crits render larger (26px vs 18px), thicker stroke, deeper drop shadow, hang ~200ms longer. Sells the impact. |
| 2026-04 | Crisp text on retina displays | Monkey-patched `Phaser.GameObjects.GameObjectFactory.text` (in `src/util/crispText.ts`, called from main.ts before game construction) so every `scene.add.text(...)` gets `setResolution(devicePixelRatio)` + LINEAR filter on the resulting texture. Glyphs render at 2×/3× density and downsample smoothly instead of being nearest-stretched and chunky. No-op on 1× displays to avoid texture-memory inflation. |
| 2026-04 | AudioContext resume + retry-on-unlock in MusicManager | After the cold_open_dawn → pre_palace transition, the WebAudio context could drop to `"suspended"` and `sound.play()` returned silently — leaving the briefing in dead silence. Added explicit `context.resume()` before play + a +250ms retry if the sound is still not playing, with a DEV-only `[MusicManager]` console warn if even the retry fails. |
| 2026-04 | Battle 6 (Caravan) authored | 13×9 canyon-road map; eight-bandit coordinated ambush (4 archers on rim shelves + 2 speartons sealing east + 2 swordsmen pressing west); 5-unit squad (Amar/Lucian/Ning/Maya/Leo); routEnemies victory; ledger-reveal in the post arc sets up Fergus distrust. |
| 2026-04 | Battle 7 (Monastery / Selene) authored | 12×10 stone-corridor map with corridor pillars as kill funnels; Selene as boss (`ENEMIES.selene`, swordmaster, distinct id `selene_enemy` so future PLAYERS.selene recruitment doesn't collide); `defeatUnit("selene_enemy")` victory mirrors b05's Ndari pattern. The Lucian-tells-Amar-everything beat in `post_monastery` fires Lucian's Tier 2 promotion (Spearton → Spearton Lord, Phalanx ability) — first story-gated promotion in the playable slice. |
| 2026-04 | Vertical slice expanded 5 → 7 battles | Copy bumps in landing page (OG + section lede), README (table of playable battles), CreditsScene header, and EndScene's `isFinalPlayable` gate. post_mountain rerouted from `credits` → `before_caravan`; new end-of-slice gate is post_monastery. |
| 2026-04 | Scrollable text panels | Long battle intros (b07's monastery briefing, ~6 wrapped lines) overflowed both the BattlePrepScene Field Brief panel and the OverworldScene battle-card hover panel. New `src/ui/scrollableText.ts` helper wraps text in a geometry-masked Container with mouse-wheel scroll + auto-show/hide gold scrollbar. Both panels migrated; OverworldScene's old "truncate to 3 lines + ellipsis" hack deleted. |
| 2026-04 | Mid-battle dialogue framework | FE-style support conversations. New BattleDialogue types (`round_start`, `adjacent_eot`, `ally_killed_target` triggers) on BattleNode. New BattleDialogueScene (modal overlay, mirrors StoryScene panel + pagination, doesn't touch music). BattleScene checks triggers at startTurn (round + adjacency) + applyAttackEffects (kill). Starter set of 7 dialogues authored across b03/b04/b06/b07 — Maya recognizing Amar's footwork, Kian probing Amar in the swamp, Lucian buffering Kian, Maya commanding the caravan flank in round 2, Lucian flagging the captain's pouch, Lucian covering Amar at the monastery, the Amar/Selene face-to-face moment. |
| 2026-04 | Progression-decided stats (B2+ chars start at L1) | Earlier factories pre-bumped Maya / Leo / Kian / post-amnesia Amar to L2-4 to reflect "narrative training." Per design intent the player's curve should decide character strength, not the factory. All B2+ characters now start at L1; original-8 veterans (Selene / Ranatoli) keep their L10 baseline for B1 + the catch-up rule when they rejoin. Save's CharacterRecord still overrides factory defaults on every battle after the first appearance — replays of past battles use current stats, not the L1 first-appearance numbers. |
| 2026-04 | Battle gating in OverworldScene | Battles now have three states: locked (not in `save.unlockedBattles` — visible but darker, intro hidden, click shows "Locked — complete previous battles" floater), scaffolded (unlocked but not authored), and playable. Lock icon (🔒) on locked cards; subtitle replaced with "— locked —" so the grid view stays spoiler-free. Existing unlock-on-victory chain in BattleScene.checkEnd handles forward unlocks; loading a fresh save restricts the player to b01_palace_coup until they win it. |
| 2026-04 | RosterScene (party-status modal) | New scene launched from the OverworldScene "📋 Roster" button. Shows every player character with a save record, in chronological-recruit order. Each row has portrait/sprite avatar, name, current class (post-promotion), level + XP-toward-next, full current stat block (HP/PWR/ARM/SPD/MOV/AP from the save, not the factory defaults), and ability list. Geometry-masked scrollable list (reuses the BattlePrepScene roster pattern). Synthesizes a fallback "amar" entry from the "amar_true" record when the player has fought B1 but not B2 — keeps the roster from being empty between those two battles. |
| 2026-04 | Camera scrolling for oversized maps | BattleScene's main camera now has bounds = `max(viewport, map+margins)`, drag-pan via right-click, and arrow/WASD nudge. Maps that fit in the viewport are bounded == viewport (camera locked, drag is a no-op); maps bigger than viewport allow the player to pan around. UI is pinned via `setScrollFactor(0)` — implemented as a snapshot-after-units-loop bulk pin in `create()` plus explicit `this.pin(...)` at runtime UI creation sites (action buttons, phase banner, side panel avatar, dropdown). Hover damage preview is explicitly *unpinned* since it's positioned in world coords next to the hovered enemy. `screenToTile` updated to add `cameras.main.scrollX/Y` so click-on-tile still works after a pan. Browser context menu disabled so right-click drag doesn't pop a system menu. |
| 2026-04 | Significant-battle map expansions | Three of the slice's most narratively-weighted battles got bigger maps to give them spatial weight: B1 Palace Coup 13×9 → **18×14** (taller throne hall, three pillar ranks, vertical scroll), B5 Mountain Bandits 14×10 → **20×13** (wider pass + more terrain variation, vertical scroll), B7 Monastery 12×10 → **16×15** (five vertically-stacked rooms — vestibule → outer chapel → middle chamber → inner sanctum → bell tower altar — vertical scroll). Maps for B2/B3/B4/B6 unchanged — they still fit in the viewport and play the same. Enemy + player counts unchanged across all three; only positions adjusted to fit the new dimensions. |
| 2026-05 | thuling_arrival intro beat + obstacle blur fix + RosterScene active-squad filter | Three threads. (1) thuling_arrival now opens with Lucian and Ning introducing themselves to Amar at the forge before the existing hammer-grip beat — addresses a gap where the script implied the meeting but never dramatized it. (2) Tile rendering refactored: terrain and obstacle render as separate sprites instead of being composited into a single canvas with `imageSmoothingQuality: "high"`. The composite path's smoothing was softening the obstacle's alpha edges into the underlying painted tile and blurring it. New `ensureObstacleTexture(scene, obstacle)` returns the obstacle PNG (or a transparent procedural canvas) keyed once per obstacle kind; BattleScene's tile loop draws terrain then optionally an obstacle on top. Both layers preserve their native LINEAR-filter quality and the alpha blend happens at the GPU level instead of being baked into the bitmap. (3) RosterScene filters to the CURRENT ACTIVE SQUAD based on completed battles via a new `ACTIVE_ROSTER` table (B1: just Amar, B2: +Lucian/Ning, B3: +Maya, etc.). Without this filter the post-B1 roster kept showing Ranatoli + Selene + amar_true even though those characters were captured in the failed coup; now post-B1 shows only Amar (synthesized from the amar_true record) and the squad accumulates as the player progresses. |
| 2026-05 | B1 capture beat + Nebu hold-position + B7 Selene "Sh!!" recognition | Three small narrative tightenings. (1) New `before_victory` BattleDialogue trigger fires after the victory condition resolves to `"player"` but BEFORE the EndScene transition; the dialogue plays out as a paused overlay and the transition resumes when the player advances past the last beat. Wired for B1's capture sequence — squad mechanically wins (royal guard wiped) but reinforcements pour out from behind the second-rank pillars and pounce Amar/Ranatoli/Selene; the four unseen coup members (Khonu, Tev, Yul, Sera) get name-checked here so the player has anchors for the seven-comrades framing. (2) New `holdPositionUntil: { allyCount }` field on UnitDef; AI early-returns "end" until the unit's faction count drops to/below the threshold. King Nebu sits the throne until only one Royal Guard remains, then engages — matches the script's "the King doesn't expect to need to fight" framing. (3) B7's `b07_amar_selene_eyes` reworked: Selene starts to say "Am—", Amar cuts her off with "Sh!!", a silent narrator beat sells the year-old reflex of two coup members covering each other at a glance, then both pivot to public-register lines before Selene drops the "don't follow me past the bell" beat. |
| 2026-04 | Battle 8 (Orinhal) + Battle 9 (Ravine) authored; chapters 1–9 chain | Two more playable battles + four new arcs (`before_orinhal`, `post_orinhal`, `before_ravine`, `post_ravine`). post_monastery rerouted from `credits` → `before_orinhal`; new end-of-slice gate is post_ravine. b08 is a 14×11 cobblestone town square (squad vs King's tax detail + hired bandits, 5 vs 7); b09 is a 12×14 narrow canyon (squad ambushed mid-ravine, must escape through a south river ford OR rout the elite "regiment in disguise"; victory = `anyOf(surviveRounds(5), escapeToTile, routEnemies)`). post_orinhal fires Leo's promotion (Tier 2 = Dactyl King). post_ravine fires Maya's promotion (Tier 2 = Shinobi Master, the moment she names herself as Dawn's officer) AND Ning's promotion (Tier 2 = Robinhelm, the moment she stops being the bowyer's apprentice afraid of her draw). Three story-gated promotions in two arcs — first time multiple characters promote in adjacent beats. Slice copy bumped from "seven" → "nine" battles in landing page, README, CreditsScene, and EndScene's `isFinalPlayable` gate. |

---

## 14. Open Questions / Future Work

- **Bond/counter activation rules** — adjacency check timing, magnitude tuning, UI cue when a bond/counter is in effect
- **Difficulty multipliers** — Normal/Hard/Extreme exact `level` deltas; whether to also tweak XP rewards
- **Marriage UI at endgame** — character picker, bond-compatibility filter, ending CG variants
- **Sprite assets for Tier 2 classes** — currently no swordmaster/khan/etc. sprite folders; promotion will fall back to procedural with a DEV warning until they ship
- **Sprite assets for `knight` class** — Kian's `spriteClassOverride: "swordmaster"` is a temporary stand-in
- **Pivotal elimination audit** — beyond the script-mandated deaths, do any other battles (B7? B19?) deserve scripted deaths or special elimination rules?
- **Madame Dawn faction visual differentiation** — currently uses base bandit palette; consider a `dawn_raider` palette + name override
- **Selene / Ranatoli rejoin beats** — when exactly does Ranatoli rejoin? Doc references him at B21 but earlier rejoin would help the squad
- **Tutorial/tooltips for the progression system** — first level-up should explain what's happening
- **Save slot UI for Grave mode + difficulty** — currently set in code; needs the New Game flow

---

## 15. Cross-References

- Code entry points: `src/main.ts` (Phaser config), `src/scenes/` (every Scene)
- Combat math: `src/combat/Damage.ts`, `src/combat/Stances.ts`, `src/combat/Initiative.ts`
- Progression: `src/combat/Progression.ts`
- Content data: `src/data/units.ts`, `src/data/maps.ts`, `src/data/battles.ts`
- Story content: `src/story/beats.ts`
- Type registry: `src/data/contentIds.ts`
- Save: `src/util/save.ts`
- Scenes: `src/scenes/BattleScene.ts` (combat), `src/scenes/StoryScene.ts` (dialog),
  `src/scenes/BattlePrepScene.ts` (pre-battle roster), `src/scenes/EndScene.ts` (post-battle)

---

*Last updated: see `git log -- docs/RAVAGE_DESIGN.md`.*
