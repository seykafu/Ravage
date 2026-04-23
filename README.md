# Ravage

A tactical RPG vertical slice — three battles from a 21-battle story about Amar, the man who tried to take a country and now has to learn to deserve it.

Built with **Phaser 3 + TypeScript + Vite**. All sprites, portraits, and backdrops are generated procedurally at runtime via offscreen Canvas. All sound effects are synthesized via WebAudio. The only external assets are the nine music tracks in `public/audio/`.

## Vertical slice contents

Three playable battles drawn from the larger 21-battle script:

| # | Title | Music |
|---|-------|-------|
| 1 | The Palace Coup | *Entering the Stronghold* |
| 2 | Bandits in the Farmland | *Danger* |
| 5 | The Mountain Bandits — Ndari (first boss) | *Stronghold of Memories* |

Battles 3, 4, and 6–21 exist as data stubs in the world map for narrative continuity but are not playable in the slice.

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

- **Speed-based initiative.** No phase alternation. The unit with the highest speed acts next; everyone has 2 AP per turn.
- **Move (1 AP) + Attack (1 AP).** Or two attacks. Or one move, one stance.
- **Stances cost the rest of your turn.**
  - **Ready** — first melee attacker entering your reach takes a counter at +25% damage / +5% crit. Archers do not counter; speartons cover 1–2 range.
  - **Defensive** — incoming damage halved.
- **Weapon triangle.** Sword > Spear > Shield > Sword (×1.15 / ×0.85).
- **Hit clamped 50–99.** Crit varies by class.
- **Hover any tile or enemy** for a damage preview.
- **Tab** toggles a debug overlay (unit IDs, AP, threat).
- **Esc** cancels the current targeting mode.

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
- Gruge faction map (Battles 11–18)
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
  util/                   constants, save (localStorage), Rng, math
```

## Save data

`localStorage["ravage:save:v1"]` holds completed/unlocked battle IDs and a small `flags` map for narrative branching. Clear it via the **New Game** button on the title screen, or by clearing site data.
