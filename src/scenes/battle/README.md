# `src/scenes/battle/` — BattleScene support modules

`BattleScene.ts` was 2,925 LOC and 75+ methods at the top of the audit
pass that recommended splitting it. This directory holds modules
extracted along the comment-marked seams in BattleScene, plus the
existing `BattleFSM` (the input/turn state machine). Anything in here
should be importable into BattleScene without circular-dependency
acrobatics — these modules reach UP into the scene only through the
arguments they're handed at call time.

## What's here today

| File | Role | Pattern |
|------|------|---------|
| `BattleFSM.ts` | Input/turn state machine. Pure state transitions. | Pure module — no Phaser, no scene ref. |
| `RavageVfx.ts` | Aura texture + per-unit pulse + RAVAGED announce. | Top-level functions; scene + view passed in. |

## Extraction roadmap

The audit recommended five extractions to drop BattleScene under ~2,000 LOC.
RavageVfx landed first as the proof-of-concept. Order for the rest:

### 2. `InitiativeBar.ts` (~200 LOC)
- Methods: `refreshInitiativeBar`, `buildInitiativeCell`,
  `buildInitiativeExpander`, `toggleInitiativeDropdown`,
  `openInitiativeDropdown`, `closeInitiativeDropdown`.
- State: `initiativeBar`, `initiativeDropdown`, `initiativeDropdownOpen`.
- Pattern: a small class that owns the bar Container and the dropdown
  state. Constructor takes the scene + the Initiative instance + the
  state (so it can call `state.units` for upcoming refresh). One public
  method `refresh(round, units)` covers the bar; the dropdown toggle
  hangs off the expander cell.

### 3. `BattleAnimations.ts` (~400 LOC)
- Methods: `delay`, `startBreathing`, `stopBreathing`, `spawnDust`,
  `applySpentTint`, `flashSprite`, `spawnDamageNumber`,
  `applyAttackEffects`, `announceXpGain`, `announceLevelUp`.
- Biggest single extraction. Watch the cross-references: damage flash
  → `refreshUnitView` → spent tint, XP/level-up → side panel + log.
- Pattern: top-level functions like RavageVfx. Many take a `Scene` +
  `UnitView` + an opts blob with the callbacks back into BattleScene.

### 4. `DialogueTriggers.ts` (~150 LOC)
- Methods: `checkDialogueTriggers`, `matchesTrigger`,
  `findBeforeVictoryDialogue`, `fireDialogue`, `checkKillDialogue`,
  `checkAttackDialogue`.
- Mostly pure logic over `node.dialogues` + an emit callback into
  `BattleDialogueScene`. Should fall out cleanly.

### 5. `SidePanel.ts` (~250 LOC) — defer if budget tight
- Methods: `setSidePanelAvatar`, `refreshSidePanel`, `showInfoFor`,
  `refreshActiveRibbon`.
- Biggest structural lift. The panel reads many fields off the scene
  (statText, avatarBg, wpnZone/ablZone/invZone, etc.). A `BattlePanelDeps`
  interface that names exactly what the panel reads keeps the import
  graph clean.

## Don't extract

- `pin()` — the Phaser-quirk-aware scroll-pinning helper. Used by every
  extracted module that adds UI. Keep it on BattleScene; pass it in as
  a callback if a module needs to pin its own children.
- Action buttons / item picker — tightly coupled to the FSM and turn flow.
- Pointer handlers — same reason.
- Camera scrolling — too few lines to justify a module.
- `beginCurrentTurn` / `endCurrentTurn` / `checkEnd` — the central nervous
  system; keep on BattleScene.

## Conventions

- Modules do NOT hold a long-lived scene reference. The scene is passed
  in at call time. This sidesteps circular imports and makes scene
  teardown predictable.
- If a module needs persistent state (a Container the scene built once),
  it hands that back to the scene to store on a field — the scene owns
  the reference, the module operates on it.
- Match the existing comment style — header block explaining the
  module's role + cross-references to the design doc when relevant.
