# Ravage

A tactical RPG vertical slice — nineteen battles per run (eighteen shared + one of seven path-opener finales) from a 30-battle story about Amar, the man who tried to take a country and now has to learn to deserve it.

Built with **Phaser 3 + TypeScript + Vite**. All sprites, portraits, and backdrops are generated procedurally at runtime via offscreen Canvas. All sound effects are synthesized via WebAudio. The only external assets are the music tracks in `public/audio/` and the named-character portraits in `public/assets/portraits/`.

## Vertical slice contents

Eighteen playable battles closing out the first half of the campaign and opening the second — squad assembly, the bandit / monastery / Orinhal arc, the cliff exit to Madame Dawn's ship, the empire's welcome at the Grude harbor, the rebellion strike where Rose pays the cost, the night Amar learns whose child he really is, the mole inside Dawn's own house, the King's Knife on the river bridge, the break with Dawn when her lie comes whole, and the empire's last boarding party on the open sea before Amar chooses his path from the Seven Names:

| # | Title | Music |
|---|-------|-------|
| 1 | The Palace Coup | *Entering the Stronghold* |
| 2 | Bandits in the Farmland | *Danger* |
| 3 | Madame Dawn's Bandits | *Spine of the World — Battle* |
| 4 | Ambush in the Swamp | *Spine of the World — Battle 2* |
| 5 | The Mountain Bandits — Ndari (first boss) | *Stronghold of Memories* |
| 6 | The Caravan | *Spine of the World — Battle* |
| 7 | The Ghost from Para (Selene the Swordmaster) | *Spine of the World — Battle 2* |
| 8 | The Town of Orinhal (the choice in the square) | *Danger* |
| 9 | The Price of Doubt (Fergus's trap, Maya's reveal) | *Danger* |
| 10 | Leaving Thuling (Kian's blockade) | *Stronghold of Memories* |
| 11 | The Cliffs (Kian's truth, Lucian's farewell) | *Stronghold of Memories* |
| 12 | The Ravage (Grude harbor, the colony reveal lands) | *Grude Battle 1* |
| 13 | Madame Dawn's Rebellion (Rose dies for the captain) | *Spine of the World — Battle 2* |
| 14 | The Origin (Amar's parentage; the empire comes for the heir) | *Spine of the World — Battle 2* |
| 15 | A Coup Within a Coup (Coyne the mole; Ndara falls) | *Spine of the World — Battle 2* |
| 16 | Dawn's Proposal (the throne offer; the King's Knife) | *Spine of the World — Battle 2* |
| 17 | Dawn's Lie (Khione's truth; the break with Dawn) | *Spine of the World — Battle 2* |
| 18 | Seven Names, One Choice (the empire's last boarding party; the path fork) | *GrudeBattle1* |

After B18's victory the **Seven Paths** choice (ChoiceScene) forks the campaign — the player commits Amar to one of seven philosophies, which is persisted to the save and gates the path-specific chapters to come.

Battle 19 is the Seven Paths payoff: all seven path openers are playable — Vengeance (kill Lord Castor on the canyon road), Restoration (hold the road at Khonu's village), Revolution (burn the border granary), Duty (hold the frontier bridge for six rounds), Exile (Amar alone against a kill team in the snow), Mercy (subdue the holdout captain of a fort that wants to surrender), and Forgetting (a fisherman with a soldier's hands, alone on the beach). Each run plays exactly one, chosen at B18, each with its own epilogue and credits. Battles 20–30 remain data stubs for the full campaign.

## Setup

Requires Node 18+.

```bash
npm install
npm run dev          # http://localhost:5173
```

## Build

```bash
npm run build        # tsc -b && vite build → dist/
npm run preview      # preview the built bundle on :4173
```

## Combat — what to know

- **Phase-based initiative.** Player + ally units act first, then enemies. Within a phase units act in Speed order.
- **Action Points (AP).** Move / Attack / Ready / Defend / Use Potion all cost 1 AP. AP per unit is set per-stat-block (2 or 3).
- **Stances cost an AP and last until your next turn.**
  - **Ready** — first melee attacker entering your reach takes a counter at +25% damage / +5% crit. Archers do not counter; speartons cover 1–2 range.
  - **Defensive** — incoming damage halved.
- **Weapon triangle.** Sword > Spear > Shield > Sword (×1.15 / ×0.85).
  - If your weapon advantages the attacker's, you **passively counter at 1.5× damage** when struck — no Ready stance required.
- **Items.** Each unit may carry up to **5 items** per battle. Players start every battle with **3 Potions** (+10 HP, 1 AP).
- **Mounted classes** (`knight`, `dactyl_rider`) get **+2 movement** above their base stat.
- **Special abilities** (max 2 per character):
  - **Boss Fighter** — 2× damage vs. boss-class enemies. *(Amar)*
  - **Aide** — incoming damage halved while adjacent to any ally. *(Lucian, Ning, Maya)*
  - **Destruct** — when slain, the killing blow's attacker also dies. *(Leo, Ranatoli)*
  - **Roam** — once per turn, after AP is spent, may take one **free Move**. *(Leo and any future Knight / Dactyl)*
- **Hit clamped 50–99.** Crit varies by class.
- **Hover any tile or enemy** for a damage preview.
- **Tab** toggles a debug overlay (unit IDs, AP, threat).
- **Esc** cancels the current targeting mode.

> Names from the full script not yet in the slice — `Dawn` (Boss Fighter), `Kian` (Destruct) — will get their abilities wired when their data entries are added.

## Story files

The full 21-battle script and design docs live separately at `C:\Users\kasey\Documents\Ravage Scripts\` (Word .docx). The slice was built directly from those documents — any divergence between the game and the script should be treated as a bug in the slice, not the script.

Key documents:
- `Ravage_script_v2_Official.md` — the full battle-by-battle script
- `Ravage_combat_system.md` — combat rules (this implementation)
- `Ravage_strategic_layer.md` — between-battle hub design (Phase 1/2/3) — **not yet implemented**
- `Ravage_dawn_arc.md`, `Ravage_leo_arc.md`, `Ravage_maya_arc.md` — character arc setups

## What's not here yet

Everything the strategic-layer doc describes:
- Thuling Interludes (between Battles 2–10)
- Grude faction map (Battles 11–18)
- Anthros Restoration governance (post-Battle 19)
- Bond conversations
- Trust Meter (Battle 16 fork — Dawn route vs. non-Dawn route)
- Battles 3, 4, and 6–21
- Maya's seven inserted beats from `Ravage_maya_arc.md`
- The four resources (Labor / Stores / Gold / Morale) and the seven Edicts

The vertical slice is the foundation those systems will sit on top of. Combat is in. Initiative is in. Save/unlock is in. Story scenes plug into a generic `StoryScene` that can carry the bond conversations later. The world map (`OverworldScene`) already shows all 21 nodes — the unplayable ones are visibly locked.

## File map

```
src/
  scenes/
    BootScene.ts          asset preload
    TitleScene.ts         New Game / Continue
    StoryScene.ts         dialog beats with portrait, typewriter reveal
    OverworldScene.ts     21-node world map
    BattlePrepScene.ts    pre-battle briefing + deploy
    BattleScene.ts        the actual combat — initiative, AP, stances, AI
    EndScene.ts           victory / defeat resolution
    CreditsScene.ts       slice-end credits roll
  combat/                 pure logic — Grid, Damage, Stances, AI, Initiative
  data/                   battles, maps, units (the 21 BattleNodes)
  art/                    procedural sprite/portrait/backdrop/tile generators
  audio/                  Music manager (crossfade) + WebAudio sfx
  story/                  dialog beats + arc graph
  ui/                     Button, Panel
  util/                   constants, save (local slots), Rng, math
```

## Save data

Ravage is a **fully local game**. There is no account, no sign-in, and no
server: everything the player earns lives in their own browser's
`localStorage`, on their own machine.

- **Three save slots**, all on the device. Slot caches live at
  `ravage:save:v1:slot{1,2,3}`.
- `localStorage["ravage:save:v1"]` is the active mirror of the currently
  selected slot — the gameplay code reads and writes this one.
- `ravage:current_slot:v1` records which slot is active.

Because saves are browser storage, clearing site data for the origin (or
playing in a different browser / private window) starts a player fresh.
The slot picker says as much on screen.
