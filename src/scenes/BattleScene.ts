import Phaser from "phaser";
import { COLORS, FAMILY_BODY, FAMILY_HEADING, FAMILY_MONO, GAME_HEIGHT, GAME_WIDTH, RENDER_SCALE, TILE_SIZE } from "../util/constants";
import { ensureBackdropForKey } from "../art/BackdropArt";
import type { BattleId } from "../data/contentIds";
import { ensureUnitTexture } from "../art/UnitArt";
import { OrthographicProjection, type Projection } from "../render/Projection";
import { ObliqueProjection } from "../render/ObliqueProjection";
import { elevationFor } from "../render/elevation";
import {
  DIORAMA_ELEV_STEP, DIORAMA_FOOT_DY, DIORAMA_SLAB_DEPTH, DIORAMA_TILE_H, DIORAMA_TILE_W,
  UNIT_DIORAMA_H, UNIT_DIORAMA_W, UNIT_FLAT_H, UNIT_FLAT_W
} from "../render/dioramaConfig";
import { DEPTH, actorDepth } from "../render/depth";
import { SUN, UNIT_FOOT_ORIGIN, castFrom, torchShadow, type Sun } from "../render/sun";
import { DIORAMA_PERSPECTIVE_K } from "../render/dioramaConfig";
import { screenToSource, sourceToScreen, type KeystoneParams } from "../render/keystone";
import { PERSPECTIVE_PIPELINE, PerspectivePipeline } from "../render/PerspectivePipeline";
import { attachPostPipeline } from "../render/postPipelines";
import type { BattleBackdropScene } from "./BattleBackdropScene";
import { buildDiorama, faceColour, type DioramaGrid, type DioramaProp, type DioramaTop } from "./battle/Diorama";
import { RotatedProjection, normalizeRotation, viewSize, type ViewRotation } from "../render/ViewRotation";
import { terrainDepth } from "../render/depth";
import { IconButton } from "../ui/IconButton";
import { bodyCentre, figureAt } from "./battle/HitMask";
import { pickTile, type PickCandidate } from "../render/pick";
import { Grid } from "../combat/Grid";
import { Initiative } from "../combat/Initiative";
import { beginUnitTurn, createUnit, damageUnit, effectiveMaxAp, endUnitTurn, hasAbility, isAlive, useItem } from "../combat/Unit";
import { Rng } from "../util/rng";
import { drawPanel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { SettingsButton } from "../ui/SettingsButton";
import { FastForwardButton } from "../ui/FastForwardButton";
import { IconToggleButton } from "../ui/IconToggleButton";
import { allEnemyDanger } from "../combat/Danger";
import { battleById, resolveBattleForPath, waveKey, type BattleNode, type BattleWave } from "../data/battles";
import { PROMOTIONS } from "../data/promotions";
import {
  BattleState,
  applyAttackOutcome,
  effectiveMovement,
  enterStance,
  interposeCandidates,
  moveUnit,
  performAttack,
  reachableForUnit,
  rollAttackOnly,
  targetsForUnit,
  unitAt
} from "../combat/Actions";
import { routEnemies, type VictoryCondition } from "../combat/Victory";
import { previewAttack } from "../combat/Damage";
import {
  canTriggerReadyCounter,
  canTriggerRelentlessCounter,
  canTriggerSpeedCounter,
  counterZoneTiles,
  hasDefensiveStance,
  hasReadyStance,
  spendReady
} from "../combat/Stances";
import type { InterposeCandidate } from "./InterposeScene";
import { executePlan, planEnemyTurn } from "../combat/AI";
import {
  awardXp,
  catchUpToSquad,
  squadAverageLevel,
  xpRewardFor,
  type LevelUpReport
} from "../combat/Progression";
import { trackBattleCompleted, trackBattleStarted, trackCharacterLeveledUp } from "../util/analytics";
import { getMusic } from "../audio/Music";
import {
  sfxAttackHit,
  sfxAttackMiss,
  sfxLensBeam,
  sfxCancel,
  sfxClick,
  sfxConfirm,
  sfxCrit,
  sfxRavage,
  sfxDeath,
  sfxDefeat,
  sfxHover,
  sfxStance,
  sfxStep,
  sfxVictory,
  sfxXpGain
} from "../audio/Sfx";
import {
  completeBattle,
  clearSuspendedBattle,
  getAssignedInventory,
  getCharacterRecord,
  getSquadInventory,
  hasExceededDeathLimit,
  loadSave,
  capturePathForkSnapshot,
  PATH_FORK_BATTLE,
  recordSquadDeaths,
  setCharacterRecord,
  setSquadInventory,
  getSevenPath,
  unlockBattle,
  writeSave,
  writeSuspendedBattle
} from "../util/save";
import { deserializeUnit, serializeUnit } from "../combat/Suspend";
import { ITEM_CATALOG, createItem, equipmentBonuses } from "../combat/items";
import { applyDifficultyToEnemy } from "../combat/Difficulty";
import { applyCinematicFX } from "../art/CinematicFX";
import { announceRavaged, clearRavageAura, refreshRavageAura, syncRavageAura } from "./battle/RavageVfx";
import { critShockwave, fireArrow, hitSpark, lensBeam, missWhiff, slashArc } from "./battle/CombatVfx";
import { reconcilePostBattleInventory } from "./InventoryScene";
import { BATTLES } from "../data/battles";
import { buildRetreatBeat } from "../data/retreatLines";
import { ELIXIR_HEAL, POTION_HEAL, type ItemKind, type MapDef, type TilePos, type Unit } from "../combat/types";

// Display heal amount per consumable kind. Used by the in-battle item
// picker to show "+10 HP" / "+25 HP" without re-deriving it from the
// useItem switch. Future consumables (antidotes, buffs) can be added
// here with 0 if the effect isn't a heal — picker will read that as
// "no HP gain" without crashing.
const HEAL_AMOUNT_FOR_KIND: Record<ItemKind, number> = {
  potion: POTION_HEAL,
  elixir: ELIXIR_HEAL,
  mask: 0,
  fang: 0,
  royal_lens: 0,
  dactyl_food: 0
};
import { playUnitState, hasUnitState } from "../assets/unitAnim";
import { hasAsset } from "../assets/manifest";
import { BattleFSM } from "./battle/BattleFSM";
import { InitiativeBar } from "./battle/InitiativeBar";
import { DialogueDirector } from "./battle/DialogueDirector";
import { atmosphereForBackdrop, createAtmosphere, ensureDotTexture } from "./battle/Atmosphere";
import { ashBurst, groundDust, hitStop, soulWisp, timeDilate } from "./battle/Impact";
import { finaleFor, playFinale, type FinaleHost, type Pt } from "./battle/Finale";
import { TutorialDirector } from "./battle/Tutorial";

interface BattleArgs {
  battleId: BattleId;
  // True when entering via "Resume Battle" — create() rebuilds the board
  // from save.suspendedBattle instead of the battle's fresh roster.
  resume?: boolean;
}

interface UnitView {
  unit: Unit;
  sprite: Phaser.GameObjects.Sprite;
  // Soft cast-shadow ellipse drawn at the unit's feet. Tweened independently
  // of the sprite during moves/lunges so the body can lean while the shadow
  // stays planted on the tile.
  shadow: Phaser.GameObjects.Ellipse;
  baseY: number;  // origin Y for idle bob; updates after every move
  hpBg: Phaser.GameObjects.Graphics;
  hpBar: Phaser.GameObjects.Graphics;
  stanceIcon: Phaser.GameObjects.Text;
  // Slow ±1px y-bob that simulates breathing while idle. Killed before any
  // explicit move/lunge tween (which also targets sprite.y) and restarted
  // afterward to avoid two tweens fighting over the same property.
  breathTween?: Phaser.Tweens.Tween;
  // The figure's silhouette thrown across the ground by the sun (render/
  // sun). Absent on dark battles and the flat board. Synced to the
  // sprite's frame, facing and fade every frame in update().
  castShadow?: Phaser.GameObjects.Image;
  // Crimson glow rendered behind the sprite while the unit is in their
  // Ravaged turn (UnitState.ravagedActive === true). Created lazily by
  // refreshRavageAura(); pulses via a yoyo tween, removed when the turn
  // ends. Sits below the sprite in z-order so the unit silhouettes on
  // top of the glow rather than being washed out by it.
  ravageAura?: Phaser.GameObjects.Image;
  ravageAuraTween?: Phaser.Tweens.Tween;
  // Damage-lag ghost: the HP ratio the bar is currently DISPLAYING.
  // On damage the pale segment holds at the old value for a beat, then
  // drains down to the real ratio — the classic "how much that hit
  // actually cost" read. Healing snaps it up instantly.
  hpShown?: number;
  hpGhostTween?: Phaser.Tweens.Tween;
  // Set while an animation owns the sprite outright — position, facing,
  // alpha, visibility — so refreshes leave it alone:
  //   "dying"    the fall and fade. The unit is already dead in state, and
  //              a refresh hides dead units — which, since attack
  //              resolution refreshes the defender BEFORE the death plays,
  //              meant no death animation had ever been seen.
  //   "arriving" a reinforcement striding in off the board edge. The turn
  //              start that follows a wave refreshes every unit, which
  //              turned arrivals round to walk in backwards.
  animLock?: "dying" | "arriving";
  // Ends an arrival early, on its tile at full alpha, when anything else
  // needs the sprite: a move, a lunge, a flinch, a death (stopBreathing).
  finishArrival?: () => void;
}

const PANEL_W = 280;

/** The board laid out at one rotation (see BattleScene.computeLayout). */
interface BoardLayout {
  rotation: ViewRotation;
  rotProj: RotatedProjection;
  /** Heights in VIEW coordinates for this rotation. */
  elevAt: (x: number, y: number) => number;
  originX: number;
  originY: number;
  /** Board + margins, never smaller than the screen: frames the opening view. */
  tight: { w: number; h: number };
  /** The camera's scroll limits: the tight bounds plus drag slack. */
  cameraBounds: { x: number; y: number; w: number; h: number };
  /** World centre of the ground (unlifted) — the pivot a turn spins about. */
  centre: { x: number; y: number };
}

/**
 * An animated turn of the board (BattleScene.beginSpin). While it runs the
 * static diorama is hidden and a TURNTABLE stands in for it: every tile top
 * a textured quad turned by the board angle and foreshortened, every wall a
 * shaded quad, every prop and unit a billboard placed by the same turn.
 */
interface SpinState {
  /** Board angle (radians; a quarter-turn is PI/2 — rotation r = r quarters). */
  phi: number;
  vel: number;
  target: number;
  dir: 1 | -1;
  /** The first quarter asked for: a quick click always completes it. */
  firstTarget: number;
  /** A turn to one fixed rotation (the view reset): never extended by holding. */
  fixed: boolean;
  held: boolean;
  elapsed: number;
  startScroll: { x: number; y: number };
  tops: { c: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image; gx: number; gy: number }[];
  walls: { g: Phaser.GameObjects.Graphics; gx: number; gy: number; colour: number }[];
  props: DioramaProp[];
  /** The static board, fading out as the turn begins: objects and their own alphas. */
  fade: { o: Phaser.GameObjects.GameObject & { alpha: number; setAlpha(a: number): unknown; setVisible(v: boolean): unknown }; a: number }[];
  /** Tactical overlays hidden for the turn, shown again after it. */
  hidden: { setVisible(v: boolean): unknown }[];
}
// Where a unit's HP bar sits, down from its sprite's centre — just above
// the feet, as it always was relative to the sprite.
const HP_BAR_DY = 20;

// Tooltip copy. Weapon entries cover the triangle math + base hit so a player
// hovering "WPN sword" can see why their numbers shift against a shield-user.
const WEAPON_INFO: Record<string, { title: string; body: string }> = {
  sword:  { title: "Sword",  body: "Beats Spear  (\u00d71.15)\nLoses to Shield (\u00d70.85)\nBase hit 85%   Range 1\nMelee — can counter and be countered." },
  spear:  { title: "Spear",  body: "Beats Shield (\u00d71.15)\nLoses to Sword  (\u00d70.85)\nBase hit 80%   Range 1\nMelee — can counter and be countered." },
  shield: { title: "Shield", body: "Beats Sword  (\u00d71.15)\nLoses to Spear  (\u00d70.85)\nBase hit 80%   Range 1\nDurable — strong with Defend stance." },
  bow:    { title: "Bow",    body: "Range 2 only — outranges all melee.\nCannot Ready stance counter.\nBase hit 75%.\nSafe at distance, weak up close." },
  dactyl: { title: "Dactyl", body: "Mounted melee. Range 1.\nNo weapon-triangle bonus or penalty.\nBase hit 80%.\nFast and resilient — boss-tier mount." },
  lens:   { title: "Lens",   body: "Range 2-3 beam — ignores HALF the target's armor.\nNo weapon-triangle bonus or penalty.\nBase hit 90% — the surest shot in the game.\nFragile carrier; keep her screened." }
};

const ABILITY_INFO: Record<string, { title: string; body: string }> = {
  BossFighter: { title: "Boss Fighter", body: "+100% damage when attacking a boss-class enemy.\nThe finisher you build a strategy around." },
  Aide:        { title: "Aide",         body: "Take half damage while adjacent to a friendly unit.\nReward for keeping your line tight." },
  Destruct:    { title: "Destruct",     body: "On death, the unit that landed the killing blow also dies.\nMakes finishing this unit very expensive." },
  Roam:        { title: "Roam",         body: "Once per turn, after all AP is spent, take one free Move.\nClosing distance or repositioning out of danger." },
  Refract:     { title: "Refract",      body: "A killing beam splashes 50% damage to one enemy\nadjacent to the target." },
  Mend:        { title: "Mend",         body: "Heal the most-wounded adjacent ally for 40% of their\nmax HP (1 AP). The mender earns XP for every heal." }
};

// ---- Initiative bar ----
// The bar + dropdown live in src/scenes/battle/InitiativeBar.ts (its
// layout constants moved there with it). BattleScene constructs one
// InitiativeBar in create() and calls refresh() on every turn change.
//
// Top banner height. Sized so the initiative bar (y=14, 64px tall) fits
// inside with 2px headroom and the side panel below — which has many
// hard-coded child Y positions anchored to its y=80 origin — sits flush
// with the bar's bottom.
const TOP_BAR_HEIGHT = 80;
const MAP_TOP_OFFSET = 92;

export class BattleScene extends Phaser.Scene {
  private battleId!: BattleId;
  private state!: BattleState;
  // Win/lose rule for this battle. Set in create() from node.victory, falling
  // back to routEnemies (kill all enemies). Read by checkEnd() and used to
  // populate the goal label in the top-left HUD.
  private victory!: VictoryCondition;
  private goalText!: Phaser.GameObjects.Text;
  private panHintText!: Phaser.GameObjects.Text;
  private initiative!: Initiative;
  private originX = 0;
  private originY = 0;
  // Coordinate seam (HD-2D Phase 1). Owns ALL tile↔world pixel math; built
  // once originX/originY are known (see create()). Today it's the flat
  // OrthographicProjection — pixel-identical to the old inline tileToPixel /
  // screenToTile. Swapping a 2.5D/3D projection in later is a one-line change
  // here, not a 14-site edit. See src/render/Projection.ts.
  private projection!: Projection;
  // The ¾ diorama board is the default; `?flat=1` restores the original
  // flat board (a real fallback — same code path, flat projection).
  private diorama = true;
  // Presentation-only tile height in levels (see render/elevation.ts).
  // Tile heights in VIEW coordinates (render/elevation, render/ViewRotation).
  // Read through elevAtTile() with a grid tile.
  private elevAt: (x: number, y: number) => number = () => 0;
  // ---- board camera: turn, zoom, drag ----
  // The rotation the board is drawn at (quarter-turns, see ViewRotation).
  private viewRotation: ViewRotation = 0;
  // The projection, typed as the rotation wrapper it always is.
  private rotProj!: RotatedProjection;
  // The map the board was built from (rebuilt on every turn).
  private boardMap!: MapDef;
  // Atmosphere kind, for the drifting cloud shadows rebuilt with the board.
  private boardAtmo: string | undefined;
  // Every object the board build created — destroyed and rebuilt on a turn.
  private boardObjects: Phaser.GameObjects.GameObject[] = [];
  // The camera's scroll limits (world px), and the world zoom at 1x.
  private cameraBoundsRect = { x: 0, y: 0, w: GAME_WIDTH, h: GAME_HEIGHT };
  private baseZoom = 1;
  // Player zoom on top of the base zoom (1 = the default view).
  private zoomFactor = 1;
  // The board laid out at each of the four rotations, and each one's tile
  // heights in GRID order (for the turntable to blend between).
  private layouts: BoardLayout[] = [];
  private gridHeights: Float32Array[] = [];
  // What the last board build drew, for the turntable.
  private dioramaTops: DioramaTop[] = [];
  private dioramaProps: DioramaProp[] = [];
  // An animated turn in progress, or none.
  private spin?: SpinState;
  // The turntable fading out over the freshly built board after a turn.
  private spinSettle?: { t: number; fadeIn: SpinState["fade"]; pieces: Phaser.GameObjects.GameObject[] };
  // A turn asked for while the board was busy (an attack, the enemy
  // phase); applied the moment input unblocks.
  private pendingSpin: { dir: 1 | -1 } | { to: ViewRotation } | null = null;
  // Which turn button is held (+1 ↻, -1 ↺, 0 none), and the turn keys.
  private spinButtonDir: 0 | 1 | -1 = 0;
  private keyQ?: Phaser.Input.Keyboard.Key;
  private keyE?: Phaser.Input.Keyboard.Key;
  // Hover x-ray: when what the pointer is on is hidden behind something
  // standing in front of it, its outline (and the tile's) is drawn through.
  private xrayImg?: Phaser.GameObjects.Image;
  private xrayUnitId: string | null = null;
  private cursorTopG?: Phaser.GameObjects.Graphics;
  // Hover rim: an outline round the unit a click would select, so on a
  // crowded tilted board it is never a guess which figure that is.
  private rimImgs: Phaser.GameObjects.Image[] = [];
  private rimUnitId: string | null = null;
  private rimColour = 0xffffff;
  // Offset from a tile's top-face centre to a unit sprite's CENTRE. The
  // flat board used -4. On the diorama the feet go on the front half of
  // the tile and the body rises over the rows behind it.
  private unitLift = -4;
  // The sun for this battle's cast shadows (render/sun), or none.
  private sun?: Sun;
  // No sun, but flames: figures near a torch throw shadows away from it.
  private torchShadows = false;
  // Unit billboard size for this board (see dioramaConfig).
  private unitW = UNIT_FLAT_W;
  private unitH = UNIT_FLAT_H;
  // Flames on the board, for the darkness overlay on night battles.
  private boardLights: { x: number; y: number; radius: number; img?: Phaser.GameObjects.Image }[] = [];
  // Standing props that fade while a unit is behind them (Diorama).
  private occluders: { img: Phaser.GameObjects.Image; footY: number; x0: number; x1: number; y0: number }[] = [];
  // Reusable brush for punching light into the darkness overlay.
  private lightBrush?: Phaser.GameObjects.Image;
  // Camera perspective on the diorama board (null = none: the flat board,
  // or a renderer without WebGL post-processing). Input picking runs
  // pointers back through the same keystone math the shader uses.
  private keystone: KeystoneParams | null = null;
  // The painted distance, rendered by its own scene underneath this one.
  private backdropScene?: BattleBackdropScene;
  private unitViews = new Map<string, UnitView>();
  // Scripted enemy waves (survive battles) + which rounds already fired.
  // The set is rebuilt on resume from the restored round counter, so it
  // needs no serialization of its own.
  private reinforcements: NonNullable<BattleNode["reinforcements"]> = [];
  // Reinforcement waves already landed, keyed by wave id (which
  // defaults to the round number for round-scheduled waves). A Set of
  // ids rather than rounds because event waves have no round.
  private spawnedWaves = new Set<string>();
  // Boss second winds already staged (log line, VFX, dialogue, reserve
  // wave). Guards the per-action scan from re-staging the same phase
  // change on every subsequent attack.
  private stagedSecondWinds = new Set<string>();
  private overlayG!: Phaser.GameObjects.Graphics;
  // Region-contour pass for the movement range — drawn separately from
  // overlayG so its "alive" alpha pulse doesn't throb the attack marks.
  private contourG!: Phaser.GameObjects.Graphics;
  // Dotted path preview from the active unit to the hovered move tile.
  private pathG!: Phaser.GameObjects.Graphics;
  // Translucent copy of the active unit shown at the hovered destination.
  private moveGhost?: Phaser.GameObjects.Sprite;
  // Cache key (`unitId:x,y`) so the path preview only recomputes when the
  // hovered tile actually changes, not on every pointer pixel.
  private lastPathKey: string | null = null;
  private threatG!: Phaser.GameObjects.Graphics;
  private cursorG!: Phaser.GameObjects.Graphics;
  private actionButtons: Button[] = [];
  // Two-camera split for the cinematic shader pass: the main camera
  // renders the world (tiles, units, overlays, floaters) with bloom +
  // vignette + color grading; the UI camera renders pinned overlays
  // (side panel, action buttons, init bar, settings/FF buttons, item
  // picker) WITHOUT any post-FX so the UI stays readable behind a
  // dark cinematic vignette. Populated in create(); pin() routes UI
  // through both cameras' ignore lists so the world and UI never
  // double-render or bleed into each other.
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  // All pinned UI objects, tracked so the main (world) camera can
  // ignore them in one sweep after create() and so any pin() call
  // post-create can update the ignore lists incrementally.
  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  // Fog-of-war spotlight overlay — a full-map dark RenderTexture
  // with soft circular holes punched at each living player unit's
  // position. Refreshed in update() so the lit area follows the
  // squad as they move. Only rendered on the main (world) camera.
  private darknessRT?: Phaser.GameObjects.RenderTexture;
  private activeUnitText!: Phaser.GameObjects.Text;
  private activeRibbon!: Phaser.GameObjects.Graphics;
  private activeRibbonText!: Phaser.GameObjects.Text;
  private inspectTag!: Phaser.GameObjects.Text;
  private apText!: Phaser.GameObjects.Text;
  private statText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private logLines: string[] = [];
  // Top initiative bar + overflow dropdown — owns its own container +
  // dropdown lifecycle. See src/scenes/battle/InitiativeBar.ts.
  private initiativeBar!: InitiativeBar;
  // Inline picker shown when the player clicks the "Item" action button.
  // One row per consumable kind in the active unit's inventory; click a
  // row to use that item. Auto-closes whenever the action buttons are
  // rebuilt or torn down so a stale picker can't outlive its unit.
  private itemPicker?: Phaser.GameObjects.Container;
  // Single source of truth for input/turn state. `mode`, `acting`, `ended`
  // and the move/attack target arrays all live here now — the scene reads
  // them via fsm.current() / fsm.currentTiles() / etc., and writes them by
  // sending events. See src/scenes/battle/BattleFSM.ts.
  private fsm = new BattleFSM();
  private hoverPreview!: Phaser.GameObjects.Container;
  private debug = false;
  private debugText!: Phaser.GameObjects.Text;
  private roundText!: Phaser.GameObjects.Text;
  private activeRing!: Phaser.GameObjects.Graphics;
  private activeArrow!: Phaser.GameObjects.Text;
  private activeRingTween?: Phaser.Tweens.Tween;
  private activeArrowTween?: Phaser.Tweens.Tween;
  private inspectedUnitId: string | null = null;
  private phaseBanner?: Phaser.GameObjects.Container;
  // Hover tooltips for weapon, ability, and inventory rows in the side panel.
  private infoTooltip!: Phaser.GameObjects.Container;
  private wpnZone!: Phaser.GameObjects.Zone;
  private ablZone!: Phaser.GameObjects.Zone;
  private invZone!: Phaser.GameObjects.Zone;
  private panelUnit?: Unit;
  // Circular headshot crop of the side-panel unit's portrait. Recreated each
  // time the panel target changes; absent when the unit has no portrait file.
  private avatarImg?: Phaser.GameObjects.Image;
  private avatarMaskG?: Phaser.GameObjects.Graphics;
  private avatarRing?: Phaser.GameObjects.Graphics;
  // 2x enemy-turn toggle. When true and the active unit is an enemy, the
  // scene's tween + timer timescale is doubled so the AI loop visibly snaps
  // forward without altering combat math.
  private fastForward = false;
  // True when this entry came from "Resume Battle" (BattleArgs.resume) —
  // create() rebuilds the board from save.suspendedBattle instead of the
  // fresh roster. Reset every init().
  private resumeRequested = false;
  // Danger overlay ("show enemy ranges") — union of every living enemy's
  // move+attack range, FE-style. Toggled by the ⚔ top-bar button or the
  // T key; drawn into dangerG by drawOverlay.
  private dangerVisible = false;
  private dangerG!: Phaser.GameObjects.Graphics;
  private dangerToggle?: IconToggleButton;
  // First-battle guided tutorial (B1 only, once per save). Constructed in
  // create() when wanted; scene hooks forward events via notify().
  private tutorial?: TutorialDirector;
  // Mid-battle dialogue trigger evaluation + firing. Owns its own
  // fired-dialogue dedup + round bookkeeping; constructed fresh per
  // battle in create(). See src/scenes/battle/DialogueDirector.ts.
  private dialogue!: DialogueDirector;
  // Undo-move: snapshots of (position, AP, roam flag, facing) captured
  // before each player move this turn. A stack, so multi-AP turns walk
  // back one move at a time. Cleared at turn dispatch and by any
  // committing action (attack, stance, item, end turn) — undo is for
  // repositioning second thoughts, never for taking back information
  // gained from an attack roll. Roam moves are not snapshotted: the
  // roam-granted AP is move-only, and restoring it would let the
  // player spend it on an attack.
  private undoStack: Array<{
    unitId: string;
    pos: TilePos;
    ap: number;
    roamUsed: boolean;
    facingX: 1 | -1;
  }> = [];
  // Battle-music gate. The battle theme starts the instant BattleScene
  // loads — even for battles that open on a round-1 dialogue (Kian's
  // blockade speech, the colony reveal, Rose's brief, etc.). The theme
  // plays underneath the opening dialogue so the BattlePrep cue never
  // bleeds across the seam onto the battle map (any pre-fight beat that
  // happens once we're already on the map hears the battle theme, not
  // the prep loop). startBattleMusic() is idempotent; this flag ensures
  // the theme starts exactly once per battle and the RESUME handler's
  // safety call is a no-op after the first start.
  private battleMusicStarted = false;
  // Ambient biome atmosphere emitter (Tier 1). Optional — "none" biomes
  // leave it undefined. Phaser destroys it on scene shutdown.
  private atmosphere?: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor() { super("BattleScene"); }

  init(data: BattleArgs): void {
    this.battleId = data.battleId;
    this.resumeRequested = data.resume === true;
    this.tutorial = undefined;
    this.pressBegunInScene = false;
    this.dragArmed = false;
    this.finalBlow = null;
    this.spinPace = 1;
    this.finalePlayed = false;
    this.cineActive = false;
    // Scene instances are reused across battles. The spotlight RT from a
    // dark battle (B4/B7/B11/B13/B15/B17/B27) is destroyed by scene shutdown, but
    // the FIELD survives — and update() touches it every frame. Left
    // stale, the first frame of the NEXT battle after a dark one crashes
    // inside RenderTexture.clear (null gl). Reset it with the rest.
    this.darknessRT = undefined;
    this.unitViews = new Map();
    this.actionButtons = [];
    this.logLines = [];
    this.fsm = new BattleFSM();
    this.debug = false;
    this.battleMusicStarted = false;
    // Scene instances are reused across battles — drop the previous
    // battle's (destroyed) ghost sprite and path cache so drawPathPreview
    // lazily recreates them in the new scene lifetime.
    this.moveGhost = undefined;
    this.lastPathKey = null;
    // The same for the hover x-ray (the silhouette of a unit seen through
    // whatever covers it, and the tile outline drawn over the actors). Left
    // pointing at the last battle's destroyed objects, the first hover over
    // a covered unit in the next battle retextured a dead image, which threw
    // inside update() and stopped the game loop: the battle froze.
    this.xrayImg = undefined;
    this.xrayUnitId = null;
    this.cursorTopG = undefined;
    // And the hover rim (the outline round the unit under the pointer):
    // four images made on first hover, kept in an array that was only ever
    // filled once — the next battle retextured the dead ones and froze.
    this.rimImgs = [];
    this.rimUnitId = null;
    // Every pinned UI object of the battle; never emptied, so each battle's
    // camera setup walked every destroyed object of every earlier one.
    this.uiObjects = [];
    // Never on the display list, so shutdown doesn't destroy it; it would
    // carry over working, but nothing of one battle should outlive it.
    this.lightBrush?.destroy();
    this.lightBrush = undefined;
  }

  create(): void {
    // Resolve the node THROUGH the chosen Seven Path — the endgame
    // climaxes (B23/B24/B28) swap rosters, win conditions, and
    // dialogues per path. Path-agnostic battles resolve to themselves.
    const rawNode = battleById(this.battleId);
    const node = rawNode ? resolveBattleForPath(rawNode, getSevenPath(loadSave())) : undefined;
    if (!node || !node.map || !node.buildPlayers || !node.buildEnemies) {
      this.scene.start("OverworldScene");
      return;
    }

    // Analytics — pair with trackBattleCompleted in checkEnd() to compute
    // win/loss rates and drop-off per battle.
    trackBattleStarted(this.battleId);

    // Backdrop — see ensureBackdropForKey in BackdropArt.ts. The BackdropKey
    // union and the spec lookup are co-located so a typo'd key fails to compile.
    // On the ¾ diorama the backdrop is a separate scene underneath this
    // one (see BattleBackdropScene for why), parallaxed at a fraction of
    // the board's scroll — one of the strongest depth cues there is. The
    // flat board keeps it in-world, as it always was, but parallaxed too:
    // at 1:1 it used to scroll clean off-screen on the big maps.
    const useBackdropScene = !new URLSearchParams(window.location.search).has("flat");
    if (useBackdropScene) {
      // Night battles darken the distance too — the fog lives in this
      // scene's world camera and never reaches the backdrop scene.
      this.scene.launch("BattleBackdropScene", { backdropKey: node.backdropKey, night: !!node.darkBattle });
      this.backdropScene = this.scene.get("BattleBackdropScene") as BattleBackdropScene;
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scene.stop("BattleBackdropScene"));
      // The battle's fade-outs must take the distance with them, or the
      // board would fade to black over a still-lit sky.
      this.cameras.main.on(Phaser.Cameras.Scene2D.Events.FADE_OUT_START,
        (_c: unknown, _e: unknown, duration: number, r: number, g: number, b: number) => {
          this.backdropScene?.cameras.main?.fadeOut(duration, r, g, b);
        });
    } else {
      const bgKey = ensureBackdropForKey(this, node.backdropKey);
      this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey)
        .setDisplaySize(GAME_WIDTH * 1.32, GAME_HEIGHT * 1.32)
        .setScrollFactor(0.14)
        .setDepth(DEPTH.BACKDROP);
    }
    // Backdrop dim gradient — keeps the playfield reading above the
    // backdrop without washing it out. Lightened from the old 0.45→0.78
    // (which stacked on the backdrop's own edge vignette and made daytime
    // battles look like dusk); now a gentle top-to-bottom 0.22→0.42 so the
    // scene stays legible and bright while the grid still pops forward.
    if (!useBackdropScene) {
      const v = this.add.graphics();
      v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.22, 0.22, 0.42, 0.42);
      v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      // Pinned to the screen (it used to scroll away with the world).
      v.setScrollFactor(0).setDepth(DEPTH.BACKDROP_DIM);
    }

    // Ambient atmosphere (Tier 1 HD-2D-lite) — biome-driven particle layer
    // (snow / embers / dust / motes). Created here, BEFORE the UI-pin
    // snapshot below, so it stays a world object: the two-camera split
    // routes it to the world camera and the UI camera ignores it. Depth 23
    // keeps it above tiles/units but below the active marker, fog, and HUD.
    this.atmosphere = createAtmosphere(this, node.atmosphere ?? atmosphereForBackdrop(node.backdropKey), 23) ?? undefined;

    const map = node.map;
    const grid = new Grid(map);
    const rng = new Rng(0xc0de ^ (map.id.length * 2654435761) ^ Date.now());

    const save = loadSave();
    // Resume path: if this entry came from "Resume Battle" and the save
    // holds a snapshot for THIS battle, rebuild the exact board from it —
    // fresh-roster hydration, difficulty bumps, and inventory assignment
    // are all already baked into the captured units and must not
    // re-apply (re-applying assignedInventory would duplicate items).
    const resumeSnap =
      this.resumeRequested && save.suspendedBattle?.battleId === this.battleId
        ? save.suspendedBattle
        : null;

    let players: Unit[];
    let enemies: Unit[];
    if (resumeSnap) {
      const restored = resumeSnap.units.map(deserializeUnit);
      players = restored.filter((u) => u.faction !== "enemy");
      enemies = restored.filter((u) => u.faction === "enemy");
    } else {
      players = node.buildPlayers().map((def, i) =>
        createUnit(def, map.startPositions.player[i] ?? { x: 0, y: 0 })
      );
      // Difficulty bump — every battle except the tutorial gets a small
      // stat bump applied to its enemy roster (+2 HP / +1 power on mooks
      // and elites; bosses unchanged). Centralized in src/combat/Difficulty.ts
      // so a future difficulty-selector UI has one place to read from.
      enemies = node.buildEnemies().map((def, i) =>
        createUnit(applyDifficultyToEnemy(def, this.battleId), map.startPositions.enemy[i] ?? { x: 0, y: 0 })
      );

      // Hydrate player units from the save slot. Characters with a saved
      // record have their level / xp / current stats / post-promotion class
      // restored from disk; first-time appearances use the factory baseline,
      // and the catch-up rule fast-forwards veterans (e.g., Selene rejoining
      // at L10 when the squad average has reached L13). See Progression.ts
      // and docs/RAVAGE_DESIGN.md §4.
      const squadAvg = squadAverageLevel(players);
      for (const p of players) {
        const rec = getCharacterRecord(save, p.id);
        if (rec) {
          const factoryAp = p.stats.ap;
          p.level = rec.level;
          p.state.xp = rec.xp;
          p.stats = { ...rec.stats };
          // Back-fill the Tier 2 AP for records promoted BEFORE the
          // +1 AP promotion boost landed: promoted class, AP still at
          // the factory baseline. One-time — the post-battle record
          // snapshot persists the corrected value.
          if (rec.classKind && rec.classKind === PROMOTIONS[p.id]?.toClass && p.stats.ap <= factoryAp) {
            p.stats.ap = factoryAp + 1;
          }
          p.state.hp = rec.stats.hp; // start the battle at full HP
          if (rec.classKind) p.classKind = rec.classKind;
          if (rec.abilities) p.abilities = rec.abilities;
          // Post-promotion sprite override survives save/load — without
          // this, a promoted unit's Tier 2 classKind (e.g., spearton_lord)
          // would route to a sprite folder that doesn't exist.
          if (rec.spriteClassOverride) p.spriteClassOverride = rec.spriteClassOverride;
        } else if (p.level < squadAvg - 2) {
          const gained = catchUpToSquad(p, squadAvg);
          if (gained > 0) {
            p.state.hp = p.stats.hp; // top up after the catch-up HP gains

            if (import.meta.env.DEV) console.info(`[Progression] ${p.name} catches up: +${gained} levels (now L${p.level})`);
          }
        }
        // Mend back-fill — Ranatoli's L10 support ability. Granted here
        // (not only in the factory) so records saved before the ability
        // existed pick it up, and so a promotion that overwrote the
        // second ability slot can't permanently cost him the heal.
        if (p.id === "ranatoli" && p.level >= 10 && !(p.abilities ?? []).includes("Mend")) {
          p.abilities = [...(p.abilities ?? []), "Mend"];
        }
        // Inventory hydration. createUnit now returns an empty bag —
        // BattlePrepScene's InventoryScene wrote each character's
        // assignment to save.assignedInventory before "March to Battle"
        // was clicked. Read it back here so the unit fights with the
        // items the player handed them. Characters with no assignment
        // (e.g., player skipped the inventory screen) deploy empty.
        const assigned = getAssignedInventory(save, p.id);
        if (assigned.length > 0) p.state.inventory = assigned;
      }

      enemies.forEach((e) => (e.state.facingX = -1));
      players.forEach((p) => (p.state.facingX = 1));
    }
    const units: Unit[] = [...players, ...enemies];
    this.state = { units, grid, rng };

    // Win/lose rule. Most battles use the default "rout all enemies"; battles
    // that override .victory in their BattleNode (defense, escort, escape,
    // boss-only kills) set a custom condition that drives both checkEnd()
    // and the goal label in the HUD.
    this.victory = node.victory ?? routEnemies;

    this.initiative = new Initiative();
    this.initiative.reseed(units);
    if (resumeSnap) this.initiative.restore(units, resumeSnap.initiative);

    // Reinforcement bookkeeping. Waves spawn as their round begins; on
    // resume, waves for rounds the battle already reached are treated as
    // spawned — their survivors (or corpses) are in the unit snapshot.
    this.reinforcements = node.reinforcements ?? [];
    this.spawnedWaves = new Set();
    this.stagedSecondWinds = new Set();
    if (resumeSnap) {
      for (const w of this.reinforcements) {
        if (w.round !== undefined && w.round <= this.initiative.round) {
          this.spawnedWaves.add(waveKey(w));
        }
        // An event wave already landed iff its boss already stood back
        // up — that fact rides UnitState through the suspend snapshot.
        if (w.onSecondWindOf) {
          const boss = units.find((u) => u.id === w.onSecondWindOf);
          if (boss?.state.secondWindUsed) this.spawnedWaves.add(waveKey(w));
        }
      }
      // Likewise: don't replay the phase-two staging for a boss that
      // was already in phase two when the player saved and quit.
      for (const u of units) {
        if (u.state.secondWindUsed) this.stagedSecondWinds.add(u.id);
      }
    }

    // Mid-battle dialogue director — fresh per battle, so its fired /
    // round bookkeeping starts clean on every entry / retry.
    this.dialogue = new DialogueDirector(
      this,
      node.dialogues ?? [],
      node.music,
      this.initiative,
      this.state
    );
    // On resume, restore the fired-dialogue set so story beats the player
    // already saw (including the round-1 opener) don't replay.
    if (resumeSnap) this.dialogue.restore(resumeSnap.dialogue);

    // ¾ diorama (default) or the original flat board (`?flat=1`).
    this.diorama = !new URLSearchParams(window.location.search).has("flat");
    this.boardMap = map;
    this.viewRotation = 0;
    this.spin = undefined;
    this.spinSettle = undefined;
    this.pendingSpin = null;
    this.spinButtonDir = 0;
    // All four layouts now: a turn blends between them frame by frame.
    this.layouts = ([0, 1, 2, 3] as ViewRotation[]).map((r) => this.computeLayout(r));
    this.gridHeights = this.layouts.map((L) => {
      const a = new Float32Array(map.width * map.height);
      for (let gy = 0; gy < map.height; gy++) {
        for (let gx = 0; gx < map.width; gx++) {
          const v = L.rotProj.view({ x: gx, y: gy });
          a[gy * map.width + gx] = L.elevAt(v.x, v.y);
        }
      }
      return a;
    });
    // Projection, board origin and camera bounds (layoutBoard). Rebuilt
    // whenever the player turns the board.
    const tight = this.layoutBoard();
    const boundsW = tight.w, boundsH = tight.h;
    this.unitW = this.diorama ? UNIT_DIORAMA_W : UNIT_FLAT_W;
    this.unitH = this.diorama ? UNIT_DIORAMA_H : UNIT_FLAT_H;
    this.unitLift = this.diorama ? DIORAMA_FOOT_DY - this.unitH / 2 : -4;

    // Camera scrolling. Bounds are MAX(viewport, map+margins) so:
    //   - Maps that fit inside the viewport: bounds == viewport, camera
    //     can't scroll (no slack), drag/keys are no-ops.
    //   - Maps bigger than viewport: bounds extend to cover the whole
    //     map plus margins, camera scrolls within that range.
    // Right-click drag pans the camera; arrow keys nudge it. UI is pinned
    // (setScrollFactor(0)) so it stays put when the world moves.
    // The side panel is an OVERLAY on top of a full-width camera, not a
    // narrower viewport — so the rightmost ~292px of the screen is
    // covered even though the camera still renders world there. A map
    // wide enough to reach under the panel therefore had columns that
    // could never be seen OR clicked, because bounds == viewport left
    // the camera no slack to scroll them clear. That is how a last
    // enemy became unfindable on the widened endgame maps.
    //
    // Adding the panel's width to the right margin gives the camera
    // exactly enough room to pull the map's east edge out from under it.
    // (See layoutBoard: those are the TIGHT bounds, used to frame the
    // opening view; the camera itself gets slack around them to drag.)
    // Disable the browser's right-click context menu so right-click drag
    // doesn't trigger a system menu mid-pan.
    this.input.mouse?.disableContextMenu();
    this.baseZoom = this.cameras.main.zoom;
    this.zoomFactor = 1;
    this.setupCameraDragPan();
    this.setupCameraKeyboardPan();
    this.setupCameraTurnAndZoom();

    // Initial camera centering. Phaser's main camera defaults to scroll
    // (0, 0) which shows the world's TOP-LEFT. For maps taller than
    // the viewport (B1 Palace Coup, B5 Mountain, B7 Monastery, B9
    // Ravine, B11 Cliffs), the player squad spawns at the BOTTOM of
    // the map and so was off-screen on battle entry — the player saw
    // an empty top-of-map view with no characters anywhere.
    //
    // Scroll the camera so the player squad's average tile position
    // sits at the center of the playfield viewport. Phaser clamps
    // automatically to the camera bounds set above, so for maps that
    // fit in the viewport this is a no-op (camera stays at 0, 0).
    if (players.length > 0) {
      const playW = GAME_WIDTH - PANEL_W - 40;
      const playH = GAME_HEIGHT - MAP_TOP_OFFSET - 40;
      let sumX = 0;
      let sumY = 0;
      for (const p of players) {
        const px = this.projection.tileToWorld(p.state.position);
        sumX += px.x;
        sumY += px.y;
      }
      const cx = sumX / players.length;
      const cy = sumY / players.length;
      // Compute the scroll offset that centers the squad in the
      // playable viewport (which excludes the right side panel and
      // the top bar). The camera's scroll is the world coordinate
      // of the top-left of the viewport — so to center cx in playW,
      // scroll by cx - playW/2 (and similarly for y, accounting for
      // the top-bar offset).
      const targetScrollX = cx - (20 + playW / 2);
      const targetScrollY = cy - (MAP_TOP_OFFSET + playH / 2);
      // Clamped to the TIGHT bounds, as the opening view always was: a map
      // that fits the playfield opens centred on the board, not on the
      // squad. (The camera's own bounds have drag slack beyond these.)
      this.cameras.main.setScroll(
        Phaser.Math.Clamp(targetScrollX, 0, Math.max(0, boundsW - GAME_WIDTH)),
        Phaser.Math.Clamp(targetScrollY, 0, Math.max(0, boundsH - GAME_HEIGHT))
      );
    }

    // Defensive RESUME handler — fires every time BattleScene comes
    // back from a paused overlay (BattleDialogueScene, InterposeScene,
    // PromotionScene, RosterScene, SettingsScene, InventoryScene).
    // Re-syncs every unit view to the live UnitState and redraws the
    // active marker.
    //
    // Without this, B7 specifically had a bug where the player's unit
    // sprites would not appear after the b07_lucian_amar_cover dialogue
    // closed. The exact cause (mask/depth/alpha state from the dialogue
    // scene leaking into BattleScene's rendering, or a Phaser quirk
    // around scene resume on a vertical-scroll camera) was hard to
    // pin down — but a wholesale refresh on RESUME is a no-op in the
    // healthy case AND a recovery in the broken case. Cheap insurance.
    //
    // Listener is `on` not `once` because the same scene resumes many
    // times across a battle (every dialogue, every modal). The
    // SHUTDOWN listener registered separately tears it down.
    const onResume = (): void => {
      // Any press armed before the pause is stale — the overlay owned it.
      this.pressBegunInScene = false;
      this.dragArmed = false;
      this.refreshAllUnits();
      const cur = this.initiative.current();
      if (cur) this.drawActiveMarker(cur);
      // Also re-render the side panel so the active-turn ribbon and
      // unit detail stay in sync with whatever the dialogue may have
      // changed (XP awards from before_victory beats, etc.).
      if (this.panelUnit) this.refreshSidePanel(this.panelUnit);
      // For battles that opened on a round-1 dialogue, THIS is where the
      // theme actually starts: the first resume is the opening dialogue
      // closing. Idempotent — every later resume is a no-op.
      this.startBattleMusic();
      // Normalize the time scale on EVERY resume. If a hit-stop or
      // Ravage dilation was mid-flight when a dialogue paused this
      // scene (death retreat beat, interpose prompt), the wall-clock
      // restore may have raced the pause — never come back from a
      // dialogue in slow motion.
      this.applyTurnSpeed();
    };
    this.events.on(Phaser.Scenes.Events.RESUME, onResume);
    // Scene events outlive the scene's shutdown (the instance is reused for
    // every battle), so without this each battle added another resume
    // handler and they all ran on every resume of every later battle.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.RESUME, onResume));

    // The suspend write is idle-deferred (see writeSuspend). Two exits
    // bypass idle: scene shutdown (DevJump warp, defeat restart) and the
    // tab closing. Flush on both so the last turn boundary is never lost.
    const flushOnLeave = () => this.flushSuspend();
    window.addEventListener("pagehide", flushOnLeave);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      window.removeEventListener("pagehide", flushOnLeave);
      this.flushSuspend();
    });

    // The board itself — tile tops, the walls height exposes, occlusion,
    // water, props standing on the ground, torch light. See
    // scenes/battle/Diorama.ts. Everything it creates is a world object
    // made during this setup sweep, so the UI camera never double-draws it.
    // A sun on the diorama in daylight; dark battles are lit by torches.
    this.sun = this.diorama && !node?.darkBattle ? SUN : undefined;
    this.torchShadows = this.diorama && !!node?.darkBattle;
    this.boardAtmo = node.atmosphere ?? atmosphereForBackdrop(node.backdropKey);
    this.buildBoardArt();

    // Tactical washes lie ON the ground: above terrain and light, below
    // every prop and unit standing on it (see render/depth.ts). The
    // relative order is unchanged from the flat board — move wash, its
    // contour, then danger, then a Ready enemy's threat zone on top.
    this.overlayG = this.add.graphics().setDepth(DEPTH.GROUND_OVERLAY);
    this.contourG = this.add.graphics().setDepth(DEPTH.GROUND_OVERLAY + 0.1);
    this.dangerG = this.add.graphics().setDepth(DEPTH.GROUND_OVERLAY + 0.2);
    this.threatG = this.add.graphics().setDepth(DEPTH.GROUND_OVERLAY + 0.3);
    // Path preview, hover cursor and the active ring are marks on the
    // ground too. On night battles they're lifted above the darkness
    // (see the darkBattle block) so they stay readable in the fog.
    this.pathG = this.add.graphics().setDepth(DEPTH.GROUND_MARK);
    this.cursorG = this.add.graphics().setDepth(DEPTH.GROUND_MARK + 0.1);
    this.activeRing = this.add.graphics().setDepth(DEPTH.GROUND_MARK + 0.2);
    // Gentle breathing on the movement contour — makes the region read as
    // a live selection instead of static tile paint. One tween for the
    // scene's lifetime; pulsing an empty Graphics between turns is free.
    this.tweens.add({
      targets: this.contourG,
      alpha: { from: 0.72, to: 1 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.activeArrow = this.add.text(0, 0, "\u25BC", {
      fontFamily: "Arial, sans-serif",
      fontSize: "20px",
      color: "#ffd45a",
      stroke: "#000",
      strokeThickness: 3
    }).setOrigin(0.5, 1).setVisible(false).setDepth(DEPTH.ACTIVE_ARROW);

    // Units
    for (const u of units) {
      this.buildUnitView(u);
    }

    // Snapshot children count before UI creation. Anything added between
    // here and the end of create() is UI by definition (the top bar,
    // side panel, action button block, hover/info tooltips, etc.) and
    // gets pinned via setScrollFactor(0) so it stays put when the camera
    // pans. Tile sprites + unit views above stay at the default
    // scrollFactor of 1 so they move with the world.
    const uiStartIdx = this.children.list.length;

    // Top initiative bar
    const topG = this.add.graphics();
    topG.fillStyle(0x000000, 0.6);
    topG.fillRect(0, 0, GAME_WIDTH, TOP_BAR_HEIGHT);
    topG.lineStyle(1, COLORS.gold, 0.5);
    topG.strokeRect(0.5, 0.5, GAME_WIDTH - 1, TOP_BAR_HEIGHT - 1);
    this.add.text(16, 8, "INITIATIVE", {
      fontFamily: FAMILY_HEADING,
      fontSize: "11px",
      color: "#c9b07a"
    });
    this.roundText = this.add.text(16, 24, "", {
      fontFamily: FAMILY_HEADING,
      fontSize: "16px",
      color: "#f4d999"
    });
    // Goal label sits under the round counter so the player always knows what
    // the battle wants from them (rout, survive, escape, kill the boss…).
    // Populated from this.victory.label, set once per battle in create().
    this.panHintText = this.add.text(16, 64, "drag · wheel zoom · Q/E turn · R reset · click a portrait", {
      fontFamily: FAMILY_BODY,
      fontSize: "11px",
      color: "#5f6472"
    });
    this.goalText = this.add.text(16, 46, `Goal: ${this.victory.label}`, {
      fontFamily: FAMILY_BODY,
      fontSize: "12px",
      color: "#c9b07a"
    });
    // Initiative bar — its container is created inside the InitiativeBar
    // constructor, pushed right of the goal text (INITIATIVE_BAR_X in the
    // module) so the goal label stays legible. Created here, during
    // create(), so the end-of-create() pin sweep catches its container.
    this.initiativeBar = new InitiativeBar(
      this,
      this.initiative,
      () => this.state.units,
      this.roundText,
      (o) => this.pin(o),
      (u) => this.focusUnit(u)
    );

    // Right panel
    const apg = this.add.graphics();
    drawPanel(apg, GAME_WIDTH - PANEL_W - 12, 80, PANEL_W, GAME_HEIGHT - 100);
    const px = GAME_WIDTH - PANEL_W;
    const panelTextW = PANEL_W - 24; // inner width with margin
    // Header layout: a large headshot is centered horizontally near the top of
    // the panel; the unit's name, inspect tag, and AP line sit centered below
    // it as a vertical stack. The avatar itself is drawn in setSidePanelAvatar.
    const panelCenterX = px + PANEL_W / 2 - 12; // panel center after the right margin
    // Active-unit ribbon: highlights the currently-acting character above the name.
    this.activeRibbon = this.add.graphics();
    this.activeRibbonText = this.add.text(px, 84, "", {
      fontFamily: FAMILY_HEADING,
      fontSize: "10px",
      color: "#0a0c12"
    });
    this.activeUnitText = this.add.text(panelCenterX, 200, "", {
      fontFamily: FAMILY_HEADING,
      fontSize: "18px",
      color: "#f4d999",
      align: "center",
      wordWrap: { width: panelTextW }
    }).setOrigin(0.5, 0);
    this.inspectTag = this.add.text(panelCenterX, 226, "", {
      fontFamily: FAMILY_BODY,
      fontSize: "11px",
      color: "#c9b07a",
      fontStyle: "italic",
      align: "center",
      wordWrap: { width: panelTextW }
    }).setOrigin(0.5, 0);
    this.apText = this.add.text(panelCenterX, 244, "", {
      fontFamily: FAMILY_BODY,
      fontSize: "14px",
      color: "#dad3bd",
      align: "center",
      wordWrap: { width: panelTextW }
    }).setOrigin(0.5, 0);
    this.statText = this.add.text(px, 272, "", {
      fontFamily: FAMILY_MONO,
      fontSize: "12px",
      color: "#9da7b8",
      lineSpacing: 5,
      wordWrap: { width: panelTextW }
    });

    // Subtle divider + ACTIONS label sit just above the action button block.
    // Stat block can now grow to 8 lines (HP / PWR-ARM / SPD-MOV / WPN / STN /
    // ABL / INV / EQ) ≈ 136px starting at y=272, ending near y=408 — bumped
    // ACTIONS down by 12px so the equipment row never overlaps the header.
    this.add.text(px, 420, "ACTIONS", {
      fontFamily: FAMILY_HEADING,
      fontSize: "11px",
      color: "#c9b07a"
    }).setLetterSpacing(2);

    // Battle log lives below the action button block.
    this.add.text(px, 572, "BATTLE LOG", {
      fontFamily: FAMILY_HEADING,
      fontSize: "11px",
      color: "#c9b07a"
    }).setLetterSpacing(2);
    this.logText = this.add.text(px, 590, "", {
      fontFamily: FAMILY_BODY,
      fontSize: "12px",
      color: "#c0c5cf",
      wordWrap: { width: panelTextW },
      lineSpacing: 3
    });

    // Hover damage preview
    this.hoverPreview = this.add.container(0, 0).setVisible(false);
    const hpBg2 = this.add.graphics();
    hpBg2.fillStyle(0x05060a, 0.94);
    hpBg2.fillRect(0, 0, 220, 100);
    hpBg2.lineStyle(1, COLORS.gold, 0.7);
    hpBg2.strokeRect(0.5, 0.5, 219, 99);
    const hpTxt = this.add.text(10, 8, "", {
      fontFamily: FAMILY_MONO,
      fontSize: "12px",
      color: "#dad3bd",
      lineSpacing: 4
    });
    this.hoverPreview.add([hpBg2, hpTxt]);
    this.hoverPreview.setData("txt", hpTxt);
    // Stored so handlePointerMove can resize the backing to the actual
    // line count — the forecast runs 6-9 lines depending on equipment +
    // Ravage states, and a fixed-height bg let the tail lines spill onto
    // the battlefield (same overlap class as the memorial popup bug).
    this.hoverPreview.setData("bg", hpBg2);

    // Side-panel info tooltip — opens to the LEFT of the panel when the player
    // hovers a weapon or ability row, explaining what the stat actually does.
    this.infoTooltip = this.add.container(0, 0).setVisible(false).setDepth(50);
    const ttBg = this.add.graphics();
    ttBg.fillStyle(0x05060a, 0.96);
    ttBg.fillRect(0, 0, 280, 116);
    ttBg.lineStyle(1, COLORS.gold, 0.8);
    ttBg.strokeRect(0.5, 0.5, 279, 115);
    const ttTitle = this.add.text(12, 8, "", {
      fontFamily: FAMILY_HEADING,
      fontSize: "14px",
      color: "#f4d999"
    }).setLetterSpacing(1);
    const ttBody = this.add.text(12, 30, "", {
      fontFamily: FAMILY_BODY,
      fontSize: "12px",
      color: "#dad3bd",
      lineSpacing: 4,
      wordWrap: { width: 256 }
    });
    this.infoTooltip.add([ttBg, ttTitle, ttBody]);
    this.infoTooltip.setData("title", ttTitle);
    this.infoTooltip.setData("body", ttBody);
    this.infoTooltip.setData("bg", ttBg);

    // Hover zones over the WPN, ABL, and INV rows of statText. Position is
    // recomputed in refreshSidePanel() each time the panel updates.
    // Pinned with setScrollFactor(0) so the hit areas stay aligned with
    // the (also-pinned) statText rows when the world camera scrolls.
    // Without pinning, the camera-scroll on tall maps offsets the hit
    // areas from the visually-rendered side panel — the player would
    // hover the WPN row and trigger the ability tooltip at a different
    // y, or vice versa.
    this.wpnZone = this.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive().setScrollFactor(0);
    this.ablZone = this.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive().setScrollFactor(0);
    this.invZone = this.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive().setScrollFactor(0);
    this.wpnZone.on("pointerover", () => this.showInfoFor("weapon"));
    this.wpnZone.on("pointerout", () => this.infoTooltip.setVisible(false));
    this.ablZone.on("pointerover", () => this.showInfoFor("ability"));
    this.ablZone.on("pointerout", () => this.infoTooltip.setVisible(false));
    this.invZone.on("pointerover", () => this.showInfoFor("inventory"));
    this.invZone.on("pointerout", () => this.infoTooltip.setVisible(false));
    // Hidden until a unit is selected.
    this.wpnZone.disableInteractive();
    this.ablZone.disableInteractive();
    this.invZone.disableInteractive();

    // Debug overlay
    this.debugText = this.add.text(20, GAME_HEIGHT - 22, "", {
      fontFamily: FAMILY_MONO,
      fontSize: "11px",
      color: "#9aa5b8"
    });
    this.input.keyboard?.on("keydown-TAB", () => {
      this.debug = !this.debug;
      this.refreshDebug();
    });
    this.input.keyboard?.on("keydown-ESC", () => {
      if (!this.fsm.isTargeting()) return;
      const cur = this.initiative.current();
      if (cur && cur.faction === "player") this.cancelTargetingMode(cur);
      else this.clearOverlays();
    });

    // Game actions resolve on pointer-UP, not down, so a left-drag that pans
    // the camera doesn't also misfire a move/attack/selection at the press
    // origin. handlePointerUp checks pressWasDrag (set by the camera-pan
    // handler) and bails if the press became a pan.
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.handlePointerUp(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.handlePointerMove(p));

    // Battle music timing. Two rules, both about the seams:
    //   1. The BattlePrep cue must NEVER carry onto the battle map — so
    //      when a battle opens on a round-1 dialogue we STOP the music
    //      outright (fade to silence) rather than playing the theme
    //      under the dialogue. The opening beats land in quiet.
    //   2. The battle theme starts when the fight actually starts: the
    //      first RESUME (the opening dialogue closing) calls
    //      startBattleMusic. Battles with no opening dialogue, and
    //      suspend-resumes (dialogue long since seen), start it here.
    const opensOnDialogue = (node.dialogues ?? []).some(
      (d) => d.trigger.kind === "round_start" && d.trigger.round <= 1
    );
    if (opensOnDialogue && !this.resumeRequested) {
      getMusic(this).stop(600);
    } else {
      this.startBattleMusic();
    }
    this.cameras.main.fadeIn(450, 0, 0, 0);

    // Settings opener — sits on the top bar so it doesn't overlap the side panel.
    new SettingsButton(this, GAME_WIDTH - 32, 35);
    // 2× enemy-turn toggle — sits to the left of the gear. The button stores
    // its own enabled state and reports back via callback; we apply timescale
    // immediately if an enemy is currently acting.
    new FastForwardButton(this, GAME_WIDTH - 76, 35, (enabled) => {
      this.fastForward = enabled;
      this.applyTurnSpeed();
    });
    // Turn the board — ↺ / ↻ left of the danger toggle, or Q / E.
    // Press to turn a quarter; hold to keep the board turning.
    new IconButton(this, GAME_WIDTH - 208, 35, "\u21BA", () => undefined, {
      start: () => this.spinPress(-1),
      end: () => { if (this.spinButtonDir === -1) this.spinButtonDir = 0; }
    });
    new IconButton(this, GAME_WIDTH - 164, 35, "\u21BB", () => undefined, {
      start: () => this.spinPress(1),
      end: () => { if (this.spinButtonDir === 1) this.spinButtonDir = 0; }
    });
    // Danger-range toggle — ⚔ button left of fast-forward, or press T.
    this.dangerVisible = false;
    this.dangerToggle = new IconToggleButton(this, GAME_WIDTH - 120, 35, "⚔", (enabled) => {
      this.dangerVisible = enabled;
      this.drawOverlay();
    });
    this.input.keyboard?.on("keydown-T", () => {
      this.dangerToggle?.setEnabled(!this.dangerToggle.isEnabled());
    });

    // Battle title card — a one-time cinematic slate ("TWENTIETH BATTLE /
    // Dawn's War") that fades up over the field as the camera fade-in
    // completes, holds, and dissolves. Skipped on resume: the returning
    // player knows where they are. Created pre-sweep so the bulk pin
    // routes it to the UI camera automatically.
    if (!this.resumeRequested) this.showBattleTitleCard(node.title, node.subtitle);

    // First-battle guided tutorial — pop-ups + arrows through the first
    // fight's controls. B1 only, once per save, never on resume.
    if (TutorialDirector.wanted(this.battleId, this.resumeRequested)) {
      this.tutorial = new TutorialDirector(this, (o) => this.pin(o));
      this.tutorial.notify("battleStart");
    }

    this.pushLog(`${node.subtitle} begins.`);
    this.initiativeBar.refresh();

    // Pin every UI element created since the units snapshot above so they
    // don't move with the camera when the player pans. World objects
    // (tiles, units, overlays, active marker) created BEFORE the snapshot
    // stay at default scrollFactor=1 and move with the world. Runtime UI
    // (action buttons, phase banner, side panel avatar, dropdown) is
    // pinned individually at its creation site via this.pin(...).
    for (let i = uiStartIdx; i < this.children.list.length; i++) {
      const child = this.children.list[i];
      if (child) this.pin(child);
    }
    // The hover damage preview is screen UI: it is placed beside the
    // hovered enemy's SCREEN position each time it is shown (see
    // placeHoverPreview), on top of everything and never tilted or zoomed.
    this.hoverPreview.setDepth(40);

    // ---- Two-camera split + fog-of-war spotlight ----
    //
    // MUST run AFTER the bulk pin loop above, because that's what
    // populates this.uiObjects with the full set of pinned UI elements.
    // Running it earlier (an earlier revision did) meant uiObjects was
    // empty at sweep time → main camera rendered + darkened the UI →
    // then the late pins added the UI to BOTH cameras' ignore lists →
    // most of the side panel became invisible. The fix is purely
    // ordering: pin first, THEN configure cameras.
    //
    // Main camera = world (tiles, units, overlays, damage floaters).
    //   Gets the cinematic post-FX (bloom + warm color grading).
    //   Vignette intentionally OFF — we use a real fog-of-war
    //   spotlight overlay below instead of a fake screen-space dim.
    //
    // UI camera = pinned overlays (side panel, action buttons, init
    //   bar, settings/FF buttons, item picker, tooltips). NO post-FX
    //   so the side bar text + portraits stay sharp + readable.
    //   Added on top of the main camera so UI composites above the
    //   FX'd world AND above the darkness layer.
    // NO post-FX vignette here — this was tried (0.3) and reverted. The
    // battle already darkens its surroundings twice: the backdrop art
    // carries its own baked-in edge vignette, and the dim gradient below
    // adds 0.22→0.42 on top. A third layer pushed the board's frame to
    // near-black, and on bright maps (B5's snowfield) the fight read as
    // "surrounded by darkness". Dropping it also saves a full-screen
    // shader pass per frame at the native-res buffer size.
    applyCinematicFX(this);
    const pipe = this.diorama
      ? attachPostPipeline(this.cameras.main, this.game, PERSPECTIVE_PIPELINE, PerspectivePipeline)
      : undefined;
    if (pipe) {
      const params: KeystoneParams = {
        k: DIORAMA_PERSPECTIVE_K,
        // Optical axis on the playfield, not the screen: the side panel
        // covers the right of the frame, so the board's visual centre is
        // left of the screen's.
        centerX: ((GAME_WIDTH - PANEL_W - 12) / 2) / GAME_WIDTH
      };
      pipe.k = params.k;
      pipe.centerX = params.centerX;
      this.keystone = params;
    }
    this.uiCamera = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    // Bulk-ignore all pinned UI on the world camera (post-FX cam).
    this.cameras.main.ignore(this.uiObjects);
    for (const o of this.uiObjects) this.ignoreDeepOnWorldCamera(o);
    // UI camera ignores everything in the scene that ISN'T UI.
    const allChildren = this.children.getChildren();
    const uiSet = new Set<Phaser.GameObjects.GameObject>(this.uiObjects);
    const expandUiSet = (o: Phaser.GameObjects.GameObject): void => {
      uiSet.add(o);
      if (o instanceof Phaser.GameObjects.Container) {
        for (const c of o.list) expandUiSet(c);
      }
    };
    for (const o of this.uiObjects) expandUiSet(o);
    const worldObjects = allChildren.filter((o) => !uiSet.has(o));
    if (worldObjects.length > 0) this.uiCamera.ignore(worldObjects);


    // Fog-of-war spotlight overlay — opt-in per battle via
    // node.darkBattle. Curated to SEVEN nocturnal/interior battles:
    // B4 swamp murk, B7 monastery corridors, B11 cliffs at night,
    // B13 night plaza strike, B15 back-gate coup by candle-light,
    // B17 the quay before dawn, B27 orbital descent. Daylight outdoor
    // battles render normally.
    if (node.darkBattle) {
      this.setupSpotlightOverlay();
      // The fog covers the ground; the marks the player reads at a glance
      // must not go under it with the terrain.
      this.pathG.setDepth(DEPTH.OVER_DARK);
      this.cursorG.setDepth(DEPTH.OVER_DARK + 0.1);
      this.activeRing.setDepth(DEPTH.OVER_DARK + 0.2);
      this.activeArrow.setDepth(DEPTH.OVER_DARK + 0.3);
    }

    this.beginCurrentTurn();
  }

  // ---- Helpers ----
  // Convert a SCREEN-coord pointer position to a TilePos. Adds the camera's
  // scroll offset so the math gives the correct tile when the camera has
  // panned — without this, a player who scrolls the map and then clicks
  // would target a tile based on the un-scrolled origin.
  private screenToTile(px: number, py: number): TilePos | null {
    // Two stages, cleanly separated:
    //   1. SCREEN→WORLD is the camera's job. getWorldPoint inverts the full
    //      camera transform (origin + zoom + scroll), so this is correct
    //      whether or not native-res zoom is on. At RENDER_SCALE === 1 it
    //      reduces to the old `px + scrollX` math.
    //   2. WORLD→TILE is the projection's job (bounds-checked there).
    // Composing them here keeps Projection free of any Phaser dependency.
    //   0. (Diorama) the world camera's image is tilted by the keystone
    //      pass, so first find which pixel of the UN-tilted image is under
    //      the pointer — the exact inverse of the shader.
    const cam = this.cameras.main;
    let sx = px, sy = py;
    if (this.keystone) {
      const src = screenToSource(px, py, cam.width, cam.height, this.keystone);
      if (!src) return null; // pointer is over sky the tilt uncovered
      sx = src.x;
      sy = src.y;
    }
    const wp = cam.getWorldPoint(sx, sy);
    const ground = this.projection.worldToTile(wp.x, wp.y);
    // A standing figure rises over the rows BEHIND its tile, so on the
    // diorama the ground under the pointer is often not what the player
    // means. render/pick.ts decides, from what is actually drawn there:
    // attack targets first while moving or attacking, then whichever body
    // is nearest the pointer, and an empty move tile over a body drawn
    // across it so walking behind a soldier stays possible.
    const hits: PickCandidate[] = [];
    for (const v of this.unitViews.values()) {
      if (!isAlive(v.unit) || !v.sprite.visible || v.sprite.alpha < 0.05) continue;
      if (!figureAt(v.sprite, wp.x, wp.y, true)) continue;
      hits.push(this.pickCandidate(v, wp.x, wp.y));
    }
    let groundOccupant: PickCandidate | null = null;
    if (ground) {
      const occ = unitAt(this.state, ground);
      const v = occ ? this.unitViews.get(occ.id) : undefined;
      if (v && isAlive(v.unit) && v.sprite.visible) groundOccupant = this.pickCandidate(v, wp.x, wp.y);
    }
    const st = this.fsm.current();
    return pickTile({
      ground,
      hits,
      groundOccupant,
      actionable: this.actionableTargets(),
      isEmptyDestination: (t) => (st.tag === "move" || st.tag === "roam")
        && !unitAt(this.state, t)
        && st.tiles.some((d) => d.x === t.x && d.y === t.y)
    });
  }

  private pickCandidate(v: UnitView, wx: number, wy: number): PickCandidate {
    const c = bodyCentre(v.sprite);
    return { id: v.unit.id, tile: { ...v.unit.state.position }, d: Math.hypot(wx - c.x, wy - c.y) };
  }

  /** Units a click would act on right now: the active unit's attack targets. */
  private actionableTargets(): Set<string> {
    const st = this.fsm.current();
    const u = this.initiative.current();
    if (!u || u.faction !== "player") return new Set();
    if (st.tag === "attack") return new Set(st.targets.map((x) => x.id));
    if (st.tag === "move") return new Set(targetsForUnit(this.state, u).map((x) => x.id));
    return new Set();
  }

  // Land any reinforcement wave scheduled for the current round. Called
  // from endCurrentTurn the moment the round counter wraps. New units go
  // through the same difficulty/creation/view path as the opening
  // roster, then the initiative reseeds — safe here because the wrap
  // just cleared everyone's acted flags and reset the cursor, so the
  // enlarged order simply restarts the fresh round.
  private spawnReinforcements(): void {
    const round = this.initiative.round;
    this.landWaves((w) => w.round === round);
  }

  // Boss phase two. Scanned after every resolved attack rather than
  // hooked into one damage path, so however the killing blow arrived —
  // melee, counter, lens beam, Destruct — the moment stages exactly
  // once. By the time we get here damageUnit has already refused the
  // death, restored the HP and multiplied the armor; everything below
  // is presentation plus the consequences the rest of the fight hangs
  // off.
  private stageSecondWinds(): void {
    for (const u of this.state.units) {
      if (!u.state.secondWindUsed || this.stagedSecondWinds.has(u.id)) continue;
      this.stagedSecondWinds.add(u.id);
      if (u.secondWind) this.pushLog(u.secondWind.announce);
      sfxRavage();
      this.cameras.main.shake(320, 0.016);
      const view = this.unitViews.get(u.id);
      if (view) {
        // Two shockwaves off the boss, the second a beat behind, so it
        // reads as something coming online rather than as another hit.
        for (const delay of [0, 150]) {
          const ring = this.addWorld(
            this.add.circle(view.sprite.x, view.sprite.y, 18)
              .setStrokeStyle(3, 0xff6a3c, 0.9)
              .setDepth(46)
          );
          this.tweens.add({
            targets: ring, scale: 3.6, alpha: 0, delay, duration: 640, ease: "Sine.easeOut",
            onComplete: () => ring.destroy()
          });
        }
      }
      // HP bar and the side panel are both stale — damageUnit rewrote
      // the HP and the armor stat underneath them.
      this.refreshAllUnits();
      // Reserve lands BEFORE the dialogue opens, so when the player
      // closes the overlay the new board is already in front of them.
      this.landWaves((w) => w.onSecondWindOf === u.id);
      this.dialogue.checkSecondWind(u.id);
    }
  }

  // Land every wave matching `pick` that hasn't landed yet. Shared by the
  // round-scheduled path and the second-wind event path so arrivals look
  // identical however they were summoned.
  private landWaves(pick: (w: BattleWave) => boolean): void {
    let landed = false;
    const arrivals: UnitView[] = [];
    for (const wave of this.reinforcements) {
      if (!pick(wave) || this.spawnedWaves.has(waveKey(wave))) continue;
      this.spawnedWaves.add(waveKey(wave));
      landed = true;
      wave.units().forEach((def, i) => {
        const want = wave.at[i] ?? wave.at[wave.at.length - 1] ?? { x: 0, y: 0 };
        const unit = createUnit(applyDifficultyToEnemy(def, this.battleId), this.findSpawnTile(want));
        this.state.units.push(unit);
        this.buildUnitView(unit);
        const view = this.unitViews.get(unit.id);
        if (view) arrivals.push(view);
      });
      if (wave.announce) this.pushLog(wave.announce);
    }
    if (landed) {
      this.initiative.reseed(this.state.units);
      this.refreshAllUnits();
    }
    // After the refresh, which snaps every sprite to its tile at full
    // alpha — started before it, an arrival showed on its tile for a
    // frame before stepping in from the edge.
    arrivals.forEach((v, i) => this.playArrival(v, i * 140));
  }

  // Reinforcements arrive: they come in over the nearest edge of the
  // board — two strides from half a tile out, fading up as they come —
  // and plant with a puff of dust. Staggered per unit so a wave reads as
  // a column arriving, not a block appearing.
  private playArrival(view: UnitView, delay: number): void {
    const u = view.unit;
    const p = u.state.position;
    const g = this.state.grid;
    // Nearest edge: which way is "outside" from here.
    const edges = [
      { d: p.x, dx: -1, dy: 0 },
      { d: g.width - 1 - p.x, dx: 1, dy: 0 },
      { d: p.y, dx: 0, dy: -1 },
      { d: g.height - 1 - p.y, dx: 0, dy: 1 }
    ].sort((a, b) => a.d - b.d);
    const e = edges[0]!;
    const here = this.projection.tileToWorld(p);
    const from = this.projection.tileToWorld({ x: p.x + e.dx, y: p.y + e.dy });
    const ox = (from.x - here.x) * 0.6, oy = (from.y - here.y) * 0.6;
    this.stopBreathing(view);
    const s = view.sprite, sh = view.shadow;
    const bx = s.x, by = s.y, shx = sh.x, shy = sh.y;
    // Face the way they walk on screen (the board may be turned).
    if (Math.abs(ox) > 1) s.setFlipX(ox > 0);
    s.setAlpha(0);
    sh.setAlpha(0);
    const place = (f: number) => {
      // f: 0 = half a tile out, 1 = on the tile. Two strides.
      const k = 1 - f;
      const hop = Math.abs(Math.sin(f * Math.PI * 2)) * 3;
      s.setPosition(bx + ox * k, by + oy * k - hop);
      sh.setPosition(shx + ox * k, shy + oy * k);
      // The HUD rides the sprite (update()), so it has to fade with it —
      // otherwise an HP bar hangs in the air off the edge of the board.
      const a = Math.min(1, f * 1.8);
      for (const o of [s, sh, view.hpBg, view.hpBar, view.stanceIcon]) o.setAlpha(a);
    };
    place(0);
    // One counter spanning the stagger AND the walk, so the unit is held
    // off-tile and invisible while it waits its turn (a tween `delay`
    // leaves it wherever the last refresh put it: on the tile, visible).
    const WALK = 520;
    view.animLock = "arriving";
    // Land: on the tile, at full alpha, then hand back to the refresh
    // (facing, spent tint) — early if something else needs the unit.
    const land = () => {
      tween.stop();
      view.animLock = undefined;
      view.finishArrival = undefined;
      place(1);
      this.refreshUnitView(u);
    };
    const tween = this.tweens.addCounter({
      from: 0,
      to: delay + WALK,
      duration: delay + WALK,
      onUpdate: (tw) => {
        const ms = tw.getValue() ?? 0;
        place(Phaser.Math.Easing.Sine.Out(Math.max(0, (ms - delay) / WALK)));
      },
      onComplete: () => {
        land();
        this.spawnDust(bx, shy);
        this.startBreathing(view);
      }
    });
    view.finishArrival = land;
  }

  // Nearest free walkable tile to the wave's requested entry point —
  // BFS outward so an occupied surf tile shifts the arrival one tile
  // along the beach instead of stacking units.
  private findSpawnTile(want: { x: number; y: number }): { x: number; y: number } {
    const free = (p: { x: number; y: number }): boolean =>
      this.state.grid.inBounds(p) && !this.state.grid.tileAt(p).blocksMovement && !unitAt(this.state, p);
    if (free(want)) return want;
    const seen = new Set<string>([`${want.x},${want.y}`]);
    const queue = [want];
    while (queue.length) {
      const cur = queue.shift()!;
      for (const n of this.state.grid.neighbors4(cur)) {
        const key = `${n.x},${n.y}`;
        if (seen.has(key) || !this.state.grid.inBounds(n)) continue;
        seen.add(key);
        if (free(n)) return n;
        queue.push(n);
      }
    }
    return want;
  }

  // Board visuals for one unit: sprite, shadow, HP bars, stance icon.
  // Used by create()'s setup loop AND by mid-battle reinforcement
  // spawns, so both paths produce identical views.
  private buildUnitView(u: Unit): void {
    const tex = ensureUnitTexture(this, u);
    const px = this.projection.tileToWorld(u.state.position);
    const baseY = px.y + this.unitLift;
    // Cast-shadow first so the sprite is drawn on top of it. addWorld()
    // no-ops during create() (uiCamera doesn't exist yet; the bulk
    // ignore pass covers setup objects) and keeps mid-battle
    // reinforcement spawns off the UI camera so they don't ghost-render.
    const shadow = this.addWorld(this.add.ellipse(
      px.x, baseY + 24, this.diorama ? 30 : 33, this.diorama ? 8 : 10, 0x000000, 0.42
    ).setDepth(DEPTH.SHADOW));
    const sprite = this.addWorld(this.add.sprite(px.x, baseY, tex).setDisplaySize(this.unitW, this.unitH)
      .setDepth(actorDepth(baseY + this.unitH / 2)));
    if (u.faction === "enemy") sprite.setFlipX(true);
    const castShadow = this.sun || (this.torchShadows && this.boardLights.length > 0)
      ? this.addWorld(this.add.image(px.x, baseY + 24, tex)
        .setOrigin(0.5, UNIT_FOOT_ORIGIN)
        .setTintFill(0x000000)
        .setDepth(DEPTH.SHADOW - 0.05))
      : undefined;
    // HP bars and stance glyphs sit above every actor so a soldier in the
    // row in front never hides the bar of the one behind him.
    const hpBg = this.addWorld(this.add.graphics().setDepth(DEPTH.UNIT_HUD));
    const hpBar = this.addWorld(this.add.graphics().setDepth(DEPTH.UNIT_HUD + 0.01));
    const stanceIcon = this.addWorld(this.add.text(px.x, px.y - TILE_SIZE / 2 + 2, "", {
      fontFamily: FAMILY_HEADING,
      fontSize: "12px",
      color: "#ffd45a",
      stroke: "#000",
      strokeThickness: 2
    }).setOrigin(0.5, 0).setDepth(DEPTH.UNIT_HUD + 0.02));
    const view: UnitView = { unit: u, sprite, shadow, baseY, hpBg, hpBar, stanceIcon, castShadow };
    this.unitViews.set(u.id, view);
    this.refreshUnitView(u);
    playUnitState(this, sprite, u, "idle");
    this.startBreathing(view);
    // Units already dead at creation (resumed battle with casualties)
    // never played a death animation — hide sprite AND shadow outright.
    if (!isAlive(u)) {
      sprite.setVisible(false);
      shadow.setVisible(false);
      castShadow?.setVisible(false);
    }
  }

  private refreshUnitView(u: Unit): void {
    const v = this.unitViews.get(u.id);
    if (!v) return;
    // Mid-fall: the death animation owns the sprite until it has faded.
    if (v.animLock === "dying" && !isAlive(u)) {
      v.hpBg.clear();
      v.hpBar.clear();
      v.stanceIcon.setText("");
      this.clearRavageAura(v);
      return;
    }
    const px = this.projection.tileToWorld(u.state.position);
    // Keep the breathing anchor AND the shadow in lock-step with the
    // sprite snap. This function used to reposition only the sprite —
    // any state-only reposition then left baseY stale (the next
    // breathing reset floated the unit at the old tile's height) and
    // the shadow marooned on the old tile.
    v.baseY = px.y + this.unitLift;
    // Mid-arrival the walk-in owns where the sprite is, which way it faces
    // and how visible it is; the bars and glyphs below still refresh.
    const arriving = v.animLock === "arriving";
    if (!arriving) {
      v.sprite.setPosition(px.x, v.baseY);
      v.sprite.setVisible(isAlive(u));
      v.sprite.setFlipX(this.screenFlipX(u));
    }
    v.hpBg.clear();
    v.hpBar.clear();
    if (!isAlive(u)) {
      v.stanceIcon.setText("");
      this.clearRavageAura(v);
      return;
    }
    if (!arriving) v.shadow.setPosition(px.x, v.baseY + 24);
    // Spent state — dim + desaturate units that have already taken their
    // turn this round (player or enemy). Without this the player can't
    // tell at a glance whose turn it is — they see a spent character
    // sitting on the map looking identical to fresh ones, click an action
    // button thinking they're acting on that character, and the action
    // applies to whoever the initiative queue has actually advanced to.
    // The "Active" gold ring drawn by drawActiveMarker covers the
    // positive case (who IS acting); this covers the negative case
    // (everyone else who's done this round). Cleared the moment the
    // round wraps because Initiative.advance resets hasActedThisRound on
    // every unit when it bumps the round counter.
    if (!arriving) this.applySpentTint(v.sprite, u);
    // HP bar with damage-lag ghost. On a hit the pale segment holds at
    // the pre-hit ratio for a beat and then drains — the cost of the hit
    // stays readable for half a second instead of vanishing in a frame.
    const ratio = Math.max(0, u.state.hp / u.stats.hp);
    if (v.hpShown === undefined || ratio >= v.hpShown) {
      // First draw, or healing: no ghost, snap to live.
      v.hpGhostTween?.stop();
      v.hpGhostTween = undefined;
      v.hpShown = ratio;
    } else {
      // Took damage. Restart the drain from wherever the ghost currently
      // is, so rapid successive hits stack into one continuous drain.
      v.hpGhostTween?.stop();
      const from = v.hpShown;
      v.hpGhostTween = this.tweens.addCounter({
        from,
        to: ratio,
        delay: 260,
        duration: 460,
        ease: "Cubic.easeOut",
        onUpdate: (tw) => {
          v.hpShown = tw.getValue() ?? ratio;
          this.drawHpBar(v, v.unit);
        },
        onComplete: () => {
          v.hpGhostTween = undefined;
          v.hpShown = Math.max(0, v.unit.state.hp / v.unit.stats.hp);
          this.drawHpBar(v, v.unit);
        }
      });
    }
    this.drawHpBar(v, u);
    v.stanceIcon.setPosition(px.x, v.baseY + 6);
    // Predicates, not equality — the combined "both" stance (Ready +
    // Defend in the same turn) must show BOTH glyphs, not fall through
    // to blank.
    const ready = hasReadyStance(u);
    const defensive = hasDefensiveStance(u);
    v.stanceIcon.setText(ready && defensive ? "▲◆" : ready ? "▲" : defensive ? "◆" : "");
    v.stanceIcon.setColor(ready ? "#ffd45a" : "#8ad6ff");
    // Ravage aura visibility tracks the live UnitState. Cheap reconciliation
    // — refreshUnitView already runs after every action so the glow appears
    // / disappears in step with turn boundaries without an explicit hook.
    this.refreshRavageAura(v, u);
  }

  // Draw a unit's HP bar: dark backing, pale damage-ghost segment (the
  // ratio still displayed from before the last hit), live fill on top.
  // Called from refreshUnitView and from the ghost tween's onUpdate, so
  // it must be safe against the unit dying mid-drain.
  private drawHpBar(v: UnitView, u: Unit): void {
    v.hpBg.clear();
    v.hpBar.clear();
    if (!isAlive(u)) return;
    const barW = 36;
    const barH = 4;
    const bx = -barW / 2;
    const by = 0;
    v.hpBg.setPosition(v.sprite.x, v.baseY + HP_BAR_DY);
    v.hpBar.setPosition(v.sprite.x, v.baseY + HP_BAR_DY);
    v.hpBg.fillStyle(0x000000, 0.7);
    v.hpBg.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
    const ratio = Math.max(0, u.state.hp / u.stats.hp);
    const shown = Math.max(ratio, v.hpShown ?? ratio);
    v.hpBar.fillStyle(0x2a2a36, 1);
    v.hpBar.fillRect(bx, by, barW, barH);
    if (shown > ratio) {
      v.hpBar.fillStyle(0xf2e6cf, 0.9);
      v.hpBar.fillRect(bx, by, Math.max(0, Math.floor(barW * shown)), barH);
    }
    const color = u.faction === "player" ? 0x6db2ff : 0xd05a4a;
    v.hpBar.fillStyle(color, 1);
    v.hpBar.fillRect(bx, by, Math.max(0, Math.floor(barW * ratio)), barH);
  }

  // Ravage State VFX moved out to src/scenes/battle/RavageVfx.ts as the
  // proof-of-concept BattleScene split (see audit). Thin wrappers below
  // keep the original method signatures so the rest of BattleScene
  // doesn't have to know the implementation moved.
  private refreshRavageAura(v: UnitView, u: Unit): void {
    refreshRavageAura(this, v, u, this.projection, {
      adopt: (o) => this.addWorld(o),
      squash: this.groundSquash()
    });
  }
  private clearRavageAura(v: UnitView): void {
    clearRavageAura(v);
  }
  // THE RAVAGE MOMENT — the title mechanic's signature. For about a
  // second of wall time: the world slows to a third, drains of colour,
  // a red shockwave rings off the unit, and the screen pulses red while
  // the heartbeat riser (sfxRavage, inside announceRavaged) pounds.
  // Then everything snaps back saturated and at speed. Non-blocking —
  // the turn continues underneath, slowed.
  private announceRavaged(unit: Unit): void {
    const view = this.unitViews.get(unit.id);
    if (!view) return;

    // 1. Time dilation — restores through applyTurnSpeed so the
    //    fast-forward 2x comes back correctly.
    timeDilate(this, 0.3, 950, () => this.applyTurnSpeed());

    // 2. World desaturation: a temporary colour-matrix on the world
    //    camera only (UI stays lit). Removed on the wall clock since
    //    the scene clocks are dilated. WebGL-only — under the Canvas
    //    fallback renderer the moment keeps its slow-mo + ring + flash
    //    and just skips the desaturation.
    if (this.game.renderer.type === Phaser.WEBGL) {
      const fx = this.cameras.main.postFX.addColorMatrix();
      fx.saturate(-0.85);
      setTimeout(() => {
        // Phaser's typings return Display.ColorMatrix from addColorMatrix
        // while remove() wants FX.Controller — the runtime object is both.
        try { this.cameras.main.postFX.remove(fx as unknown as Phaser.FX.Controller); } catch { /* scene gone */ }
      }, 1050);
    }

    // 3. Red shockwave ring off the unit (world space; the dilated
    //    clock stretches it in sync with the slow-mo).
    const ring = this.addWorld(this.add.circle(view.sprite.x, view.sprite.y, 12));
    ring.setStrokeStyle(3, 0xff3b30, 0.95).setDepth(39);
    this.tweens.add({
      targets: ring,
      scale: 6,
      alpha: 0,
      duration: 420,
      ease: "Cubic.easeOut",
      onComplete: () => ring.destroy()
    });

    // 4. Red screen pulse — full-frame, pinned to the UI camera.
    const flash = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0xc22418, 0.2)
      .setOrigin(0, 0)
      .setDepth(1150);
    this.pin(flash);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 260,
      ease: "Sine.easeOut",
      onComplete: () => flash.destroy()
    });

    // 5. The floater, camera shake, riser, and log line.
    announceRavaged(this, view.sprite, unit, (msg) => this.pushLog(msg), (o) => this.addWorld(o));
  }

  // ---- Fog-of-war spotlight ----
  //
  // A semi-opaque dark RenderTexture covering the whole map. Each
  // frame we clear + refill it dark, then `erase()` a soft circular
  // brush at each living player unit's position to punch holes of
  // visibility. The result reads as "only the squad and what's near
  // them is lit." The lit area moves naturally with the squad — no
  // tweens needed, the per-frame refresh tracks them.
  //
  // Depth chosen between unit sprites (default 0) and floaters /
  // tooltips (40+) so damage numbers + the active marker still pop
  // ABOVE the darkness, but the world below is shaded.
  //
  // Performance: one RT fill + N erase calls per frame, where N is
  // alive player units (max ~5-6 in the slice). Phaser batches these
  // GPU-side; negligible cost on any machine that can run the game.
  private static readonly SPOTLIGHT_BRUSH_KEY = "fog_light_brush";
  private static readonly SPOTLIGHT_BRUSH_SIZE = 256;     // px square
  private static readonly SPOTLIGHT_BRUSH_INNER = 40;     // full-bright radius
  private static readonly SPOTLIGHT_BRUSH_OUTER = 120;    // fully-dark radius
  private static readonly SPOTLIGHT_DARK_ALPHA = 0.82;    // overlay opacity

  private ensureLightBrushTexture(): void {
    const key = BattleScene.SPOTLIGHT_BRUSH_KEY;
    if (this.textures.exists(key)) return;
    const size = BattleScene.SPOTLIGHT_BRUSH_SIZE;
    const tex = this.textures.createCanvas(key, size, size);
    if (!tex) return;
    const ctx = tex.getContext();
    const cx = size / 2;
    const cy = size / 2;
    const inner = BattleScene.SPOTLIGHT_BRUSH_INNER;
    const outer = BattleScene.SPOTLIGHT_BRUSH_OUTER;
    const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
    // White → transparent. When erased onto the dark RT, the alpha
    // of THIS brush controls how much darkness is removed.
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.clearRect(0, 0, size, size);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    tex.refresh();
  }

  private setupSpotlightOverlay(): void {
    this.ensureLightBrushTexture();
    // Covers the camera's whole scroll range at EVERY rotation (a turn
    // passes through all of them), which since drag slack can start left
    // of / above world zero.
    const cb = this.allLayoutsBounds();
    const rt = this.add.renderTexture(cb.x, cb.y, cb.w, cb.h)
      .setOrigin(0, 0)
      .setDepth(DEPTH.DARKNESS) // above terrain + actors, below floaters + tooltips
      // MULTIPLY, not NORMAL. The RT blends as straight alpha, and a
      // straight-alpha draw over an opaque pixel LOWERS that pixel's alpha
      // (0.82² + 0.18 ≈ 0.85). Invisible while nothing sat under the world
      // camera; with the backdrop in its own scene underneath, every night
      // battle's board turned see-through. MULTIPLY with black darkens the
      // colour by exactly (1 − alpha) and leaves the destination alpha
      // untouched.
      .setBlendMode(Phaser.BlendModes.MULTIPLY);
    // World-space (not screen-pinned) so it scrolls with the camera.
    rt.setScrollFactor(1);
    this.darknessRT = rt;
    // UI camera ignores the darkness so the side bar stays bright.
    if (this.uiCamera) this.uiCamera.ignore(rt);
    // Initial paint so the spotlight is visible immediately on entry,
    // before update() runs its first frame.
    this.refreshSpotlight();
  }

  private refreshSpotlight(): void {
    if (!this.darknessRT) return;
    this.darknessRT.clear();
    this.darknessRT.fill(0x000511, BattleScene.SPOTLIGHT_DARK_ALPHA);
    if (!this.lightBrush) {
      this.lightBrush = this.make.image({ key: BattleScene.SPOTLIGHT_BRUSH_KEY, add: false });
    }
    const brush = this.lightBrush;
    // Light lands on foreshortened ground, so the pool is an ellipse on
    // the diorama and a circle on the flat board.
    const squash = this.groundSquash();
    for (const u of this.state.units) {
      if (u.faction !== "player") continue;
      if (!isAlive(u)) continue;
      // From the SPRITE, so the light walks with the unit instead of
      // jumping to the destination tile the moment a move is committed.
      const view = this.unitViews.get(u.id);
      const at = view
        ? { x: view.sprite.x, y: view.sprite.y + this.unitH / 2 - 6 }
        : this.projection.tileToWorld(u.state.position);
      brush.setPosition(at.x - this.darknessRT.x, at.y - this.darknessRT.y).setScale(1, squash);
      this.darknessRT.erase(brush);
    }
    // Torches and braziers light the night too — they used to be warm
    // specks the fog painted straight over.
    for (const l of this.boardLights) {
      const s = l.radius / BattleScene.SPOTLIGHT_BRUSH_OUTER;
      brush.setPosition(l.x - this.darknessRT.x, l.y - this.darknessRT.y).setScale(s, s * squash);
      this.darknessRT.erase(brush);
    }
  }

  // Per-frame: keep the fog-of-war overlay in sync with squad positions.
  // Phaser drives update() every frame; the spotlight is the only
  // continuous render-loop work this scene does.
  update(_time: number, delta: number): void {
    if (!this.spin && !this.fsm.isInputBlocked()) {
      const p = this.pendingSpin;
      this.pendingSpin = null;
      if (p && "to" in p) this.beginSpinTo(p.to);
      else if (p) this.beginSpin(p.dir);
      // A turn button or key still held after a turn finished (or held in
      // the other direction during it) starts the next one.
      else if (this.spinButtonDir !== 0) this.beginSpin(this.spinButtonDir);
      else if (this.keyE?.isDown) this.beginSpin(1);
      else if (this.keyQ?.isDown) this.beginSpin(-1);
    }
    if (this.spin) this.updateSpin(Math.min(delta, 50) / 1000);
    if (this.spinSettle) this.updateSpinSettle(Math.min(delta, 50) / 1000);
    this.syncXray();
    if (this.darknessRT) this.refreshSpotlight();
    this.fadeOccluders();
    if (this.backdropScene?.scene.isActive()) {
      this.backdropScene.follow(this.cameras.main.scrollX, this.cameras.main.scrollY);
    }
    // Keep every Ravage aura pinned to its sprite. Cheap (a handful of
    // ravaged units at most, and a no-op for views with no aura) and it
    // has to be per-frame: the sprite moves under tween control during
    // walks and attack lunges, while the aura is a separate object with
    // nothing but this to follow it.
    for (const v of this.unitViews.values()) {
      syncRavageAura(v);
      // Y-sort: whoever's feet are nearer the camera draws in front. Has
      // to be per-frame — walks, lunges and flinches move sprites under
      // tween control, and a unit crossing a row mid-walk must pass in
      // front of or behind its neighbours at the right moment.
      // A corpse keeps the depth of the spot it fell on: the topple moves
      // the sprite's centre down toward the floor, which would otherwise
      // sort the body in front of whoever stands in the next row.
      const sortY = isAlive(v.unit) ? v.sprite.y : v.baseY;
      v.sprite.setDepth(actorDepth(sortY + this.unitH / 2));
      this.syncCastShadow(v);
      // HUD rides the sprite, not the tile (see drawHpBar).
      v.hpBg.setPosition(v.sprite.x, v.sprite.y + HP_BAR_DY);
      v.hpBar.setPosition(v.sprite.x, v.sprite.y + HP_BAR_DY);
      v.stanceIcon.setPosition(v.sprite.x, v.sprite.y + 6);
    }
    this.syncHoverRim();
  }

  // The sun-shadow lies where the contact shadow is — on the ground, so a
  // hop or a lunge lifts the figure off its shadow — and wears the sprite's
  // current frame and facing. Gone the moment a unit starts to fall: a
  // shadow standing upright under a toppling body reads as a second body.
  private syncCastShadow(v: UnitView): void {
    const cs = v.castShadow;
    if (!cs) return;
    const s = v.sprite;
    // By day the sun; by night whichever flame the figure stands nearest,
    // recomputed as they walk — a soldier crossing a torch-lit square has
    // his shadow swing round him.
    const light = this.sun ?? torchShadow(v.shadow.x, v.shadow.y, this.boardLights);
    const show = !!light && s.visible && v.animLock !== "dying" && v.shadow.visible;
    cs.setVisible(show);
    if (!show || !light) return;
    if (cs.texture !== s.texture || cs.frame.name !== s.frame.name) cs.setTexture(s.texture.key, s.frame.name);
    cs.setPosition(v.shadow.x, v.shadow.y);
    cs.setDepth(this.sun ? DEPTH.SHADOW - 0.05 : DEPTH.TORCH_SHADOW);
    castFrom(cs, s, light);
    cs.setAlpha(light.alpha * s.alpha * v.shadow.alpha);
  }

  // A tree or a column in front of a unit fades to a ghost while anyone
  // stands behind it — on the tilted board a prop taller than a figure
  // covers the rows behind it, and a tactics board can't hide who's where.
  private fadeOccluders(): void {
    if (this.occluders.length === 0) return;
    const halfW = this.unitW / 2, halfH = this.unitH / 2;
    for (const o of this.occluders) {
      let behind = false;
      for (const v of this.unitViews.values()) {
        const s = v.sprite;
        if (!s.visible || s.alpha < 0.05) continue;
        const feet = s.y + halfH;
        if (feet >= o.footY - 2) continue;
        if (s.x + halfW * 0.6 < o.x0 || s.x - halfW * 0.6 > o.x1) continue;
        if (feet < o.y0 + 4) continue;
        behind = true;
        break;
      }
      const target = behind ? 0.42 : 1;
      const a = o.img.alpha;
      if (Math.abs(a - target) > 0.01) o.img.setAlpha(a + (target - a) * 0.22);
    }
  }

  // ===================================================================
  // Board camera: turning, zooming, the board build it all rests on.
  // ===================================================================

  /**
   * The board laid out at rotation `r`: projection, board origin, camera
   * bounds, and the ground's centre. Pure — nothing is applied. The TIGHT
   * bounds (board plus margins, never smaller than the screen) frame the
   * opening view; the camera gets slack beyond them so every board can be
   * dragged, including the many that fit the playfield.
   */
  private computeLayout(r: ViewRotation): BoardLayout {
    const map = this.boardMap;
    const { w: VW, h: VH } = viewSize(map.width, map.height, r);
    const elevAt = this.diorama ? elevationFor(map, r) : () => 0;
    const tileW = this.diorama ? DIORAMA_TILE_W : TILE_SIZE;
    const tileH = this.diorama ? DIORAMA_TILE_H : TILE_SIZE;
    const build = (ox: number, oy: number): RotatedProjection => new RotatedProjection(
      this.diorama
        ? new ObliqueProjection({
            originX: ox, originY: oy,
            tileW, tileH,
            elevStep: DIORAMA_ELEV_STEP, slabDepth: DIORAMA_SLAB_DEPTH,
            gridWidth: VW, gridHeight: VH,
            elevationAt: elevAt
          })
        : new OrthographicProjection({ originX: ox, originY: oy, tileSize: TILE_SIZE, gridWidth: VW, gridHeight: VH }),
      map.width, map.height, r
    );
    // The playfield viewport is the screen area NOT occupied by the side
    // panel (right) or the top bar (top). Measure the board with its origin
    // at zero, then centre what we measured. On the diorama the board is
    // shorter than width*48 (tiles are foreshortened) but gains a slab
    // under the front row, and raised terrain can poke ABOVE row 0 —
    // probe.y is that overhang (<= 0), which the origin absorbs so no
    // terrain is drawn under the top bar. Oversized maps anchor at a small
    // top-left margin and the camera handles the rest.
    const playW = GAME_WIDTH - PANEL_W - 40;
    const playH = GAME_HEIGHT - MAP_TOP_OFFSET - 40;
    const probe = build(0, 0).bounds();
    const originX = 20 + Math.max(0, Math.floor((playW - probe.w) / 2));
    const originY = MAP_TOP_OFFSET - probe.y + Math.max(0, Math.floor((playH - probe.h) / 2));
    const rotProj = build(originX, originY);

    const b = rotProj.bounds();
    const tightW = Math.max(GAME_WIDTH, b.x + b.w + 40 + PANEL_W + 12);
    const tightH = Math.max(GAME_HEIGHT, b.y + b.h + 40);
    // Slack: any edge of the board can be pulled to about the middle of
    // the playfield.
    const slackX = (GAME_WIDTH - PANEL_W) * 0.4;
    const slackY = (GAME_HEIGHT - MAP_TOP_OFFSET) * 0.4;
    const x0 = Math.min(0, b.x - slackX);
    const y0 = Math.min(0, b.y - slackY);
    return {
      rotation: r, rotProj, elevAt, originX, originY,
      tight: { w: tightW, h: tightH },
      cameraBounds: { x: x0, y: y0, w: tightW + slackX - x0, h: tightH + slackY - y0 },
      centre: { x: originX + (VW * tileW) / 2, y: originY + (VH * tileH) / 2 }
    };
  }

  /** Make a layout the live one: projection, heights, origin, camera bounds. */
  private applyLayout(L: BoardLayout): void {
    this.elevAt = L.elevAt;
    this.originX = L.originX;
    this.originY = L.originY;
    this.rotProj = L.rotProj;
    this.projection = L.rotProj;
    this.cameraBoundsRect = { ...L.cameraBounds };
    const cb = this.cameraBoundsRect;
    this.cameras.main.setBounds(cb.x, cb.y, cb.w, cb.h);
  }

  /** Lay the board out at the current rotation. Returns the tight bounds. */
  private layoutBoard(): { w: number; h: number } {
    const L = this.layouts[this.viewRotation] ?? this.computeLayout(this.viewRotation);
    this.applyLayout(L);
    return L.tight;
  }

  /** Every rotation's camera range together — what a turn can pass through. */
  private allLayoutsBounds(): { x: number; y: number; w: number; h: number } {
    const rects = this.layouts.length ? this.layouts.map((L) => L.cameraBounds) : [this.cameraBoundsRect];
    const x0 = Math.min(...rects.map((r) => r.x)), y0 = Math.min(...rects.map((r) => r.y));
    const x1 = Math.max(...rects.map((r) => r.x + r.w)), y1 = Math.max(...rects.map((r) => r.y + r.h));
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  /**
   * Everything the board draws: tiles, walls, water, props, torch light
   * (scenes/battle/Diorama.ts), and the drifting cloud shadows. Built in
   * VIEW space so it can be rebuilt at any rotation. Every object created
   * is recorded in boardObjects for the next rebuild to destroy.
   */
  private buildBoardArt(): void {
    const before = new Set(this.children.list);
    const rp = this.rotProj;
    const r = this.viewRotation;
    const map = this.boardMap;
    const grid = this.state.grid;
    const { w: VW, h: VH } = viewSize(map.width, map.height, r);
    const viewGrid: DioramaGrid = { width: VW, height: VH, tileAt: (v) => grid.tileAt(rp.grid(v)) };
    const board = buildDiorama(this, viewGrid, rp.inner, {
      footDY: this.diorama ? DIORAMA_FOOT_DY : TILE_SIZE * 0.3,
      seed: map.id.length * 31 + 7,
      elevationAt: this.elevAt,
      elevStep: this.diorama ? DIORAMA_ELEV_STEP : 0,
      sun: this.sun,
      torchShadows: this.torchShadows,
      rotation: r,
      gridOf: (x, y) => rp.grid({ x, y })
    });
    this.boardLights = board.lights;
    this.occluders = board.occluders;
    this.dioramaTops = board.tops;
    this.dioramaProps = board.props;

    const atmoKind = this.boardAtmo;
    // Cloud shadows — outdoor maps get two huge, soft, near-black blobs
    // drifting slowly across the board. Added after the tiles and before
    // the overlays/units in add-order, so they darken the ground but
    // never the pieces standing on it. The motion is what matters: a
    // static board with moving light reads as a place, not a screenshot.
    // Interiors and fire-lit battles (embers) skip them — ceilings and
    // smoke columns don't cast drifting cumulus.
    if (atmoKind === "snow" || atmoKind === "dust" || atmoKind === "motes") {
      const cb = this.projection.bounds();
      const worldW = cb.w;
      const worldH = cb.h;
      const dotKey = ensureDotTexture(this);
      for (let c = 0; c < 2; c++) {
        const cloud = this.add.image(
          this.originX - 420 - c * (worldW * 0.6 + 500),
          cb.y + worldH * (c === 0 ? 0.3 : 0.72),
          dotKey
        );
        cloud.setTint(0x000000);
        cloud.setAlpha(0.10);
        // Shadows fall on the ground, never on the pieces standing on it.
        cloud.setDepth(DEPTH.CLOUD_SHADOW);
        cloud.setDisplaySize(560 + c * 180, 320 + c * 90);
        this.tweens.add({
          targets: cloud,
          x: this.originX + worldW + 460,
          duration: 52000 + c * 21000,
          repeat: -1,
          delay: c * 9000,
          onRepeat: () => { cloud.x = this.originX - 460; }
        });
      }
    }

    this.boardObjects = this.children.list.filter((o) => !before.has(o));
    // Built after the camera split (a turn): keep it off the UI camera.
    if (this.uiCamera && this.boardObjects.length) this.uiCamera.ignore(this.boardObjects);
  }

  /** Height in levels of a GRID tile (elevAt is indexed by view cell). */
  private elevAtTile(t: TilePos): number {
    const v = this.rotProj.view(t);
    return this.elevAt(v.x, v.y);
  }

  /**
   * Whether a unit's sprite should be mirrored. Facing is stored in grid
   * terms (+1 east, -1 west); on screen, east points right, left, or — on
   * a quarter-turned board — straight into or out of the screen, where
   * the unit keeps the look it had.
   */
  private screenFlipX(u: Unit): boolean {
    const p = u.state.position;
    const dx = this.projection.tileToWorld({ x: p.x + 1, y: p.y }).x - this.projection.tileToWorld(p).x;
    if (Math.abs(dx) < 1) return u.state.facingX === -1;
    return u.state.facingX * Math.sign(dx) < 0;
  }

  // ===================================================================
  // The animated turn.
  // ===================================================================

  /** A turn button went down: turn that way now (or as soon as the board is free). */
  private spinPress(dir: 1 | -1): void {
    this.spinButtonDir = dir;
    this.beginSpin(dir);
  }

  /** Start turning the board a quarter-turn (+1 clockwise, -1 anticlockwise). */
  private beginSpin(dir: 1 | -1): void {
    if (this.spin) return;
    if (this.fsm.isInputBlocked()) { this.pendingSpin = { dir }; return; }
    const phi = this.viewRotation * (Math.PI / 2);
    this.startSpin(dir, phi + dir * (Math.PI / 2), false);
  }

  /** Turn the board to rotation `r` the short way round (the view reset). */
  private beginSpinTo(r: ViewRotation): void {
    if (this.spin || this.fsm.isInputBlocked()) { this.pendingSpin = { to: r }; return; }
    const diff = normalizeRotation(r - this.viewRotation);
    if (diff === 0) { this.centreBoard(); return; }
    const quarters = diff === 3 ? -1 : diff;
    const phi = this.viewRotation * (Math.PI / 2);
    this.startSpin(quarters < 0 ? -1 : 1, phi + quarters * (Math.PI / 2), true);
  }

  /** For tools and the capture rig: turn to `r`. */
  spinTo(r: ViewRotation): void {
    this.beginSpinTo(r);
  }

  private startSpin(dir: 1 | -1, target: number, fixed: boolean): void {
    if (this.spinSettle) this.endSpinSettle();
    const cam = this.cameras.main;
    const phi = this.viewRotation * (Math.PI / 2);

    // Units: a walk-in lands now; a body mid-fall is simply gone (it
    // would lie at its old world position otherwise); nobody breathes
    // while the board turns under them.
    for (const v of this.unitViews.values()) {
      if (v.animLock === "arriving") v.finishArrival?.();
      if (v.animLock === "dying") {
        this.tweens.killTweensOf(v.sprite);
        this.tweens.killTweensOf(v.shadow);
        v.animLock = undefined;
        v.sprite.setVisible(false);
        v.shadow.setVisible(false);
      }
      this.stopBreathing(v);
    }

    // Tactical marks go for the turn; they are redrawn on the new board.
    this.clearXray();
    this.clearPathPreview();
    this.hoverPreview.setVisible(false);
    const hidden = [this.overlayG, this.contourG, this.dangerG, this.threatG, this.cursorG, this.activeRing, this.activeArrow];
    for (const h of hidden) h.setVisible(false);

    // The static board: its own animations stop (they would fight the
    // fade), props are carried by the turntable, everything else fades.
    const propSet = new Set<Phaser.GameObjects.GameObject>(this.dioramaProps.map((p) => p.img));
    const fade: SpinState["fade"] = [];
    for (const o of this.boardObjects) {
      this.tweens.killTweensOf(o);
      if (propSet.has(o)) continue;
      const a = o as unknown as SpinState["fade"][number]["o"];
      if (typeof a.alpha === "number") fade.push({ o: a, a: a.alpha });
    }
    for (const p of this.dioramaProps) p.img.setAlpha(1);
    this.occluders = [];

    // The turntable.
    const tops: SpinState["tops"] = [];
    const walls: SpinState["walls"] = [];
    const tileW = this.diorama ? DIORAMA_TILE_W : TILE_SIZE;
    const tileH = this.diorama ? DIORAMA_TILE_H : TILE_SIZE;
    for (const d of this.dioramaTops) {
      const img = this.make.image({ key: d.key, add: false })
        .setDisplaySize(tileW, tileW).setFlip(d.flipX, d.flipY).setTint(d.tint);
      const c = this.add.container(0, 0, [img]).setScale(1, tileH / tileW);
      tops.push({ c, img, gx: d.gx, gy: d.gy });
      if (this.diorama) {
        const g = this.add.graphics();
        walls.push({ g, gx: d.gx, gy: d.gy, colour: faceColour(this, d.terrain) });
      }
    }
    const pieces: Phaser.GameObjects.GameObject[] = [...tops.map((p) => p.c), ...walls.map((w) => w.g)];
    if (this.uiCamera) this.uiCamera.ignore(pieces);

    // The camera may pass anywhere any rotation's framing could be.
    const ub = this.allLayoutsBounds();
    cam.setBounds(ub.x, ub.y, ub.w, ub.h);

    this.spin = {
      phi, vel: 0, target, dir, firstTarget: target, fixed, held: !fixed, elapsed: 0,
      startScroll: { x: cam.scrollX, y: cam.scrollY },
      tops, walls, props: this.dioramaProps, fade, hidden
    };
    this.placeSpin();
  }

  private isSpinHeld(dir: 1 | -1): boolean {
    if (this.spinButtonDir === dir) return true;
    return !!(dir > 0 ? this.keyE?.isDown : this.keyQ?.isDown);
  }

  // One frame of the turn: a critically damped spring toward the target
  // angle, speed-limited. Holding keeps the target a quarter ahead, so the
  // board turns steadily; letting go retargets to the next quarter in the
  // direction of travel (never short of the first quarter asked for), so
  // it glides to a stop square on a view.
  private updateSpin(dt: number): void {
    const s = this.spin!;
    const Q = Math.PI / 2;
    const held = !s.fixed && this.isSpinHeld(s.dir);
    if (held && s.dir * (s.target - s.phi) < Q * 0.6) s.target += s.dir * Q;
    if (s.held && !held) {
      const pos = s.phi / Q;
      let tgt = (s.dir > 0 ? Math.ceil(pos - 0.02) : Math.floor(pos + 0.02)) * Q;
      tgt = s.dir > 0 ? Math.max(tgt, s.firstTarget) : Math.min(tgt, s.firstTarget);
      s.target = tgt;
    }
    s.held = held;
    s.elapsed += dt;
    // About half a second for a quarter-turn from rest; held, a steady
    // quarter every quarter of a second or so.
    const w0 = 18 * this.spinPace;
    const maxV = (Q / 0.26) * this.spinPace;
    // Acceleration is capped so a turn eases in: a bare spring leaps off
    // the mark (a fifth of a quarter in its first 80ms).
    const maxA = maxV / 0.1;
    const dv = Phaser.Math.Clamp((w0 * w0 * (s.target - s.phi) - 2 * w0 * s.vel) * dt, -maxA * dt, maxA * dt);
    s.vel = Phaser.Math.Clamp(s.vel + dv, -maxV, maxV);
    s.phi += s.vel * dt;
    // Within half a degree and all but stopped: it lands exactly on the view.
    if (!held && Math.abs(s.target - s.phi) < 0.008 && Math.abs(s.vel) < 0.2) {
      s.phi = s.target;
      this.placeSpin();
      this.finishSpin();
      return;
    }
    this.placeSpin();
  }

  // Place the whole turntable — and every unit — at the current angle.
  private placeSpin(): void {
    const s = this.spin!;
    const map = this.boardMap;
    const W = map.width, H = map.height;
    const Q = Math.PI / 2;
    const q = s.phi / Q;
    const k0 = Math.floor(q);
    const f = q - k0;
    const ka = normalizeRotation(k0), kb = normalizeRotation(k0 + 1);
    const La = this.layouts[ka]!, Lb = this.layouts[kb]!;
    const ha = this.gridHeights[ka]!, hb = this.gridHeights[kb]!;
    const cx = La.centre.x + (Lb.centre.x - La.centre.x) * f;
    const cy = La.centre.y + (Lb.centre.y - La.centre.y) * f;
    const cos = Math.cos(s.phi), sin = Math.sin(s.phi);
    const tileW = this.diorama ? DIORAMA_TILE_W : TILE_SIZE;
    const tileH = this.diorama ? DIORAMA_TILE_H : TILE_SIZE;
    const step = this.diorama ? DIORAMA_ELEV_STEP : 0;
    const slabLevels = this.diorama ? -DIORAMA_SLAB_DEPTH / DIORAMA_ELEV_STEP : 0;
    const height = (gx: number, gy: number): number => {
      if (gx < 0 || gy < 0 || gx >= W || gy >= H) return slabLevels;
      const i = gy * W + gx;
      return ha[i]! + (hb[i]! - ha[i]!) * f;
    };
    // A point on the ground, in grid units about the board's centre, lifted.
    const at = (u: number, v: number, h: number) => ({
      x: cx + (u * cos - v * sin) * tileW,
      y: cy + (u * sin + v * cos) * tileH - h * step,
      depthRow: u * sin + v * cos
    });
    const centred = (gx: number, gy: number) => ({ u: gx + 0.5 - W / 2, v: gy + 0.5 - H / 2 });

    // The turntable is solid from the first frame, drawn UNDER the terrain
    // band; the static board fades out over it, so the picture never goes
    // thin enough to show the backdrop through the board.
    const fin = Phaser.Math.Clamp(s.elapsed / 0.08, 0, 1);
    for (const e of s.fade) {
      e.o.setAlpha(e.a * (1 - fin));
      if (fin >= 1) e.o.setVisible(false);
    }

    for (const p of s.tops) {
      const { u, v } = centred(p.gx, p.gy);
      const h = height(p.gx, p.gy);
      const P = at(u, v, h);
      p.c.setPosition(P.x, P.y).setDepth(terrainDepth(P.depthRow - 200 + h * 0.001));
      p.img.setRotation(s.phi);
    }

    // Walls: each edge that faces the camera and stands above the ground
    // beyond it hangs a quad from the lifted edge down to that ground,
    // lit on the west-facing side like the static board's walls.
    const EDGES = [
      { nx: 0, ny: -1, a: [-0.5, -0.5], b: [0.5, -0.5], dx: 0, dy: -1 },
      { nx: 0, ny: 1, a: [-0.5, 0.5], b: [0.5, 0.5], dx: 0, dy: 1 },
      { nx: -1, ny: 0, a: [-0.5, -0.5], b: [-0.5, 0.5], dx: -1, dy: 0 },
      { nx: 1, ny: 0, a: [0.5, -0.5], b: [0.5, 0.5], dx: 1, dy: 0 }
    ] as const;
    for (const w of s.walls) {
      const g = w.g;
      g.clear();
      const { u, v } = centred(w.gx, w.gy);
      const h = height(w.gx, w.gy);
      const P = at(u, v, h);
      g.setDepth(terrainDepth(P.depthRow - 200 + h * 0.001) + 1e-6);
      for (const e of EDGES) {
        const ny = e.nx * sin + e.ny * cos;
        if (ny < 0.02) continue;
        const hn = height(w.gx + e.dx, w.gy + e.dy);
        const drop = h - hn;
        if (drop <= 0.01) continue;
        const A = at(u + e.a[0], v + e.a[1], h), Bp = at(u + e.b[0], v + e.b[1], h);
        const dy = drop * step;
        const nxs = e.nx * cos - e.ny * sin;
        const k = 1 - 0.28 * nxs;
        const top = this.shadeColour(w.colour, k * 1.08), bottom = this.shadeColour(w.colour, k * 0.82);
        g.fillGradientStyle(top, top, bottom, bottom, 1);
        g.fillTriangle(A.x, A.y, Bp.x, Bp.y, Bp.x, Bp.y + dy);
        g.fillGradientStyle(top, bottom, bottom, bottom, 1);
        g.fillTriangle(A.x, A.y, Bp.x, Bp.y + dy, A.x, A.y + dy);
      }
    }

    const footDY = this.diorama ? DIORAMA_FOOT_DY : TILE_SIZE * 0.3;
    for (const p of s.props) {
      const { u, v } = centred(p.gx, p.gy);
      const P = at(u, v, height(p.gx, p.gy));
      p.img.setPosition(P.x, P.y + footDY).setDepth(actorDepth(P.y + footDY - 0.5));
    }
    // Torches carry their light.
    for (const l of this.boardLights) {
      if (l.img) { l.x = l.img.x; l.y = l.img.y; }
    }

    // Units stand on their tiles as the board turns, and turn to face the
    // way they face on the board (east is cos φ across the screen).
    for (const view of this.unitViews.values()) {
      if (!isAlive(view.unit) || !view.sprite.visible) continue;
      const pos = view.unit.state.position;
      const { u, v } = centred(pos.x, pos.y);
      const P = at(u, v, height(pos.x, pos.y));
      view.baseY = P.y + this.unitLift;
      view.sprite.setPosition(P.x, view.baseY);
      view.shadow.setPosition(P.x, view.baseY + 24);
      if (Math.abs(cos) > 0.2) view.sprite.setFlipX(view.unit.state.facingX * cos < 0);
    }

    // The camera glides until the board's centre sits in the middle of the
    // playfield, and holds it there while the board turns about it.
    const cam = this.cameras.main;
    const c = this.playfieldCentreScreen();
    const src = this.keystone ? screenToSource(c.x, c.y, cam.width, cam.height, this.keystone) : null;
    const want = { x: cx - (src?.x ?? c.x) / cam.zoom, y: cy - (src?.y ?? c.y) / cam.zoom };
    const e = Phaser.Math.Easing.Cubic.InOut(Phaser.Math.Clamp(s.elapsed / 0.4, 0, 1));
    cam.setScroll(
      s.startScroll.x + (want.x - s.startScroll.x) * e,
      s.startScroll.y + (want.y - s.startScroll.y) * e
    );
  }

  private shadeColour(c: number, k: number): number {
    const r = Math.min(255, Math.round(((c >> 16) & 0xff) * k));
    const g = Math.min(255, Math.round(((c >> 8) & 0xff) * k));
    const b = Math.min(255, Math.round((c & 0xff) * k));
    return (r << 16) | (g << 8) | b;
  }

  // The turn has landed on a view: build the real board there, centre it,
  // and fade it in over the turntable.
  private finishSpin(): void {
    const s = this.spin!;
    this.spin = undefined;
    this.viewRotation = normalizeRotation(Math.round(s.phi / (Math.PI / 2)));
    const scroll = { x: this.cameras.main.scrollX, y: this.cameras.main.scrollY };

    for (const o of this.boardObjects) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.boardObjects = [];
    this.layoutBoard();
    this.buildBoardArt();
    // The new board fades in; its props are already where the
    // turntable's were, so they come in whole.
    const propSet = new Set<Phaser.GameObjects.GameObject>(this.dioramaProps.map((p) => p.img));
    const fadeIn: SpinState["fade"] = [];
    for (const o of this.boardObjects) {
      if (propSet.has(o)) continue;
      const a = o as unknown as SpinState["fade"][number]["o"];
      if (typeof a.alpha !== "number") continue;
      fadeIn.push({ o: a, a: a.alpha });
      a.setAlpha(0);
    }
    if (this.darknessRT) {
      this.darknessRT.destroy();
      this.darknessRT = undefined;
      this.setupSpotlightOverlay();
    }

    for (const h of s.hidden) h.setVisible(true);
    this.refreshAllUnits();
    for (const v of this.unitViews.values()) this.startBreathing(v);
    this.cursorG.clear();
    this.drawOverlay();
    // Where the turn left it — the board's centre in the middle of the
    // view — inside this rotation's own camera range.
    this.cameras.main.setScroll(scroll.x, scroll.y);
    this.centreBoard();

    this.spinSettle = { t: 0, fadeIn, pieces: [...s.tops.map((p) => p.c), ...s.walls.map((w) => w.g)] };
  }

  private updateSpinSettle(dt: number): void {
    const st = this.spinSettle!;
    st.t += dt;
    const k = Phaser.Math.Clamp(st.t / 0.18, 0, 1);
    // The new board comes in over the (still solid) turntable beneath it.
    for (const e of st.fadeIn) e.o.setAlpha(e.a * k);
    if (k >= 1) this.endSpinSettle();
  }

  private endSpinSettle(): void {
    const st = this.spinSettle;
    if (!st) return;
    for (const e of st.fadeIn) e.o.setAlpha(e.a);
    for (const p of st.pieces) p.destroy();
    this.spinSettle = undefined;
  }

  /** Scroll so the board's centre sits in the middle of the playfield. */
  private centreBoard(): void {
    const L = this.layouts[this.viewRotation];
    if (!L) return;
    const cam = this.cameras.main;
    const c = this.playfieldCentreScreen();
    const cur = this.screenToWorld(c.x, c.y);
    cam.setScroll(cam.scrollX + L.centre.x - cur.x, cam.scrollY + L.centre.y - cur.y);
  }

  /** Screen point (buffer px) at the middle of the playfield. */
  private playfieldCentreScreen(): { x: number; y: number } {
    return {
      x: ((GAME_WIDTH - PANEL_W - 12) / 2) * RENDER_SCALE,
      y: ((MAP_TOP_OFFSET + GAME_HEIGHT) / 2) * RENDER_SCALE
    };
  }

  /** World point under a screen point (buffer px), through the tilt. */
  private screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const cam = this.cameras.main;
    const src = this.keystone ? screenToSource(sx, sy, cam.width, cam.height, this.keystone) : null;
    const px = src?.x ?? sx, py = src?.y ?? sy;
    // Cameras zoom about their top-left (util/renderScale), so the world
    // point is just scroll + screen / zoom — no stale matrix involved.
    return { x: cam.scrollX + px / cam.zoom, y: cam.scrollY + py / cam.zoom };
  }

  /**
   * Zoom the board to `factor` × the default view (clamped 1–2), keeping
   * the world point under the given screen point (the cursor) still.
   */
  private setBoardZoom(factor: number, sx?: number, sy?: number): void {
    // The battle is over: the camera belongs to its finale.
    if (this.fsm.isEnded()) return;
    const f = Phaser.Math.Clamp(factor, 1, 2);
    if (Math.abs(f - this.zoomFactor) < 1e-3) return;
    const cam = this.cameras.main;
    const c = sx === undefined || sy === undefined ? this.playfieldCentreScreen() : { x: sx, y: sy };
    const src = this.keystone ? screenToSource(c.x, c.y, cam.width, cam.height, this.keystone) : null;
    const px = src?.x ?? c.x, py = src?.y ?? c.y;
    const wx = cam.scrollX + px / cam.zoom, wy = cam.scrollY + py / cam.zoom;
    this.zoomFactor = f;
    this.hoverPreview.setVisible(false);
    cam.setZoom(this.baseZoom * f);
    cam.setScroll(wx - px / cam.zoom, wy - py / cam.zoom);
  }

  /** Back to the authored view: no turn, no zoom, the board centred. */
  private resetView(): void {
    this.setBoardZoom(1);
    this.beginSpinTo(0);
  }

  // Q / E turn the board, R resets the view, the wheel (or + / -) zooms.
  private setupCameraTurnAndZoom(): void {
    const kb = this.input.keyboard;
    // Tap to turn a quarter; hold to keep turning (update() reads isDown).
    this.keyQ = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.Q);
    this.keyE = kb?.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    kb?.on("keydown-Q", () => this.beginSpin(-1));
    kb?.on("keydown-E", () => this.beginSpin(1));
    kb?.on("keydown-R", () => this.resetView());
    const step = (up: boolean) => this.setBoardZoom(this.zoomFactor * (up ? 1.15 : 1 / 1.15));
    kb?.on("keydown-PLUS", () => step(true));
    kb?.on("keydown-NUMPAD_ADD", () => step(true));
    kb?.on("keydown-MINUS", () => step(false));
    kb?.on("keydown-NUMPAD_SUBTRACT", () => step(false));
    // Proportional to the wheel distance: a mouse notch (~100) is a ~13%
    // step, while a trackpad's stream of small deltas glides instead of
    // racing to full zoom in a flick.
    this.input.on("wheel", (p: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      if (this.isOverUi(p) || this.spin || dy === 0 || this.fsm.isEnded()) return;
      const d = Phaser.Math.Clamp(dy, -200, 200);
      this.setBoardZoom(this.zoomFactor * Math.exp(-d * 0.0013), p.x, p.y);
    });
  }

  // ---- hover x-ray ----------------------------------------------------

  /**
   * The front-most thing standing IN FRONT of a world point and covering
   * it: another unit's sprite, or a tall prop. `behindFootY` is the feet
   * line of whatever is at the point; only things with feet nearer the
   * camera count.
   */
  private coveredAt(wx: number, wy: number, behindFootY: number, exceptId?: string): boolean {
    for (const v of this.unitViews.values()) {
      if (v.unit.id === exceptId || !v.sprite.visible || !isAlive(v.unit)) continue;
      const feet = v.sprite.y + this.unitH / 2;
      if (feet <= behindFootY + 1) continue;
      if (figureAt(v.sprite, wx, wy, false)) return true;
    }
    for (const o of this.occluders) {
      if (o.footY <= behindFootY + 1) continue;
      if (wx >= o.x0 && wx <= o.x1 && wy >= o.y0 && wy <= o.footY) return true;
    }
    return false;
  }

  /**
   * Hovering a tile or a unit that something in front hides: draw the
   * tile's outline above the actors, and the unit's silhouette through
   * whatever covers it. On a tilted board that is the difference between
   * "which one am I pointing at?" and knowing.
   */
  private updateXray(tile: TilePos): void {
    if (!this.cursorTopG?.active) {
      this.cursorTopG = this.addWorld(this.add.graphics().setDepth(this.xrayDepth() + 0.1));
    }
    this.cursorTopG.clear();
    const q = this.tileQuad(tile);
    const cx = (q.L + q.R) / 2, cy = (q.T + q.B) / 2;
    const tileFeet = cy + (this.diorama ? DIORAMA_FOOT_DY : 0);
    const occ = unitAt(this.state, tile);
    const view = occ ? this.unitViews.get(occ.id) : undefined;
    const tileHidden = this.coveredAt(cx, cy, tileFeet, occ?.id);
    let unitHidden = false;
    if (view && view.sprite.visible) {
      const s = view.sprite, feet = s.y + this.unitH / 2;
      // Head, chest and hips: hidden if any of them is covered.
      const c = bodyCentre(s);
      unitHidden = [-0.22, 0, 0.22].some((k) => this.coveredAt(c.x, c.y + k * s.displayHeight, feet, occ!.id));
    }
    if (tileHidden) {
      const g = this.cursorTopG;
      g.lineStyle(3, 0x000000, 0.35);
      g.strokeRect(q.L + 0.5, q.T + 0.5, q.R - q.L - 1, q.B - q.T - 1);
      g.lineStyle(1.5, COLORS.hover, 0.95);
      g.strokeRect(q.L + 0.5, q.T + 0.5, q.R - q.L - 1, q.B - q.T - 1);
    }
    this.xrayUnitId = unitHidden && occ ? occ.id : null;
    this.syncXray();
    // The rim marks the unit a click would select: red for an attack
    // target, the cursor colour for anyone else.
    this.rimUnitId = occ && view && view.sprite.visible ? occ.id : null;
    this.rimColour = occ && this.actionableTargets().has(occ.id) ? 0xff5a3c : COLORS.hover;
    this.syncHoverRim();
  }

  // Above every actor, below the HP bars — and on dark battles above the
  // fog, like the other tactical marks, or it would be lost in it.
  private xrayDepth(): number {
    return this.darknessRT ? DEPTH.OVER_DARK + 0.4 : DEPTH.UNIT_HUD - 0.5;
  }

  private clearXray(): void {
    this.xrayUnitId = null;
    this.cursorTopG?.clear();
    this.xrayImg?.setVisible(false);
    this.rimUnitId = null;
    for (const r of this.rimImgs) r.setVisible(false);
  }

  // Four tinted copies of the hovered figure, a pixel and a half out on
  // each side and drawn just behind it: an outline that follows its frame,
  // facing and breath, and sorts with it among the other actors.
  private syncHoverRim(): void {
    const v = this.rimUnitId ? this.unitViews.get(this.rimUnitId) : undefined;
    if (!v || !v.sprite.visible || !isAlive(v.unit) || this.spin) {
      for (const r of this.rimImgs) r.setVisible(false);
      return;
    }
    const s = v.sprite;
    // `active` too: destroyed images must never be reused (see init).
    if (this.rimImgs.length === 0 || !this.rimImgs.every((r) => r.active)) {
      for (const r of this.rimImgs) r.destroy();
      this.rimImgs = [];
      for (let i = 0; i < 4; i++) this.rimImgs.push(this.addWorld(this.add.image(0, 0, s.texture.key, s.frame.name)));
    }
    const OFF = [[1.5, 0], [-1.5, 0], [0, 1.5], [0, -1.5]] as const;
    this.rimImgs.forEach((img, i) => {
      if (img.texture !== s.texture || img.frame.name !== s.frame.name) img.setTexture(s.texture.key, s.frame.name);
      img.setPosition(s.x + OFF[i]![0], s.y + OFF[i]![1])
        .setDisplaySize(s.displayWidth, s.displayHeight).setFlipX(s.flipX).setRotation(s.rotation)
        .setTintFill(this.rimColour).setAlpha(0.9).setDepth(s.depth - 1e-6).setVisible(true);
    });
  }

  // The x-ray silhouette follows its unit's current frame, facing and
  // breath every frame while it is shown.
  private syncXray(): void {
    const v = this.xrayUnitId ? this.unitViews.get(this.xrayUnitId) : undefined;
    if (!v || !v.sprite.visible || !isAlive(v.unit)) {
      this.xrayImg?.setVisible(false);
      return;
    }
    const s = v.sprite;
    // `active` too: a destroyed image must never be reused (see init).
    if (!this.xrayImg?.active) {
      this.xrayImg = this.addWorld(this.add.image(0, 0, s.texture.key, s.frame.name).setDepth(this.xrayDepth()));
    }
    const img = this.xrayImg;
    if (img.texture !== s.texture || img.frame.name !== s.frame.name) img.setTexture(s.texture.key, s.frame.name);
    const tint = v.unit.faction === "enemy" ? 0xff8a6a : v.unit.faction === "ally" ? 0x9fe0a0 : 0x8cc4ff;
    img.setPosition(s.x, s.y).setDisplaySize(s.displayWidth, s.displayHeight).setFlipX(s.flipX)
      .setTintFill(tint).setAlpha(0.42).setVisible(true);
  }

  private refreshAllUnits(): void {
    for (const u of this.state.units) this.refreshUnitView(u);
    const cur = this.initiative.current();
    if (cur) this.drawActiveMarker(cur);
  }

  private pushLog(msg: string): void {
    this.logLines.push(msg);
    if (this.logLines.length > 7) this.logLines.shift();
    this.logText.setText(this.logLines.join("\n"));
    // Cap by MEASURED height, not entry count: long entries (interpose,
    // level-ups) wrap to 2 lines each, and 7 wrapped entries ran past the
    // side panel's bottom edge and off the canvas. Drop oldest entries
    // until the block fits the space between the log's y and the panel
    // bottom (590 → 700, minus a small pad).
    const LOG_MAX_H = 104;
    while (this.logText.height > LOG_MAX_H && this.logLines.length > 1) {
      this.logLines.shift();
      this.logText.setText(this.logLines.join("\n"));
    }
  }

  private refreshDebug(): void {
    if (!this.debug) {
      this.debugText.setText("");
      return;
    }
    const u = this.initiative.current();
    if (!u) return;
    this.debugText.setText(
      `[debug] round=${this.initiative.round}  active=${u.id}  ap=${u.state.apRemaining}/${effectiveMaxAp(u)}  pos=${u.state.position.x},${u.state.position.y}  alive=${isAlive(u)}`
    );
  }

  // ---- Turn flow ----
  private beginCurrentTurn(): void {
    if (this.fsm.isEnded()) return;
    let u = this.initiative.current();
    while (u && !isAlive(u)) {
      u = this.initiative.advance(this.state.units);
    }
    if (!u) return;
    const isNewPhase = !this.lastActorFaction || this.lastActorFaction !== u.faction;
    this.lastActorFaction = u.faction;
    // New unit's turn — whatever undo history the previous unit had is gone.
    this.undoStack.length = 0;
    // Normalize the FSM before dispatching. Auto-entered targeting
    // (seamless move/attack overlays) can still be live for the PREVIOUS
    // unit when control changes hands — via the swap-click path
    // (initiative.setCurrent → here) or End Turn pressed with an overlay
    // open. Left alone, drawOverlay below re-renders the OLD unit's
    // tiles under the NEW unit's turn, buildActionButtons skips its
    // auto-enter (guarded on idle), and a click on a stale tile walks
    // the new unit along an unbounded pathTo route it could never
    // legally reach. Dropping to idle here makes the dispatch start
    // clean and the auto-enter recompute ranges for the actual actor.
    const staleTag = this.fsm.current().tag;
    if (staleTag === "move" || staleTag === "attack" || staleTag === "roam") {
      this.fsm.send({ tag: "CANCEL_TARGETING" });
    }
    beginUnitTurn(u);
    // Mid-battle suspend: capture the board at every turn boundary (AFTER
    // beginUnitTurn so the snapshot holds the refilled AP — beginUnitTurn
    // is idempotent per round, so resuming won't refill twice). If the
    // tab closes mid-turn, resume replays this turn from its start.
    this.writeSuspend();
    this.tutorial?.notify("roundStart", this.initiative.round);
    // beginUnitTurn just promoted ravagedNextTurn → ravagedActive (if it
    // was set). Surface that with a one-shot RAVAGED! floater + camera
    // shake so the player sees the moment the buff lands. Persistent
    // crimson aura is rendered by refreshUnitView() below and lives until
    // endUnitTurn flips ravagedActive back off.
    if (u.state.ravagedActive) this.announceRavaged(u);
    this.inspectedUnitId = null;
    this.inspectTag.setText("");
    this.activeUnitText.setText(u.name);
    this.refreshSidePanel(u);
    this.initiativeBar.refresh();
    this.refreshAllUnits();
    this.drawActiveMarker(u);
    this.refreshDebug();
    this.clearActionButtons();
    this.clearOverlays();
    this.drawOverlay();
    // Apply the 2× enemy-turn timescale (or reset on player turn) before any
    // tweens for this turn are scheduled.
    this.applyTurnSpeed();

    const startTurn = () => {
      if (this.fsm.isEnded()) return;
      // Check for round_start / adjacent_eot dialogue triggers BEFORE
      // dispatching control. If a dialogue fires, scene.pause() halts
      // tweens + timers (including the 450ms enemy-turn delay below),
      // and the AI / player input continues normally on resume. Doing
      // this first means dialogues land BEFORE the AI starts moving
      // and BEFORE the player gets action buttons — feels like a beat
      // in the script rather than an interrupt.
      this.dialogue.checkTurnTriggers();
      if (u.faction === "player" && isAlive(u)) {
        // Coming off an enemy phase: drop back to idle before unlocking input.
        if (this.fsm.current().tag === "enemyTurn") {
          this.fsm.send({ tag: "END_ENEMY_TURN" });
        }
        this.buildActionButtons(u);
        this.tutorial?.notify("playerTurn");
      } else {
        // Enter enemyTurn before kicking off the AI loop so any tile click
        // arriving during the 450ms grace window is properly blocked.
        this.fsm.send({ tag: "BEGIN_ENEMY_TURN" });
        this.tutorial?.notify("enemyPhase");
        this.time.delayedCall(450, () => this.runEnemyTurn(u));
      }
    };
    if (isNewPhase) this.showPhaseBanner(u.faction, startTurn);
    else startTurn();
  }

  // ---- Camera scrolling ----
  // Pin a UI GameObject to the screen so it doesn't move when the player
  // pans the camera. Used for everything in the top bar, side panel,
  // action button block, hover/info tooltips, phase banners, and any ad-hoc
  // overlay (item picker, dialogue boxes, etc.). Tile sprites, unit sprites,
  // overlays, and damage floaters are left at the default scrollFactor of 1
  // so they move with the world.
  //
  // Recursion gotcha — required, not optional. Phaser 3.80's built-in
  // Container.setScrollFactor(x, y, true) recursion uses ArrayUtils.SetAll,
  // which guards each child assignment with `hasOwnProperty('scrollFactorX')`.
  // scrollFactorX/Y are defined on the Components.ScrollFactor mixin's
  // prototype and only become OWN properties after .setScrollFactor() has
  // been called once on that specific instance. So freshly-created child
  // objects (Buttons, Rectangles, Texts, Zones inside a Container) silently
  // fail the guard and keep scrollFactor=1 — visual is pinned via the
  // parent transform, but interactive hit-testing happens in world
  // coordinates, so cursor + visible-element drift apart by camera.scrollY
  // px once the player pans on a tall map (B5 / B7 / B11 / B13 etc.).
  //
  // Symptoms historically: cursor must hover ABOVE the visible button to
  // click it (commit caec5b5 fixed the action-button case via a
  // per-Button override, but the same trap caught the new ItemPicker rows).
  // The durable fix is to walk the tree ourselves and call
  // .setScrollFactor() explicitly on each descendant — the prototype
  // method assigns scrollFactor as an own property, so the next read
  // through any code path sees the correct value.
  //
  // Per-widget overrides (e.g., Button.setScrollFactor) remain as belt-
  // and-suspenders for callers that don't go through pin().
  private pin<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.pinDeep(obj as unknown as Phaser.GameObjects.GameObject);
    // Register the object as UI. The end-of-create() sweep applies
    // these ignore lists in bulk; pin() calls AFTER create (action
    // buttons during a turn, the item picker, info tooltips) hit the
    // incremental branch below so they land on the UI camera only.
    this.uiObjects.push(obj);
    if (this.uiCamera) {
      // Main camera (with cinematic FX) ignores UI so the side panel
      // and buttons aren't darkened by the vignette / re-tinted by
      // the color matrix.
      this.cameras.main.ignore(obj);
      // The descendants of a pinned Container need to be ignored too,
      // because Phaser's Camera.ignore() on a Container does NOT
      // recurse into its children for the render queue check.
      this.ignoreDeepOnWorldCamera(obj);
    }
    return obj;
  }

  // Walk a Container tree and tell the main (world) camera to ignore
  // each child explicitly. Same gotcha as pinDeep — Phaser doesn't
  // auto-propagate camera.ignore() through Container children.
  private ignoreDeepOnWorldCamera(obj: Phaser.GameObjects.GameObject): void {
    this.cameras.main.ignore(obj);
    if (obj instanceof Phaser.GameObjects.Container) {
      for (const child of obj.list) this.ignoreDeepOnWorldCamera(child);
    }
  }

  // Register a dynamically-spawned WORLD object (damage floater, dust
  // particle, level-up text, anything that lives in world space and
  // appears AFTER the end-of-create() sweep) with the UI camera's
  // ignore list. Without this, dynamic world objects render on BOTH
  // cameras — the main camera shows the FX'd version below, the UI
  // camera shows the un-FX'd version on top, so the player sees the
  // text doubled (a darker copy with the cinematic pass + a lighter
  // copy without). Wrapping every world spawn in addWorld() keeps the
  // single-render guarantee for the lifetime of the scene.
  private addWorld<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    if (this.uiCamera) this.uiCamera.ignore(obj);
    return obj;
  }

  private pinDeep(obj: Phaser.GameObjects.GameObject): void {
    const withSF = obj as unknown as { setScrollFactor?: (x: number, y?: number) => unknown };
    if (typeof withSF.setScrollFactor === "function") {
      withSF.setScrollFactor(0, 0);
    }
    if (obj instanceof Phaser.GameObjects.Container) {
      for (const child of obj.list) this.pinDeep(child);
    }
  }

  // Start the battle theme. Idempotent — guarded by battleMusicStarted
  // so it runs exactly once per battle no matter how many times it's
  // called. Called from create() on every battle (retiring the prep cue
  // at the map seam); the RESUME handler calls it again only as a
  // no-op safety net.
  private startBattleMusic(): void {
    if (this.battleMusicStarted) return;
    this.battleMusicStarted = true;
    const node = battleById(this.battleId);
    if (node) getMusic(this).play(node.music, { fadeMs: 800 });
  }

  // Right-click drag to pan. The drag origin is captured on pointerdown;
  // subsequent pointermove events translate the camera by the inverted
  // pointer delta so the world appears to slide under the cursor.
  // Phaser's setBounds clamps the scroll automatically — no need to
  // re-clamp here.
  private cameraDragState = {
    active: false,
    startScrollX: 0,
    startScrollY: 0,
    startPointerX: 0,
    startPointerY: 0
  };
  // True once the current press has moved past the drag threshold and become
  // a camera pan. Read by handlePointerUp so a release that ended a pan does
  // NOT also commit a move/attack/selection. Reset at the start of each press.
  // Persists through the camera's own pointerup (which only clears
  // cameraDragState.active) so the game's pointerup — registered later — still
  // sees it.
  private pressWasDrag = false;
  // Pixels the pointer must travel from the press origin before a hold
  // becomes a camera pan. Below this, the press is treated as a click
  // and the camera doesn't move — so a normal tile/unit click still
  // works exactly as before.
  private static readonly CAMERA_DRAG_THRESHOLD = 6;
  // True once a pointer PRESS has been seen while this scene is active.
  // Dialogue overlays advance on pointer-DOWN and the battle acts on
  // pointer-UP — so the click that closes a dialogue used to leak its
  // release into the resumed battle and, with the move overlay auto-
  // shown, walk the active unit to whatever tile sat under the cursor.
  // Requiring the press to have STARTED here swallows that phantom
  // release: no character ever moves from a click the player aimed at
  // a dialogue box.
  private pressBegunInScene = false;
  /** The current press began on the board, so dragging it pans. */
  private dragArmed = false;
  /** The blow that decided the battle — where a finale points its camera. */
  private finalBlow: { attacker: string; target: string } | null = null;
  /** Speed of the board's turn: 1 for the player's turns, slower for a finale's orbit. */
  private spinPace = 1;
  /** A finale played: the UI camera fades out with the world on the way to EndScene. */
  private finalePlayed = false;
  /** A finale has the screen: the side panel and the turn markers stop redrawing. */
  private cineActive = false;

  // Camera panning. Originally right-click-drag only, which was
  // undiscoverable — players instinctively try LEFT-click drag, get
  // nothing, and conclude the map is stuck (on a tall map like B1 that
  // strands units below the fold). Now any mouse button can pan:
  //   * Right / middle button — pans in ANY state. Never triggers a
  //     game action, so it's always safe.
  //   * Left button — pans only while the FSM is idle. During move /
  //     attack / roam targeting a left-drag would otherwise misfire
  //     the action, so left-pan is gated off in those states (right /
  //     middle drag still works there).
  // The DRAG_THRESHOLD means a stationary click never pans — click vs.
  // drag stays cleanly separated.
  private setupCameraDragPan(): void {
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      // A press that BEGINS while the battle is active arms the click
      // pipeline — see pressBegunInScene. A press on the side panel or
      // top bar is the UI's, so it neither arms the board nor pans.
      if (this.isOverUi(p)) { this.pressBegunInScene = false; this.dragArmed = false; return; }
      this.pressBegunInScene = true;
      // Once the battle has ended the camera belongs to its finale.
      this.dragArmed = !this.fsm.isEnded();
      // Record the press origin for every button. Whether this becomes
      // a pan is decided in pointermove once the pointer has actually
      // moved past the threshold.
      this.cameraDragState.active = false;
      this.pressWasDrag = false;
      this.cameraDragState.startScrollX = this.cameras.main.scrollX;
      this.cameraDragState.startScrollY = this.cameras.main.scrollY;
      this.cameraDragState.startPointerX = p.x;
      this.cameraDragState.startPointerY = p.y;
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      // Pointer deltas are in buffer pixels. The drag threshold is judged in
      // design px (/ RENDER_SCALE); the pan itself moves the world by the
      // pointer's distance at the current zoom (/ cam.zoom), so the board
      // stays under the finger whether the player has zoomed in or not.
      if (this.spin) return;
      // Only a press that began on the board pans it. A press on the side
      // panel or top bar records no origin, so measuring from the last
      // board press's (stale) origin turned the slightest wobble on End
      // Turn, Move or a portrait into a jump of the whole view — the
      // camera "shifting off-centre" as the next character was selected.
      if (!this.dragArmed || !p.isDown) return;
      const zoom = this.cameras.main.zoom;
      const dx = (p.x - this.cameraDragState.startPointerX) / zoom;
      const dy = (p.y - this.cameraDragState.startPointerY) / zoom;
      if (!this.cameraDragState.active) {
        const tx = (p.x - this.cameraDragState.startPointerX) / RENDER_SCALE;
        const ty = (p.y - this.cameraDragState.startPointerY) / RENDER_SCALE;
        const movedEnough =
          Math.abs(tx) > BattleScene.CAMERA_DRAG_THRESHOLD ||
          Math.abs(ty) > BattleScene.CAMERA_DRAG_THRESHOLD;
        if (!movedEnough) return;
        // Left-drag now pans in EVERY player state, not just idle. With
        // click-to-move, a move commits on pointer-UP (handlePointerUp), so a
        // left-drag past the threshold can be treated as a pan without
        // misfiring the move — pressWasDrag tells pointerup to skip the
        // action. Right/middle still pan unconditionally.
        const rightOrMiddle = p.rightButtonDown() || p.middleButtonDown();
        const left = p.leftButtonDown();
        if (!rightOrMiddle && !left) return;
        this.cameraDragState.active = true;
        this.pressWasDrag = true;
      }
      this.cameras.main.setScroll(
        this.cameraDragState.startScrollX - dx,
        this.cameraDragState.startScrollY - dy
      );
    });
    this.input.on("pointerup", () => {
      this.cameraDragState.active = false;
      this.dragArmed = false;
    });
  }

  // Arrow keys + WASD nudge the camera. Useful for keyboard players and
  // for fine adjustments that mouse drag overshoots. Step is per-frame,
  // not per-keypress, so holding produces continuous pan.
  private setupCameraKeyboardPan(): void {
    const keys = this.input.keyboard?.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.UP,
      down: Phaser.Input.Keyboard.KeyCodes.DOWN,
      left: Phaser.Input.Keyboard.KeyCodes.LEFT,
      right: Phaser.Input.Keyboard.KeyCodes.RIGHT,
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D
    }) as { [k: string]: Phaser.Input.Keyboard.Key } | undefined;
    if (!keys) return;
    const STEP = 8; // px per frame at 60fps ≈ 480px/s
    const pan = (): void => {
      if (this.fsm.isEnded()) return;
      const cam = this.cameras.main;
      let dx = 0, dy = 0;
      if (keys.left.isDown || keys.a.isDown) dx -= STEP;
      if (keys.right.isDown || keys.d.isDown) dx += STEP;
      if (keys.up.isDown || keys.w.isDown) dy -= STEP;
      if (keys.down.isDown || keys.s.isDown) dy += STEP;
      if (dx !== 0 || dy !== 0) {
        cam.setScroll(cam.scrollX + dx, cam.scrollY + dy);
        this.hoverPreview.setVisible(false);
      }
    };
    this.events.on(Phaser.Scenes.Events.UPDATE, pan);
    // Off at shutdown: scene events outlive it (see the resume handler).
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.events.off(Phaser.Scenes.Events.UPDATE, pan));
  }

  private lastActorFaction: Unit["faction"] | null = null;
  // Player units lost in THIS battle — passed to GameOverScene so a
  // chapter restart can refund them.
  private lastBattleDeaths = 0;

  // Couple the global tween + timer scale to the fast-forward toggle. Only
  // boosts during enemy turns so the player's own animations stay at the
  // designed pace; falls back to 1× the moment control returns.
  private applyTurnSpeed(): void {
    const u = this.initiative.current();
    const isEnemyActing = !!u && u.faction !== "player" && u.faction !== "ally";
    const scale = this.fastForward && isEnemyActing ? 2 : 1;
    this.tweens.timeScale = scale;
    this.time.timeScale = scale;
  }

  private showPhaseBanner(faction: Unit["faction"], onDone: () => void): void {
    if (this.phaseBanner) {
      this.phaseBanner.destroy();
      this.phaseBanner = undefined;
    }
    const isPlayer = faction === "player" || faction === "ally";
    const label = isPlayer ? "PLAYER PHASE" : "ENEMY PHASE";
    const accent = isPlayer ? "#f4d999" : "#d05a4a";
    const stroke = isPlayer ? "#1a0e04" : "#1a0404";
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.55);
    bg.fillRect(0, GAME_HEIGHT / 2 - 50, GAME_WIDTH, 100);
    const txt = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT / 2, label, {
      fontFamily: FAMILY_HEADING,
      fontSize: "56px",
      color: accent,
      stroke,
      strokeThickness: 6
    }).setOrigin(0.5);
    const banner = this.add.container(0, 0, [bg, txt]);
    banner.setDepth(1000);
    banner.setAlpha(0);
    this.pin(banner); // phase banner is full-screen UI, not world
    this.phaseBanner = banner;
    this.tweens.add({
      targets: banner,
      alpha: 1,
      duration: 180,
      yoyo: true,
      hold: 450,
      onComplete: () => {
        banner.destroy();
        if (this.phaseBanner === banner) this.phaseBanner = undefined;
        onDone();
      }
    });
  }

  // Cheap per-frame variant: just reposition the existing ring/arrow without
  // tearing down and recreating their pulsing tweens. Used during animateMove.
  private followActiveMarker(u: Unit): void {
    const view = this.unitViews.get(u.id);
    if (!view || !isAlive(u)) return;
    const px = view.sprite.x;
    const py = view.sprite.y;
    const ringY = py + TILE_SIZE / 2 - 3;
    this.activeRing.clear();
    const ringColor = u.faction === "player" ? 0x6db2ff : 0xff7a4d;
    this.activeRing.lineStyle(2, ringColor, 0.95);
    this.activeRing.strokeEllipse(px, ringY, TILE_SIZE - 6, 10);
    this.activeRing.lineStyle(1, 0xffffff, 0.6);
    this.activeRing.strokeEllipse(px, ringY, TILE_SIZE - 12, 6);
    // The arrow's bob tween animates its y; offset by the sprite delta only.
    this.activeArrow.x = px;
  }

  private drawActiveMarker(u: Unit): void {
    if (this.cineActive) {
      this.activeRing.clear().setVisible(false);
      this.activeArrow.setVisible(false);
      return;
    }
    const view = this.unitViews.get(u.id);
    this.activeRing.clear();
    if (this.activeRingTween) { this.activeRingTween.stop(); this.activeRingTween = undefined; }
    if (this.activeArrowTween) { this.activeArrowTween.stop(); this.activeArrowTween = undefined; }
    if (!view || !isAlive(u)) {
      this.activeArrow.setVisible(false);
      return;
    }
    const px = view.sprite.x;
    const py = view.sprite.y;
    const ringColor = u.faction === "player" ? 0x6db2ff : 0xff7a4d;
    const ringY = py + TILE_SIZE / 2 - 3;
    this.activeRing.lineStyle(2, ringColor, 0.95);
    this.activeRing.strokeEllipse(px, ringY, TILE_SIZE - 6, 10);
    this.activeRing.lineStyle(1, 0xffffff, 0.6);
    this.activeRing.strokeEllipse(px, ringY, TILE_SIZE - 12, 6);
    this.activeRingTween = this.tweens.add({
      targets: this.activeRing,
      alpha: { from: 1, to: 0.45 },
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
    this.activeArrow.setColor(u.faction === "player" ? "#ffd45a" : "#ff8a8a");
    this.activeArrow.setPosition(px, py - this.unitH / 2 - 1);
    this.activeArrow.setVisible(true);
    this.activeArrowTween = this.tweens.add({
      targets: this.activeArrow,
      y: py - this.unitH / 2 + 5,
      duration: 480,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut"
    });
  }

  // Circular headshot crop of the unit's neutral portrait, anchored to the
  // top-left of the side panel. Skips silently if the portrait file isn't
  // loaded — rank-and-file units without portraits just get no avatar.
  private setSidePanelAvatar(u: Unit): void {
    this.avatarImg?.destroy();
    this.avatarMaskG?.destroy();
    this.avatarRing?.destroy();
    this.avatarImg = undefined;
    this.avatarMaskG = undefined;
    this.avatarRing = undefined;

    // Prefer an explicit portraitId override; fall back to the unit's own id.
    // This lets stat-profile aliases (e.g., amar_true → amar) share artwork.
    const key = `portrait:${u.portraitId ?? u.id}`;
    if (!hasAsset(key) || !this.textures.exists(key)) return;

    const size = 96;
    const px = GAME_WIDTH - PANEL_W;
    const cx = px + PANEL_W / 2 - 12; // centered in panel content area (matches header text)
    const cy = 102 + size / 2;        // top y = 102 (just below the ribbon at 82–96)

    // Pre-crop the portrait to a circular canvas texture ONCE per
    // portrait id, then use that as the avatar image. Earlier
    // version used a runtime geometry mask to crop the portrait to
    // a circle — but the mask graphics wasn't camera-scroll aware
    // and the avatar image was pinned via setScrollFactor(0). When
    // the camera scrolled (after the per-battle camera-centering
    // fix landed), the mask scrolled away from the pinned avatar
    // and the circle came back empty.
    //
    // Same pattern that fixed RosterScene's scroll-breaks-portraits
    // bug. Pre-cropping bakes the cover-fit + circular crop into
    // the texture itself; the avatar is then a simple Image with
    // no runtime mask, no container/camera transform issues, and
    // strictly cheaper rendering.
    const cropKey = `battle_avatar_crop:${u.portraitId ?? u.id}`;
    if (!this.textures.exists(cropKey)) {
      const cropTex = this.textures.createCanvas(cropKey, size, size);
      if (cropTex) {
        const ctx = cropTex.getContext();
        const src = this.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
        const srcW = src.width || 1024;
        const srcH = src.height || 1536;
        // Cover-fit at 1.5× the circle width so the head fits with
        // some headroom, then anchor so the face midline (~24% down
        // from the top of source) lands at the canvas's vertical
        // center. Same math the runtime-mask version used.
        const displayW = size * 1.5;
        const displayH = displayW * (srcH / srcW);
        const dx = (size - displayW) / 2;
        const dy = size / 2 - displayH * 0.24;
        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(src, dx, dy, displayW, displayH);
        ctx.restore();
        cropTex.refresh();
      }
    }
    const img = this.add.image(cx, cy, cropKey).setOrigin(0.5).setDepth(2);

    const ring = this.add.graphics().setDepth(3);
    ring.lineStyle(2, COLORS.gold, 0.92);
    ring.strokeCircle(cx, cy, size / 2 + 1);
    ring.lineStyle(1, 0x000000, 0.5);
    ring.strokeCircle(cx, cy, size / 2 + 3);

    // Pin avatar + ring so they stay anchored to the side panel when
    // the camera pans. No mask graphics anymore — the crop is baked
    // into the texture, no per-frame mask state to keep in sync.
    this.pin(img);
    this.pin(ring);
    this.avatarImg = img;
    this.avatarRing = ring;
  }

  private refreshSidePanel(u: Unit): void {
    // During a finale the panel is gone; redrawing it would bring its
    // avatar back (it is made fresh on every refresh).
    if (this.cineActive) return;
    this.setSidePanelAvatar(u);
    // Compress LV (and XP-toward-next-level for players) into the apText
    // one-liner so the stat block below stays at 7-row max. Adding LV as
    // its own stat row pushed an 8th row into the ACTIONS header below.
    // Format kept short so it stays single-line at panelTextW = 256px:
    //   player non-cap: "LV 3 · 45 XP · AP 3/3 · PLAYER"  (~28 chars)
    //   player at cap:  "LV 20 · MAX · AP 3/3 · PLAYER"
    //   enemy:          "LV 7 · AP 3/3 · ENEMY"
    const xpSuffix = u.faction === "player"
      ? (u.level >= 20 ? "  ·  MAX" : `  ·  ${u.state.xp} XP`)
      : "";
    this.apText.setText(
      `LV ${u.level}${xpSuffix}  ·  AP ${u.state.apRemaining}/${effectiveMaxAp(u)}  ·  ${u.faction.toUpperCase()}`
    );
    const mov = effectiveMovement(u);
    const movStr = mov !== u.stats.movement ? `${u.stats.movement}+${mov - u.stats.movement}` : `${u.stats.movement}`;
    const lines = [
      `HP   ${u.state.hp}/${u.stats.hp}`,
      `PWR  ${u.stats.power}    ARM  ${u.stats.armor}`,
      `SPD  ${u.stats.speed}    MOV  ${movStr}`,
      `WPN  ${u.weapon}`,
      `STN  ${u.state.stance}`
    ];
    // Index of the WPN row in `lines` above. Restored to 3 when LV moved
    // out of the stat block and into apText; the hover zone for the
    // weapon tooltip needs to track this index.
    const wpnIdx = 3;
    let ablIdx = -1;
    if (u.abilities && u.abilities.length > 0) {
      ablIdx = lines.length;
      // Comma WITHOUT a trailing space: the worst case ("BossFighter,
      // Aide, Destruct, Roam") is 39 chars with spaces and wraps the
      // 256px column — and a wrapped row both collides with the ACTIONS
      // header and breaks the lineH math that positions the hover zones
      // below. 35 chars compact stays single-line.
      lines.push(`ABL  ${u.abilities.join(",")}`);
    }
    // Inventory + equipment summary. Renders the carried items with
    // their glyphs (so the player can scan at a glance which character
    // has the Royal Lens vs the Mask), then a single EQ line summing
    // the active passive bonuses. Both rows skipped when the bag is
    // empty.
    let invIdx = -1;
    if (u.state.inventory.length > 0) {
      // Tally by kind so "🧪 Potion ×3" reads more cleanly than three
      // identical lines. Iteration preserves first-seen order which
      // matches drop / assignment order in practice.
      const counts: Record<string, { glyph: string; name: string; count: number }> = {};
      for (const it of u.state.inventory) {
        const key = it.kind;
        if (counts[key]) counts[key]!.count += 1;
        else counts[key] = { glyph: ITEM_CATALOG[it.kind].glyph, name: ITEM_CATALOG[it.kind].name, count: 1 };
      }
      const invStr = Object.values(counts)
        .map((c) => `${c.glyph}${c.count > 1 ? `×${c.count}` : ""}`)
        .join(" ");
      invIdx = lines.length;
      lines.push(`INV  ${invStr}`);
      // Sum the equipment passives — only render the row when there's
      // something non-zero to report, so a unit carrying just two
      // potions doesn't get a misleading "EQ +0%" line.
      // Compact two-letter tokens: the long form ("+2 MOV, +50% CRIT,
      // +75% HIT, +1 AP, -4 ARM" = 47 chars) wraps the 256px column at a
      // full equipment load, colliding with the ACTIONS header and
      // desyncing the tooltip hover zones. Worst case compact = 34 chars.
      const eq = equipmentBonuses(u);
      const eqParts: string[] = [];
      if (eq.movement) eqParts.push(`+${eq.movement}MV`);
      if (eq.critPct) eqParts.push(`+${eq.critPct}%CR`);
      if (eq.hitPct) eqParts.push(`+${eq.hitPct}%HT`);
      if (eq.apBonus) eqParts.push(`+${eq.apBonus}AP`);
      if (eq.armorPenalty) eqParts.push(`-${eq.armorPenalty}AR`);
      if (eqParts.length > 0) lines.push(`EQ   ${eqParts.join(" ")}`);
    }
    this.statText.setText(lines.join("\n"));
    this.panelUnit = u;
    // Position the hover zones over the WPN, ABL, and INV rows. Use the
    // measured height per line so we stay pixel-aligned regardless of font.
    const lineH = lines.length > 0 ? this.statText.height / lines.length : 17;
    const panelTextW = PANEL_W - 24;
    const sx = this.statText.x;
    const sy = this.statText.y;
    this.wpnZone.setPosition(sx, sy + wpnIdx * lineH).setSize(panelTextW, lineH);
    this.wpnZone.setInteractive();
    if (ablIdx >= 0) {
      this.ablZone.setPosition(sx, sy + ablIdx * lineH).setSize(panelTextW, lineH);
      this.ablZone.setInteractive();
    } else {
      this.ablZone.disableInteractive();
    }
    if (invIdx >= 0) {
      this.invZone.setPosition(sx, sy + invIdx * lineH).setSize(panelTextW, lineH);
      this.invZone.setInteractive();
    } else {
      this.invZone.disableInteractive();
    }
    // Hide the tooltip on every panel refresh — pointerover from the new
    // zones will re-show it. Without this, switching units mid-hover
    // could leave a stale tooltip pinned to the screen.
    this.infoTooltip.setVisible(false);
    this.refreshActiveRibbon(u);
  }

  // Shows the info tooltip anchored to the LEFT of the side panel, aligned
  // with whichever row the player is hovering. Content comes from the static
  // WEAPON_INFO / ABILITY_INFO tables at the top of this file, or — for
  // inventory — the item descriptions in ITEM_CATALOG (src/combat/items.ts).
  private showInfoFor(kind: "weapon" | "ability" | "inventory"): void {
    const u = this.panelUnit;
    if (!u) return;
    const title = this.infoTooltip.getData("title") as Phaser.GameObjects.Text;
    const body = this.infoTooltip.getData("body") as Phaser.GameObjects.Text;
    const bg = this.infoTooltip.getData("bg") as Phaser.GameObjects.Graphics;
    if (kind === "weapon") {
      const info = WEAPON_INFO[u.weapon];
      if (!info) return;
      title.setText(info.title);
      body.setText(info.body);
    } else if (kind === "ability") {
      if (!u.abilities || u.abilities.length === 0) return;
      const blocks = u.abilities
        .map((a) => ABILITY_INFO[a])
        .filter((info): info is { title: string; body: string } => Boolean(info))
        .map((info) => `${info.title}\n${info.body}`);
      title.setText(u.abilities.length === 1 ? (ABILITY_INFO[u.abilities[0]!]?.title ?? "Ability") : "Abilities");
      body.setText(blocks.join("\n\n"));
    } else {
      // Inventory: tally by kind and render one block per kind with its
      // description from ITEM_CATALOG. Stack count surfaces as " ×N"
      // after the item name so the player understands their build at a
      // glance ("Fang ×2 — +20% crit total" reads as one thought).
      if (u.state.inventory.length === 0) return;
      const counts: Record<string, number> = {};
      for (const it of u.state.inventory) counts[it.kind] = (counts[it.kind] ?? 0) + 1;
      const blocks: string[] = [];
      for (const k of Object.keys(counts)) {
        const meta = ITEM_CATALOG[k as keyof typeof ITEM_CATALOG];
        const n = counts[k]!;
        const header = `${meta.glyph} ${meta.name}${n > 1 ? ` ×${n}` : ""}`;
        blocks.push(`${header}\n${meta.description}`);
      }
      title.setText(u.state.inventory.length === 1 ? "Inventory" : `Inventory (${u.state.inventory.length}/5)`);
      body.setText(blocks.join("\n\n"));
    }
    // Resize the background to fit the text dynamically — multi-ability blocks
    // can be tall, single-line tooltips can be short.
    const padX = 12;
    const padY = 8;
    const gap = 6;
    const w = 280;
    const h = padY + title.height + gap + body.height + padY;
    bg.clear();
    bg.fillStyle(0x05060a, 0.96);
    bg.fillRect(0, 0, w, h);
    bg.lineStyle(1, COLORS.gold, 0.8);
    bg.strokeRect(0.5, 0.5, w - 1, h - 1);
    void padX;
    // Anchor: open to the LEFT of the panel, vertically centred on the
    // hovered row (clamped to the visible play area).
    const zone = kind === "weapon" ? this.wpnZone : kind === "ability" ? this.ablZone : this.invZone;
    const zy = zone.y + zone.height / 2 - h / 2;
    const x = (GAME_WIDTH - PANEL_W) - w - 12;
    const y = Phaser.Math.Clamp(zy, 80, GAME_HEIGHT - h - 12);
    this.infoTooltip.setPosition(x, y).setVisible(true);
  }

  // The ribbon at the top of the side panel: "▶ ACTIVE TURN" when the panel
  // shows the unit whose turn it currently is, or "○ INSPECTING" when the
  // player is peeking at a different unit.
  private refreshActiveRibbon(panelUnit: Unit): void {
    this.activeRibbon.clear();
    const cur = this.initiative.current();
    const isActive = cur ? cur.id === panelUnit.id : false;
    const px = GAME_WIDTH - PANEL_W;
    const w = PANEL_W - 24;
    const h = 14;
    if (isActive) {
      const isPlayer = panelUnit.faction === "player" || panelUnit.faction === "ally";
      const fill = isPlayer ? 0xf4d999 : 0xd05a4a;
      this.activeRibbon.fillStyle(fill, 0.95);
      this.activeRibbon.fillRect(px - 4, 82, w, h);
      this.activeRibbonText.setText(isPlayer ? "\u25B6 ACTIVE TURN" : "\u25B6 ENEMY TURN");
      this.activeRibbonText.setColor("#0a0c12");
      this.activeRibbonText.setVisible(true);
    } else {
      this.activeRibbon.fillStyle(0x2b2418, 0.9);
      this.activeRibbon.fillRect(px - 4, 82, w, h);
      this.activeRibbonText.setText("\u25CB INSPECTING");
      this.activeRibbonText.setColor("#c9b07a");
      this.activeRibbonText.setVisible(true);
    }
  }

  private endCurrentTurn(): void {
    // atCursor, NOT current(): current() skips dead units by advancing
    // the cursor. If the actor died during its own turn (a counter kill,
    // a Destruct trade), current() would return the NEXT unit in the
    // queue — and the endUnitTurn + advance pair below would zero that
    // innocent unit's AP, mark it acted, and step past its slot. One
    // death upstream silently ate a teammate's whole turn.
    const cur = this.initiative.atCursor();
    if (cur && isAlive(cur)) endUnitTurn(cur);
    this.clearActionButtons();
    this.clearOverlays();
    // Advance BEFORE evaluating victory so round-based conditions
    // (surviveRounds, protectUnit) see the new round counter on the same
    // tick the player crosses the threshold. The rout/defeat-unit checks
    // are state-only and don't care about ordering.
    const roundBefore = this.initiative.round;
    this.initiative.advancePastCurrent(this.state.units);
    // Round wrapped — land any reinforcement wave scheduled for the new
    // round BEFORE victory evaluation, so a rout-style condition can't
    // declare an empty-field win a tick ahead of the wave.
    if (this.initiative.round !== roundBefore) this.spawnReinforcements();
    if (this.checkEnd()) return;
    this.beginCurrentTurn();
  }

  private checkEnd(): boolean {
    // Catch a second wind triggered by any damage path that doesn't run
    // through applyAttackEffects. Idempotent, so the common case (the
    // scan already ran there) costs one Set lookup per unit.
    this.stageSecondWinds();
    const v = this.victory.evaluate({ state: this.state, round: this.initiative.round });
    if (!v) return false;
    this.fsm.send({ tag: "BATTLE_END" });
    if (v === "player") sfxVictory();
    else sfxDefeat();
    let save = loadSave();
    // Count player-faction deaths from THIS battle (used by both the
    // game-over routing below and shown in the post-battle EndScene).
    // Counted only on victory — a defeat sends the player back through
    // BattlePrep and the dead unit is alive again next attempt, so
    // pre-victory deaths shouldn't accumulate against the campaign budget.
    const playerDeathsThisBattle = v === "player"
      ? this.state.units.filter((u) => u.faction === "player" && !isAlive(u)).length
      : 0;
    if (v === "player") {
      save = completeBattle(save, this.battleId);
      // Unlock what this battle unlocks. node.unlocks: undefined → the
      // next battle in the array (linear spine); BattleId → explicit
      // target (path structure — the seven B19 variants are array-
      // adjacent, so "next in array" would unlock a different path's
      // opener); null → nothing (endings, choice-owned routing).
      const node = battleById(this.battleId);
      if (node?.unlocks) {
        save = unlockBattle(save, node.unlocks);
      } else if (node?.unlocks === undefined) {
        const nodeIdx = BATTLES.findIndex((b) => b.id === this.battleId);
        if (nodeIdx >= 0 && nodeIdx + 1 < BATTLES.length) {
          save = unlockBattle(save, BATTLES[nodeIdx + 1]!.id);
        }
      }
      save = recordSquadDeaths(save, playerDeathsThisBattle);
      // Remembered for GameOverScene's chapter restart, which refunds them.
      this.lastBattleDeaths = playerDeathsThisBattle;
      save = { ...save, lastBattleResult: { id: this.battleId, outcome: "victory" } };
    } else {
      save = { ...save, lastBattleResult: { id: this.battleId, outcome: "defeat" } };
    }
    // Persist player progression — every player unit's level, xp, and
    // current stats (incl. accumulated growth gains) and any post-promotion
    // class/abilities. We snapshot on BOTH victory and defeat so the player
    // doesn't lose XP earned mid-fight just because the squad wiped at the
    // end. Catch-up rolls applied at battle start are also persisted, so
    // veterans only catch up once.
    for (const u of this.state.units) {
      if (u.faction !== "player") continue;
      save = setCharacterRecord(save, u.id, {
        level: u.level,
        xp: u.state.xp,
        stats: { ...u.stats },
        ...(u.classKind ? { classKind: u.classKind } : {}),
        ...(u.abilities ? { abilities: [...u.abilities] } : {}),
        ...(u.spriteClassOverride ? { spriteClassOverride: u.spriteClassOverride } : {})
      });
    }
    writeSave(save);
    // Battle rewards (victory only). Mint each ItemKind in the node's
    // rewards array as a fresh Item and drop it directly into the
    // squad pool. Done BEFORE reconcilePostBattleInventory so a
    // single writeSave from there captures both. EndScene reads the
    // same rewards array off the node to render the "Spoils" line —
    // no need to plumb the actual Item ids through the scene
    // transition.
    if (v === "player") {
      const node = battleById(this.battleId);
      if (node?.rewards && node.rewards.length > 0) {
        const reloaded = loadSave();
        const pool = getSquadInventory(reloaded);
        for (const kind of node.rewards) pool.push(createItem(kind));
        writeSave(setSquadInventory(reloaded, pool));
      }
    }
    // Per-character inventory reconciliation. Items consumed in
    // battle (potions used, elixirs drunk) are simply absent from
    // each character's live inventory so they don't survive — they're
    // permanently gone. Surviving items STAY in each character's
    // assignedInventory across battles, so a player who gave Maya the
    // Royal Lens doesn't have to re-give it next battle.
    //
    // Fallen characters' items go back to the squad pool (the squad
    // salvages off the body). Runs on BOTH victory and defeat. Full
    // behavior + edge cases documented at reconcilePostBattleInventory.
    reconcilePostBattleInventory(this.state.units);
    // Freeze progression at the Seven Paths fork. Deliberately the LAST
    // thing that touches the save on B18: the character-record loop
    // above has run (so levels are the ones leaving B18, not entering
    // it), B18's rewards have been minted into the pool, and
    // reconcilePostBattleInventory has settled every bag. Capturing any
    // earlier — as this used to — snapshotted a squad that had not yet
    // been paid its spoils. An another-path run restores exactly this.
    if (v === "player" && this.battleId === PATH_FORK_BATTLE) {
      writeSave(capturePathForkSnapshot(loadSave()));
    }
    // Analytics — capture outcome + duration so we can see pacing issues
    // (e.g., a battle averaging 12+ rounds is probably overlong).
    trackBattleCompleted(this.battleId, v === "player" ? "victory" : "defeat", this.initiative.round);

    // before_victory dialogue check — fires after the victory condition
    // resolves to "player" but before the EndScene transition. Used for
    // B1's capture beat (mechanical victory, narrative defeat). The
    // dialogue plays out as a paused overlay; on resume we complete the
    // transition. If no before_victory dialogue is queued, transition
    // immediately as before.
    if (v === "player") {
      const beforeVictory = this.dialogue.findBeforeVictory();
      if (beforeVictory) {
        this.events.once(Phaser.Scenes.Events.RESUME, () => {
          this.endBattle(v);
        });
        this.dialogue.fire(beforeVictory);
        return true;
      }
    }
    this.endBattle(v);
    return true;
  }

  // The last two chapters of every road close on a finale — a short
  // cut-scene on the board (scenes/battle/Finale.ts) — before the fade to
  // the victory screen. Not on the way to a game over.
  private endBattle(v: "player" | "enemy"): void {
    const save = loadSave();
    const script = v === "player" && !hasExceededDeathLimit(save) ? finaleFor(this.battleId, getSevenPath(save)) : null;
    if (!script) { this.transitionToEndScene(v); return; }
    void (async () => {
      // Let the last fall finish before the camera goes to it.
      for (let t = 0; t < 1600 && [...this.unitViews.values()].some((x) => x.animLock === "dying"); t += 50) {
        await this.delay(50);
      }
      this.finalePlayed = true;
      try {
        await playFinale(this.finaleHost(), script);
      } catch (e) {
        // A finale must never strand the player on a won board.
        console.error("[finale]", e);
      }
      if (this.scene.isActive()) this.transitionToEndScene(v);
    })();
  }

  private finaleHost(): FinaleHost {
    const cam = this.cameras.main;
    const hideMarks = (): void => {
      for (const v of this.unitViews.values()) {
        v.hpBg.setVisible(false);
        v.hpBar.setVisible(false);
        v.stanceIcon.setVisible(false);
      }
      for (const h of [this.overlayG, this.contourG, this.dangerG, this.threatG, this.cursorG, this.pathG, this.activeRing, this.activeArrow]) h.setVisible(false);
      this.clearXray();
      this.hoverPreview.setVisible(false);
      this.rimUnitId = null;
    };
    return {
      scene: this,
      webgl: this.game.renderer.type === Phaser.WEBGL,
      finalBlow: this.finalBlow,
      unitPoint: (id: string): Pt | null => {
        const v = this.unitViews.get(id);
        if (v && isAlive(v.unit) && v.sprite.visible) return bodyCentre(v.sprite);
        const u = this.state.units.find((x) => x.id === id);
        if (!u) return null;
        const p = this.projection.tileToWorld(u.state.position);
        return { x: p.x, y: p.y + this.unitLift };
      },
      living: (f) => this.state.units.filter((u) => u.faction === f && isAlive(u)).map((u) => u.id),
      boardCentre: () => {
        const c = this.layouts[this.viewRotation]?.centre;
        return c ? { x: c.x, y: c.y } : this.screenToWorld(cam.width / 2, cam.height / 2);
      },
      focus: (p, zoom, ms) => new Promise<void>((res) => {
        // The finale's camera is free of the board's scroll range, and
        // centres on the whole screen (the side panel is gone).
        cam.removeBounds();
        const mid = { x: cam.width / 2, y: cam.height / 2 };
        const z0 = this.zoomFactor;
        const from = this.screenToWorld(mid.x, mid.y);
        this.tweens.addCounter({
          from: 0, to: 1, duration: ms, ease: "Sine.easeInOut",
          onUpdate: (tw) => {
            const e = tw.getValue() ?? 1;
            this.zoomFactor = z0 + (zoom - z0) * e;
            cam.setZoom(this.baseZoom * this.zoomFactor);
            const want = { x: from.x + (p.x - from.x) * e, y: from.y + (p.y - from.y) * e };
            const under = this.screenToWorld(mid.x, mid.y);
            cam.setScroll(cam.scrollX + want.x - under.x, cam.scrollY + want.y - under.y);
          },
          onComplete: () => res()
        });
      }),
      orbit: (quarters, pace) => new Promise<void>((res) => {
        if (this.spin || quarters === 0) { res(); return; }
        this.spinPace = pace;
        const Q = Math.PI / 2;
        this.startSpin(quarters > 0 ? 1 : -1, this.viewRotation * Q + quarters * Q, true);
        const landed = (): void => {
          if (this.spin || this.spinSettle) { this.time.delayedCall(40, landed); return; }
          this.spinPace = 1;
          // The turn rebuilt the board and its marks, and boxed the camera
          // back into the board's range.
          cam.removeBounds();
          hideMarks();
          res();
        };
        this.time.delayedCall(40, landed);
      }),
      hideUi: (ms) => {
        this.cineActive = true;
        hideMarks();
        const ui = this.uiObjects.filter((o) => o.active && typeof (o as unknown as { alpha?: number }).alpha === "number");
        this.tweens.add({ targets: ui, alpha: 0, duration: ms });
      },
      hop: (id, height, times) => new Promise<void>((res) => {
        const v = this.unitViews.get(id);
        if (!v || !isAlive(v.unit)) { res(); return; }
        this.stopBreathing(v);
        this.tweens.add({
          targets: v.sprite, y: v.baseY - height, duration: 140, yoyo: true, repeat: times - 1, ease: "Sine.easeOut",
          onComplete: () => { this.startBreathing(v); res(); }
        });
      }),
      worldToUi: (x, y) => {
        const src = { x: (x - cam.scrollX) * cam.zoom, y: (y - cam.scrollY) * cam.zoom };
        const scr = this.keystone ? sourceToScreen(src.x, src.y, cam.width, cam.height, this.keystone) : src;
        return { x: scr.x / RENDER_SCALE, y: scr.y / RENDER_SCALE };
      },
      world: (o) => this.addWorld(o),
      ui: (o) => { this.ignoreDeepOnWorldCamera(o); return o; },
      groundSquash: () => this.groundSquash()
    };
  }

  // Extracted from the tail of checkEnd so the EndScene transition can
  // either fire immediately (no before_victory dialogue) or be deferred
  // until after a before_victory dialogue closes.
  //
  // After a victory, also check whether the campaign-wide death budget
  // has been exceeded — if so, route to GameOverScene instead of the
  // normal post-battle flow. The save was already updated upstream in
  // checkEnd, so loading here returns the post-battle squadDeaths total.
  // Capture the live board into the save's suspend slot. Runs at every
  // turn boundary; cleared by transitionToEndScene when the battle
  // resolves. See src/combat/Suspend.ts for the snapshot shape.
  //
  // Split into a synchronous CAPTURE and a deferred WRITE. The capture
  // (plain object building) is cheap and must happen at the turn
  // boundary while the state is coherent. The write is the expensive
  // half — loadSave's JSON.parse, a full-save stringify, two
  // localStorage.setItems, and the remote push — and it used to run
  // synchronously on the exact frame a new turn (often an enemy move
  // animation) was starting. On slow storage that's a per-turn hitch.
  // requestIdleCallback slides it into frame slack; the timeout bounds
  // staleness, and shutdown/end-scene paths flush or cancel explicitly.
  private pendingSuspend?: Parameters<typeof writeSuspendedBattle>[0];
  private suspendFlushScheduled = false;
  private writeSuspend(): void {
    if (this.fsm.isEnded()) return;
    this.pendingSuspend = {
      battleId: this.battleId,
      savedAt: new Date().toISOString(),
      units: this.state.units.map(serializeUnit),
      initiative: this.initiative.serialize(),
      dialogue: this.dialogue.serialize()
    };
    if (this.suspendFlushScheduled) return; // latest capture wins at flush
    this.suspendFlushScheduled = true;
    const flush = () => {
      this.suspendFlushScheduled = false;
      this.flushSuspend();
    };
    if (typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(flush, { timeout: 400 });
    } else {
      window.setTimeout(flush, 150);
    }
  }

  // Write whatever capture is pending, now. Called by the idle flush,
  // and directly by scene shutdown (warping away mid-battle must not
  // lose the last turn boundary).
  private flushSuspend(): void {
    if (!this.pendingSuspend) return;
    const snap = this.pendingSuspend;
    this.pendingSuspend = undefined;
    writeSuspendedBattle(snap);
  }

  private transitionToEndScene(v: "player" | "enemy"): void {
    // Battle resolved — the suspend snapshot is now stale history.
    // Drop any capture still waiting on the idle flush FIRST, or the
    // deferred write would resurrect the suspend we're about to clear
    // and EndScene's "resume battle?" would offer a finished fight.
    this.pendingSuspend = undefined;
    clearSuspendedBattle();
    getMusic(this).stop(650);
    this.cameras.main.fadeOut(700, 0, 0, 0);
    // After a finale the screen is its letterbox and closing card: those
    // go to black with the board.
    if (this.finalePlayed) this.uiCamera?.fadeOut(700, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      if (v === "player" && hasExceededDeathLimit(loadSave())) {
        this.scene.start("GameOverScene", { battleId: this.battleId, deathsThisBattle: this.lastBattleDeaths });
        return;
      }
      this.scene.start("EndScene", { battleId: this.battleId, outcome: v });
    });
  }

  // ---- Action buttons ----
  // Wounded living allies within reach of a Mend (Manhattan 1).
  private mendTargetsFor(u: Unit): Unit[] {
    return this.state.units.filter((t) =>
      t.faction === u.faction &&
      t.id !== u.id &&
      isAlive(t) &&
      t.state.hp < t.stats.hp &&
      Math.abs(t.state.position.x - u.state.position.x) + Math.abs(t.state.position.y - u.state.position.y) === 1
    );
  }

  // Mend: heal the most-wounded adjacent ally for 40% of their max HP.
  // Costs 1 AP and pays the mender 20 XP — deliberately close to a mook
  // kill (30), because the whole point of the ability is that a slow
  // shield veteran can level by keeping people standing.
  private static readonly MEND_FRACTION = 0.4;
  private static readonly MEND_XP = 20;
  private performMend(u: Unit): void {
    const targets = this.mendTargetsFor(u);
    if (targets.length === 0 || u.state.apRemaining < 1) return;
    // Most-wounded first, by missing fraction.
    targets.sort((a, b) => (a.state.hp / a.stats.hp) - (b.state.hp / b.stats.hp));
    const target = targets[0]!;
    const amount = Math.min(
      target.stats.hp - target.state.hp,
      Math.max(1, Math.round(target.stats.hp * BattleScene.MEND_FRACTION))
    );
    target.state.hp += amount;
    u.state.apRemaining -= 1;
    sfxConfirm();
    const px = this.projection.tileToWorld(target.state.position);
    this.spawnDamageNumber(px.x, px.y, `+${amount}`, 0x6fe08a);
    this.pushLog(`${u.name} mends ${target.name} for ${amount}.`);
    this.refreshUnitView(target);
    const { totalAwarded, levelUps } = awardXp(u, BattleScene.MEND_XP);
    if (totalAwarded > 0) {
      this.pushLog(`${u.name} gains ${totalAwarded} XP.`);
      this.announceXpGain(u, totalAwarded);
    }
    for (const lu of levelUps) this.announceLevelUp(u, lu);
    this.clearActionButtons();
    if (u.state.apRemaining > 0) this.buildActionButtons(u);
    else this.endCurrentTurn();
  }

  private clearActionButtons(): void {
    for (const b of this.actionButtons) b.destroy();
    this.actionButtons = [];
    // The item picker is anchored over the action button column; if the
    // buttons are gone, the picker has nothing to refer back to. Tear it
    // down here so a stale picker can't survive a turn end / cancel /
    // mode switch.
    this.closeItemPicker();
  }

  private buildActionButtons(u: Unit): void {
    const px = GAME_WIDTH - PANEL_W;
    const top = 438;             // sits just under the ACTIONS label at y=420
    const fullW = 256;           // panel inner width usable for buttons
    const colW = 126;            // two columns with a small gap
    const colGap = 4;
    const h = 30;
    const rowGap = 4;
    let row = 0;
    const placeRow = (left: { label: string; primary: boolean; enabled: boolean; onClick: () => void } | null,
                      right: { label: string; primary: boolean; enabled: boolean; onClick: () => void } | null): void => {
      const y = top + row * (h + rowGap);
      if (left) {
        this.actionButtons.push(this.pin(new Button(this, {
          x: px, y, w: colW, h,
          label: left.label, primary: left.primary, enabled: left.enabled,
          fontSize: 12, onClick: left.onClick
        })));
      }
      if (right) {
        this.actionButtons.push(this.pin(new Button(this, {
          x: px + colW + colGap, y, w: colW, h,
          label: right.label, primary: right.primary, enabled: right.enabled,
          fontSize: 12, onClick: right.onClick
        })));
      }
      row++;
    };
    const placeFull = (label: string, primary: boolean, enabled: boolean, onClick: () => void): void => {
      const y = top + row * (h + rowGap);
      this.actionButtons.push(this.pin(new Button(this, {
        x: px, y, w: fullW, h,
        label, primary, enabled, fontSize: 13, onClick
      })));
      row++;
    };

    const hasAP = u.state.apRemaining >= 1;
    const canMove = hasAP && reachableForUnit(this.state, u).length > 0;
    const canAttack = hasAP && targetsForUnit(this.state, u).length > 0;
    // Item button: enabled when the unit has at least one consumable
    // (potion / elixir) AND has AP AND is wounded. The wounded gate
    // stays in to prevent a fat-finger waste of an item at full HP —
    // the picker itself only appears when there's a real reason to use
    // something. If/when more consumable kinds land that aren't pure
    // heals (e.g., an antidote, a buff), revisit this gate.
    const hasConsumable = u.state.inventory.some((it) => ITEM_CATALOG[it.kind].consumable);
    const canUseItem = hasAP && hasConsumable && u.state.hp < u.stats.hp;
    const canRoam = u.state.apRemaining === 0 && hasAbility(u, "Roam") && !u.state.roamUsedThisTurn
      && reachableForUnit(this.state, u).length > 0;

    // Pair related actions side-by-side. Primary actions on the right column.
    placeRow(
      { label: "Move  1AP",   primary: false, enabled: canMove,   onClick: () => this.enterMoveMode(u) },
      { label: "Attack  1AP", primary: true,  enabled: canAttack, onClick: () => this.enterAttackMode(u) }
    );
    placeRow(
      // Archers can now enter Ready too — their counter triggers at long range
      // (dist 2–4) against ranged attackers, NOT against adjacent melee. See
      // canTriggerReadyCounter / reachFor in combat/Stances.ts.
      // Stances stack (Ready + Defend together = "both"), but a stance the
      // unit already holds is disabled — re-buying it would waste the AP.
      { label: "Ready  1AP",  primary: false, enabled: hasAP && !hasReadyStance(u), onClick: () => this.applyStance(u, "ready") },
      { label: "Defend  1AP", primary: false, enabled: hasAP && !hasDefensiveStance(u), onClick: () => this.applyStance(u, "defensive") }
    );
    const canUndo =
      this.undoStack.length > 0 &&
      this.undoStack[this.undoStack.length - 1]!.unitId === u.id;
    placeRow(
      { label: "Item  1AP", primary: false, enabled: canUseItem, onClick: () => this.openItemPicker(u) },
      { label: "Undo Move", primary: false, enabled: canUndo, onClick: () => this.undoMove(u) }
    );
    // Mend — support heal for units carrying the ability (Ranatoli L10+).
    // Auto-targets the most-wounded adjacent ally; the button is disabled
    // when nobody adjacent is hurt, so it doubles as a range prompt.
    if (hasAbility(u, "Mend")) {
      const canMend = hasAP && this.mendTargetsFor(u).length > 0;
      placeFull("Mend  1AP  (heal adjacent ally)", true, canMend, () => this.performMend(u));
    }
    if (canRoam) placeFull("Roam (free)", false, true, () => this.enterRoamMode(u));
    placeFull("End Turn", false, true, () => { sfxClick(); this.endCurrentTurn(); });

    // Seamless targeting: as soon as a player unit has the menu, show its
    // action overlays by default so the player can click the map directly —
    // no round-trip to the side-menu buttons.
    //   * canMove → move mode: blue move tiles PLUS red tiles on any in-range
    //     enemy (drawOverlay adds them). Click blue to walk, red to attack.
    //   * can't move but canAttack (surrounded / 0 movement) → attack mode so
    //     the red targets still show and are click-to-attack.
    // Only from idle, so we don't stomp an Attack/Roam the player just opened.
    if (this.fsm.current().tag === "idle") {
      if (canMove) this.autoEnterMoveMode(u);
      else if (canAttack) this.autoEnterAttackMode(u);
    }
  }

  // Silent attack-mode entry (no click sfx) — used to auto-show red target
  // tiles when a unit can attack but has nowhere to move.
  private autoEnterAttackMode(u: Unit): void {
    const targets = targetsForUnit(this.state, u);
    if (targets.length === 0) return;
    this.fsm.send({ tag: "ENTER_ATTACK", targets });
    this.drawOverlay();
  }

  // Like enterMoveMode but silent (no click sfx) — used to show move tiles
  // automatically when the action menu appears, so the manual button press
  // isn't implied to have happened.
  private autoEnterMoveMode(u: Unit): void {
    const reach = reachableForUnit(this.state, u);
    const tiles = reach.filter((t) => !unitAt(this.state, t));
    if (tiles.length === 0) return;
    this.fsm.send({ tag: "ENTER_MOVE", tiles });
    this.drawOverlay();
  }

  // After a player action consumes AP, decide whether to keep showing buttons
  // or auto-end the turn. Roam units get to see their free-move offer at AP=0.
  private continueOrEnd(u: Unit): void {
    if (!isAlive(u)) { this.endCurrentTurn(); return; }
    const hasRoamLeft = hasAbility(u, "Roam") && !u.state.roamUsedThisTurn;
    if (u.state.apRemaining > 0 || hasRoamLeft) this.buildActionButtons(u);
    else this.endCurrentTurn();
  }

  // Undo the acting unit's last move: restore position, AP, roam flag,
  // and facing from the snapshot taken in animateMove. Repeated presses
  // walk a multi-move turn back one step at a time. Only repositioning
  // is undoable — any committing action clears the stack.
  private undoMove(u: Unit): void {
    const snap = this.undoStack[this.undoStack.length - 1];
    if (!snap || snap.unitId !== u.id) return;
    this.undoStack.pop();
    // Drop out of any targeting overlay before teleporting the unit —
    // the ranges shown were computed from the position we're leaving.
    this.fsm.send({ tag: "CANCEL_TARGETING" });
    sfxCancel();
    u.state.position = { x: snap.pos.x, y: snap.pos.y };
    u.state.apRemaining = snap.ap;
    u.state.roamUsedThisTurn = snap.roamUsed;
    u.state.facingX = snap.facingX;
    this.pushLog(`${u.name} reconsiders.`);
    this.refreshUnitView(u);
    // Re-anchor the idle bob to the restored tile (the running breath
    // tween still targets the pre-undo position).
    const view = this.unitViews.get(u.id);
    if (view) this.startBreathing(view);
    this.drawActiveMarker(u);
    this.refreshSidePanel(u);
    this.clearOverlays();
    this.clearActionButtons();
    this.buildActionButtons(u);
  }

  // Open a small picker over the action button column listing every
  // consumable kind currently in the unit's bag. The player taps the
  // row for the item they want to use; the picker closes and the item
  // resolves immediately. Earlier flow auto-picked the smallest
  // sufficient heal — that hid which item got burned and meant a
  // player saving an Elixir for a critical moment had no way to know
  // a potion got used instead. The explicit picker takes the choice
  // out of the engine and puts it back in the player's hands.
  //
  // Picker rows show: glyph, name, "+10 HP" / "+25 HP" effect line,
  // and "×N" count. Hover highlights the row; click uses that kind.
  // The "Cancel" row at the bottom and right-click anywhere both
  // dismiss without spending AP.
  private openItemPicker(u: Unit): void {
    sfxClick();
    this.closeItemPicker();
    // Group bag by item kind so a unit with three potions sees one row,
    // not three. Order: heals first (potion before elixir), then any
    // future consumables in their catalog order.
    const counts: Partial<Record<ItemKind, number>> = {};
    for (const it of u.state.inventory) {
      if (!ITEM_CATALOG[it.kind].consumable) continue;
      counts[it.kind] = (counts[it.kind] ?? 0) + 1;
    }
    const kinds: ItemKind[] = (Object.keys(counts) as ItemKind[])
      .sort((a, b) => HEAL_AMOUNT_FOR_KIND[a] - HEAL_AMOUNT_FOR_KIND[b]);
    if (kinds.length === 0) return;

    // Anchor over the action button column. Same x/width as the buttons
    // so it visually replaces the button block during the choice.
    const px = GAME_WIDTH - PANEL_W;
    const w = 256;
    const rowH = 32;
    const headerH = 22;
    const cancelH = 26;
    const padY = 8;
    const h = headerH + kinds.length * rowH + cancelH + padY * 2;
    // Bottom-anchor so the picker hugs the same y as the End Turn button.
    const y = 438 + 4 * (30 + 4) - h; // 4 rows of action buttons including End Turn
    this.itemPicker = this.pin(this.add.container(px, y).setDepth(40));

    const bg = this.add.graphics();
    bg.fillStyle(0x05060a, 0.97);
    bg.fillRect(0, 0, w, h);
    bg.lineStyle(1, COLORS.gold, 0.85);
    bg.strokeRect(0.5, 0.5, w - 1, h - 1);
    this.itemPicker.add(bg);

    const header = this.add.text(w / 2, padY + headerH / 2, "Choose an item", {
      fontFamily: FAMILY_HEADING,
      fontSize: "13px",
      color: "#f4d999"
    }).setOrigin(0.5);
    this.itemPicker.add(header);

    kinds.forEach((kind, i) => {
      const ry = padY + headerH + i * rowH;
      const rowBg = this.add.rectangle(0, ry, w, rowH, 0x131724, 0).setOrigin(0, 0);
      rowBg.setInteractive({ useHandCursor: true });
      const meta = ITEM_CATALOG[kind];
      const heal = HEAL_AMOUNT_FOR_KIND[kind];
      const glyph = this.add.text(12, ry + rowH / 2, meta.glyph, {
        fontFamily: FAMILY_BODY,
        fontSize: "18px",
        color: "#ffffff"
      }).setOrigin(0, 0.5);
      const name = this.add.text(40, ry + rowH / 2 - 7, meta.name, {
        fontFamily: FAMILY_HEADING,
        fontSize: "13px",
        color: "#dde6ef"
      }).setOrigin(0, 0.5);
      const detail = this.add.text(40, ry + rowH / 2 + 7, `+${heal} HP`, {
        fontFamily: FAMILY_BODY,
        fontSize: "11px",
        color: "#9aa3b0"
      }).setOrigin(0, 0.5);
      const count = this.add.text(w - 12, ry + rowH / 2, `×${counts[kind]}`, {
        fontFamily: FAMILY_HEADING,
        fontSize: "13px",
        color: "#c9b07a"
      }).setOrigin(1, 0.5);
      this.itemPicker!.add([rowBg, glyph, name, detail, count]);

      rowBg.on("pointerover", () => { rowBg.setFillStyle(0x1c2032, 1); sfxHover(); });
      rowBg.on("pointerout", () => { rowBg.setFillStyle(0x131724, 0); });
      rowBg.on("pointerdown", () => {
        this.closeItemPicker();
        this.useHealItem(u, kind);
      });
    });

    // Cancel row.
    const cy = padY + headerH + kinds.length * rowH + 2;
    const cancelBg = this.add.rectangle(0, cy, w, cancelH, 0x0a0c14, 0).setOrigin(0, 0);
    cancelBg.setInteractive({ useHandCursor: true });
    const cancelTxt = this.add.text(w / 2, cy + cancelH / 2, "Cancel", {
      fontFamily: FAMILY_HEADING,
      fontSize: "12px",
      color: "#9aa3b0"
    }).setOrigin(0.5);
    this.itemPicker.add([cancelBg, cancelTxt]);
    cancelBg.on("pointerover", () => { cancelBg.setFillStyle(0x1c2032, 1); cancelTxt.setColor("#dde6ef"); sfxHover(); });
    cancelBg.on("pointerout", () => { cancelBg.setFillStyle(0x0a0c14, 0); cancelTxt.setColor("#9aa3b0"); });
    cancelBg.on("pointerdown", () => this.closeItemPicker());
  }

  private closeItemPicker(): void {
    if (this.itemPicker) {
      this.itemPicker.destroy();
      this.itemPicker = undefined;
    }
  }

  // Find the first item of the chosen kind in the unit's bag, use it,
  // and run the standard post-action housekeeping (HP refresh, AP -1,
  // log line, floater, continueOrEnd).
  private useHealItem(u: Unit, kind: ItemKind): void {
    const pick = u.state.inventory.find((it) => it.kind === kind);
    if (!pick) return;
    const result = useItem(u, pick.id);
    if (!result.ok) return;
    this.undoStack.length = 0; // committing action — no undo past an item use
    u.state.apRemaining -= 1;
    this.pushLog(`${u.name} drinks a ${result.itemName} (+${result.healed} HP).`);
    const view = this.unitViews.get(u.id);
    if (view) this.spawnDamageNumber(view.sprite.x, view.sprite.y, `+${result.healed}`, 0x6dffb2);
    this.refreshUnitView(u);
    this.refreshSidePanel(u);
    this.clearActionButtons();
    this.continueOrEnd(u);
  }

  private enterRoamMode(u: Unit): void {
    sfxClick();
    // Grant a single throwaway AP that's only usable for one Move.
    u.state.roamUsedThisTurn = true;
    u.state.apRemaining = 1;
    this.pushLog(`${u.name} roams onward.`);
    const reach = reachableForUnit(this.state, u);
    const tiles = reach.filter((t) => !unitAt(this.state, t));
    this.fsm.send({ tag: "ENTER_ROAM", tiles });
    this.drawOverlay();
  }

  private enterMoveMode(u: Unit): void {
    sfxClick();
    const reach = reachableForUnit(this.state, u);
    const tiles = reach.filter((t) => !unitAt(this.state, t));
    this.fsm.send({ tag: "ENTER_MOVE", tiles });
    this.drawOverlay();
  }

  private enterAttackMode(u: Unit): void {
    sfxClick();
    const targets = targetsForUnit(this.state, u);
    this.fsm.send({ tag: "ENTER_ATTACK", targets });
    this.drawOverlay();
  }

  private applyStance(u: Unit, stance: "ready" | "defensive"): void {
    // Stances STACK (Ready + Defend may both be active, 1 AP each), but
    // re-entering a stance the unit already holds is a no-op — enterStance
    // returns false and we charge nothing. The buttons are disabled for
    // held stances too; this guard is belt-and-suspenders.
    if (!enterStance(u, stance)) return;
    this.undoStack.length = 0; // committing action — no undo past a stance buy
    sfxStance();
    u.state.apRemaining -= 1;
    this.pushLog(
      u.state.stance === "both"
        ? `${u.name} braces — ready AND defensive.`
        : `${u.name} enters ${stance} stance.`
    );
    this.refreshUnitView(u);
    this.refreshSidePanel(u);
    this.clearActionButtons();
    this.continueOrEnd(u);
  }

  private clearOverlays(): void {
    this.overlayG.clear();
    this.contourG.clear();
    this.threatG.clear();
    this.cursorG.clear();
    this.clearPathPreview();
    this.hoverPreview.setVisible(false);
  }

  // Clear the dotted path + destination ghost. Separate from clearOverlays
  // because handlePointerMove calls it every time the hover leaves the
  // reachable region, without wanting to nuke the region overlay itself.
  private clearPathPreview(): void {
    this.pathG.clear();
    this.moveGhost?.setVisible(false);
    this.lastPathKey = null;
  }

  // Dotted route from the unit to `dest` + a translucent ghost of the unit
  // standing on the destination tile. Same pathTo call (and same blocker
  // rule) as animateMove, so the preview never lies about the walk.
  // Cached per hovered tile — pointer moves within one tile are free.
  private drawPathPreview(u: Unit, dest: TilePos): void {
    const key = `${u.id}:${dest.x},${dest.y}`;
    if (key === this.lastPathKey) return;
    this.lastPathKey = key;
    this.pathG.clear();

    const path = this.state.grid.pathTo(u.state.position, dest, (p) => {
      const occ = unitAt(this.state, p);
      return occ !== null && occ !== u && occ.faction !== u.faction;
    });
    if (!path || path.length === 0) {
      this.moveGhost?.setVisible(false);
      return;
    }

    // Dots along each leg of the route (3 per tile-length segment), a ring
    // on the destination, and the ghost standing in it.
    const pts = [u.state.position, ...path].map((t) => this.projection.tileToWorld(t));
    this.pathG.fillStyle(COLORS.hover, 0.9);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!, b = pts[i + 1]!;
      for (const f of [0.25, 0.5, 0.75]) {
        this.pathG.fillCircle(a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, 2.4);
      }
    }
    const end = pts[pts.length - 1]!;
    this.pathG.lineStyle(1.5, COLORS.hover, 0.9);
    // Lying on the destination tile, foreshortened like the ground.
    this.pathG.strokeEllipse(end.x, end.y, 20, 20 * this.groundSquash());

    const view = this.unitViews.get(u.id);
    if (!view) return;
    if (!this.moveGhost) {
      // Dynamic world object → addWorld() keeps it off the UI camera (the
      // double-render rule for anything spawned after the create() sweep).
      this.moveGhost = this.addWorld(this.add.sprite(0, 0, view.sprite.texture.key));
      this.moveGhost.setDisplaySize(this.unitW, this.unitH);
      this.moveGhost.setAlpha(0.35);
    }
    this.moveGhost.setTexture(view.sprite.texture.key);
    this.moveGhost.setDisplaySize(this.unitW, this.unitH);
    this.moveGhost.setFlipX(view.sprite.flipX);
    this.moveGhost.setPosition(end.x, end.y + this.unitLift);
    this.moveGhost.setDepth(actorDepth(end.y + this.unitLift + this.unitH / 2));
    this.moveGhost.setVisible(true);
  }

  // A tile's visible top face as edges. Square on the flat board;
  // foreshortened and lifted by elevation on the diorama. Every
  // tile-shaped overlay goes through this — none may assume a 48px square.
  private tileQuad(t: TilePos): { L: number; R: number; T: number; B: number } {
    const f = this.projection.topFace(t);
    return { L: f.x, R: f.x + f.w, T: f.y, B: f.y + f.h };
  }

  private fillTile(g: Phaser.GameObjects.Graphics, t: TilePos): void {
    const f = this.projection.topFace(t);
    g.fillRect(f.x, f.y, f.w, f.h);
  }

  // Trace the outline of a tile region: for every tile, any edge whose
  // neighbour is OUTSIDE the region is part of the boundary. Drawn in two
  // passes (wide glow + thin core) so the range reads as one live-edged
  // shape instead of a checkerboard of painted tiles.
  private strokeRegionContour(g: Phaser.GameObjects.Graphics, tiles: readonly TilePos[], color: number): void {
    const inRegion = new Set(tiles.map((t) => `${t.x},${t.y}`));
    const edges: [number, number, number, number][] = [];
    // Neighbours by SCREEN side: on a turned board the tile above this one
    // on screen is not y - 1 (Projection.neighborOnScreen).
    const has = (n: TilePos) => inRegion.has(`${n.x},${n.y}`);
    const pr = this.projection;
    for (const t of tiles) {
      const { L, R, T, B } = this.tileQuad(t);
      if (!has(pr.neighborOnScreen(t, "up"))) edges.push([L, T, R, T]);
      if (!has(pr.neighborOnScreen(t, "down"))) edges.push([L, B, R, B]);
      if (!has(pr.neighborOnScreen(t, "left"))) edges.push([L, T, L, B]);
      if (!has(pr.neighborOnScreen(t, "right"))) edges.push([R, T, R, B]);
    }
    g.lineStyle(4, color, 0.22);
    for (const [x1, y1, x2, y2] of edges) g.lineBetween(x1, y1, x2, y2);
    g.lineStyle(1.5, color, 0.92);
    for (const [x1, y1, x2, y2] of edges) g.lineBetween(x1, y1, x2, y2);
  }

  // Target-lock corner brackets on a tile — reads as "acquire", not as a
  // painted attack tile. Four short L-shapes, one per corner.
  private strokeTargetBrackets(g: Phaser.GameObjects.Graphics, tile: TilePos, color: number): void {
    const q = this.tileQuad(tile);
    const L = q.L + 3, R = q.R - 3;
    const T = q.T + 3, B = q.B - 3;
    const a = Math.min(9, (B - T) * 0.35); // arm length
    g.lineStyle(2, color, 0.95);
    g.lineBetween(L, T, L + a, T); g.lineBetween(L, T, L, T + a);
    g.lineBetween(R, T, R - a, T); g.lineBetween(R, T, R, T + a);
    g.lineBetween(L, B, L + a, B); g.lineBetween(L, B, L, B - a);
    g.lineBetween(R, B, R - a, B); g.lineBetween(R, B, R, B - a);
  }

  private drawOverlay(): void {
    this.overlayG.clear();
    this.contourG.clear();
    this.threatG.clear();
    this.dangerG.clear();
    // Danger overlay — union of every living enemy's move+attack range.
    // Recomputed on every overlay redraw (turn dispatch + after actions)
    // so it always reflects the live board.
    if (this.dangerVisible) {
      this.dangerG.fillStyle(0xd05a4a, 0.13);
      for (const t of allEnemyDanger(this.state)) this.fillTile(this.dangerG, t);
    }
    const state = this.fsm.current();
    if (state.tag === "move" || state.tag === "roam") {
      const tint = state.tag === "roam" ? 0xffd45a : COLORS.moveTile;
      // Interior wash — deliberately faint and UNstroked per tile. The
      // per-tile grid strokes were the old look's tell; the region now
      // reads as one shape bounded by the breathing contour.
      this.overlayG.fillStyle(tint, state.tag === "roam" ? 0.14 : 0.10);
      for (const t of state.tiles) this.fillTile(this.overlayG, t);
      this.strokeRegionContour(this.contourG, state.tiles, tint);
      // Seamless attack: while a unit is selected (move mode, NOT roam —
      // roam is move-only), also mark any in-range enemy so the player can
      // click it to attack directly, without opening the Attack menu.
      // handlePointerUp checks the live target list before committing.
      if (state.tag === "move") {
        const u = this.initiative.current();
        if (u) {
          const targets = targetsForUnit(this.state, u);
          this.overlayG.fillStyle(COLORS.attackTile, 0.14);
          for (const t of targets) {
            this.fillTile(this.overlayG, t.state.position);
            this.strokeTargetBrackets(this.overlayG, t.state.position, COLORS.attackTile);
          }
        }
      }
    } else if (state.tag === "attack") {
      this.overlayG.fillStyle(COLORS.attackTile, 0.14);
      for (const t of state.targets) {
        this.fillTile(this.overlayG, t.state.position);
        this.strokeTargetBrackets(this.overlayG, t.state.position, COLORS.attackTile);
      }
    }
    // Always show enemy ready threat zones
    this.threatG.fillStyle(COLORS.threat, 0.16);
    this.threatG.lineStyle(1, COLORS.threat, 0.5);
    for (const u of this.state.units) {
      if (!isAlive(u) || u.faction === "player") continue;
      // hasReadyStance, not === "ready" — an enemy in the combined
      // "both" stance still counters, so its threat zone must render.
      // alwaysCounters (boss second wind) threatens the same tiles
      // permanently, and the player deserves to see that before they
      // walk into it.
      if (!hasReadyStance(u) && !u.state.alwaysCounters) continue;
      for (const z of counterZoneTiles(u)) {
        if (z.x < 0 || z.y < 0 || z.x >= this.state.grid.width || z.y >= this.state.grid.height) continue;
        this.fillTile(this.threatG, z);
      }
    }
  }

  // ---- Pointer handlers ----
  // Resolves on pointer-UP so a left-drag camera pan never commits an action.
  // True when a pointer is over the side panel or the top bar rather than
  // the playfield. Pointer coords are BUFFER pixels; design space is
  // buffer / RENDER_SCALE (same conversion the camera-pan code uses).
  //
  // Without this, every click on a UI button ALSO ran through the board
  // pipeline, because handlePointerUp turned any screen position into a
  // tile. That was invisible while maps were small and centred — the
  // panel sat over empty space. Once the endgame maps grew wide enough
  // to run underneath the panel, and reinforcements began spawning along
  // the east edge, clicking "Item" both opened the picker AND selected
  // the enemy standing under the panel.
  private isOverUi(p: Phaser.Input.Pointer): boolean {
    const x = p.x / RENDER_SCALE;
    const y = p.y / RENDER_SCALE;
    return x >= GAME_WIDTH - PANEL_W - 12 || y <= TOP_BAR_HEIGHT;
  }

  // Put the camera on a unit and mark where it landed. Called when the
  // player clicks a portrait in the initiative bar — the fastest way to
  // find the last enemy standing on a map wider than the viewport.
  //
  // The unit lands in the middle of the PLAYFIELD (the side panel covers
  // the right of the screen) as it is actually drawn: through the board's
  // tilt and at the current zoom. The world point under any screen point
  // is the scroll plus a fixed offset (screenToWorld), so the scroll that
  // puts the unit under the playfield's centre is exact in one step —
  // the same move centreBoard makes for the board after a turn.
  //
  // It used to centre with flat-board arithmetic, clamped to scrolls from
  // 0: on the tilted board, whose camera range now runs left of and above
  // 0 (drag slack), a unit near the top or left landed well off centre —
  // the enemy row of B8 ended up at the top of the screen.
  private focusUnit(u: Unit): void {
    if (!isAlive(u)) return;
    sfxHover();
    const cam = this.cameras.main;
    const view = this.unitViews.get(u.id);
    const wp = view ? bodyCentre(view.sprite) : this.projection.tileToWorld(u.state.position);
    const c = this.playfieldCentreScreen();
    const under = this.screenToWorld(c.x, c.y);
    // Inside the camera's range (cameras zoom about their top-left, so the
    // range is simply bounds.x .. bounds.right - view width).
    const b = cam.getBounds();
    const viewW = cam.width / cam.zoom, viewH = cam.height / cam.zoom;
    const targetX = Phaser.Math.Clamp(cam.scrollX + wp.x - under.x, b.x, Math.max(b.x, b.right - viewW));
    const targetY = Phaser.Math.Clamp(cam.scrollY + wp.y - under.y, b.y, Math.max(b.y, b.bottom - viewH));

    // Camera.pan() is deliberately not used — its centring math doesn't
    // survive the native-resolution zoom patch (installRenderScale). A plain
    // tween over setScroll is what the drag pan already does.
    this.tweens.add({
      targets: { x: cam.scrollX, y: cam.scrollY },
      x: targetX,
      y: targetY,
      duration: 320,
      ease: "Sine.easeInOut",
      onUpdate: (_tw, tgt: { x: number; y: number }) => cam.setScroll(tgt.x, tgt.y)
    });

    // A ring that expands and fades — its own object so it can't fight
    // the breathing/idle tweens already running on the unit sprite. It lies
    // on the ground at the unit's feet, squashed to the board's tilt, and
    // under the actors: a ping on the floor, not a hoop in the air.
    const sq = this.groundSquash();
    const foot = this.projection.tileToWorld(u.state.position);
    const ring = this.addWorld(
      this.add.circle(foot.x, foot.y + (this.diorama ? DIORAMA_FOOT_DY : 0), 24)
        .setStrokeStyle(3, 0xffd45a, 0.95)
        .setScale(1, sq)
        .setDepth(this.darknessRT ? DEPTH.OVER_DARK : DEPTH.GROUND_MARK + 0.5)
    );
    this.tweens.add({
      targets: ring,
      scaleX: 1.9,
      scaleY: 1.9 * sq,
      alpha: 0,
      duration: 650,
      ease: "Sine.easeOut",
      onComplete: () => ring.destroy()
    });
  }

  private handlePointerUp(p: Phaser.Input.Pointer): void {
    // Clicks that land on the UI belong to the UI alone.
    if (this.isOverUi(p)) { this.pressBegunInScene = false; return; }
    // Phantom release: the press happened while a dialogue (or other
    // overlay) had the scene paused. Swallow it — acting on it would
    // move/attack from a click the player aimed at the overlay.
    if (!this.pressBegunInScene) return;
    this.pressBegunInScene = false;
    // A release that ended a camera pan is consumed by the pan, not the game.
    if (this.pressWasDrag) { this.pressWasDrag = false; return; }
    // The board is turning under the pointer: nothing to click yet.
    if (this.spin) return;
    if (this.fsm.isInputBlocked()) return;
    const u = this.initiative.current();
    if (!u || u.faction !== "player") return;
    const tile = this.screenToTile(p.x, p.y);
    if (!tile) return;
    const fsmState = this.fsm.current();
    // Right-click while targeting cancels back to the menu (matches ESC),
    // instead of being read as a tile/unit selection.
    if (p.rightButtonReleased() && (fsmState.tag === "move" || fsmState.tag === "attack" || fsmState.tag === "roam")) {
      this.cancelTargetingMode(u);
      return;
    }
    if (fsmState.tag === "move" || fsmState.tag === "roam") {
      // Seamless attack: in move mode (not roam), a click on an in-range
      // enemy attacks it directly — the red overlay drawn in drawOverlay()
      // is clickable, no Attack-button round trip. Checked before the move
      // tiles; an occupied enemy tile is never a valid move tile anyway.
      if (fsmState.tag === "move") {
        const target = targetsForUnit(this.state, u).find(
          (t) => t.state.position.x === tile.x && t.state.position.y === tile.y
        );
        if (target) {
          // move → playerAnimating is a valid FSM transition; animateAttack
          // takes the target directly, so no ENTER_ATTACK step is needed.
          this.fsm.send({ tag: "BEGIN_PLAYER_ACTION" });
          void this.animateAttack(u, target);
          return;
        }
      }
      const ok = fsmState.tiles.some((t) => t.x === tile.x && t.y === tile.y);
      if (ok) {
        this.fsm.send({ tag: "BEGIN_PLAYER_ACTION" });
        void this.animateMove(u, tile);
        return;
      }
      // Invalid click while in move mode: auto-cancel and fall through to
      // the idle-mode handler so a click on another unit actually registers.
      // Without this, clicks were silently dropped and players had no visible
      // way to back out without knowing the ESC shortcut.
      this.cancelTargetingMode(u);
    } else if (fsmState.tag === "attack") {
      const target = fsmState.targets.find(
        (t) => t.state.position.x === tile.x && t.state.position.y === tile.y
      );
      if (target) {
        this.fsm.send({ tag: "BEGIN_PLAYER_ACTION" });
        void this.animateAttack(u, target);
        return;
      }
      this.cancelTargetingMode(u);
    }
    // Idle-mode selection logic (also reached after an auto-cancel above).
    const occ = unitAt(this.state, tile);
    const cur = this.initiative.current();
    if (occ && cur && occ.id !== cur.id) {
      // Click on a fresh player unit during player phase: swap control to them.
      const swappable =
        occ.faction === "player" &&
        isAlive(occ) &&
        !occ.state.hasActedThisRound &&
        this.initiative.setCurrent(occ);
      if (swappable) {
        this.beginCurrentTurn();
      } else {
        // Sticky inspect: show this unit's details until the player clicks
        // the active unit (or empty ground) to clear the inspection.
        this.inspectedUnitId = occ.id;
        this.activeUnitText.setText(occ.name);
        this.inspectTag.setText(`viewing — ${cur.name}'s turn`);
        this.refreshSidePanel(occ);
      }
    } else {
      // Clicked the active unit or empty terrain: restore active focus.
      this.inspectedUnitId = null;
      this.inspectTag.setText("");
      if (cur) {
        this.activeUnitText.setText(cur.name);
        this.refreshSidePanel(cur);
      }
    }
  }

  // Bail out of move/attack/roam targeting and restore the action menu.
  // Roam is special: entering it consumed the free AP and flagged the unit
  // as having roamed, so canceling has to give those back.
  private cancelTargetingMode(u: Unit): void {
    if (this.fsm.isRoaming()) {
      u.state.roamUsedThisTurn = false;
      u.state.apRemaining = 0;
    }
    this.fsm.send({ tag: "CANCEL_TARGETING" });
    this.clearOverlays();
    this.clearActionButtons();
    this.buildActionButtons(u);
  }

  /**
   * Put the forecast box beside a world point as it appears on screen:
   * to its right, or its left when that would run under the side panel,
   * always inside the playfield. The box was a world object at depth 0
   * clamped with screen constants — on the tilted, zoomed, scrolled board
   * it drew under the tiles and landed away from its enemy.
   */
  private placeHoverPreview(wp: { x: number; y: number }, boxW: number, boxH: number): void {
    const cam = this.cameras.main;
    const src = { x: (wp.x - cam.scrollX) * cam.zoom, y: (wp.y - cam.scrollY) * cam.zoom };
    const scr = this.keystone ? sourceToScreen(src.x, src.y, cam.width, cam.height, this.keystone) : src;
    const sx = scr.x / RENDER_SCALE, sy = scr.y / RENDER_SCALE;
    const right = GAME_WIDTH - PANEL_W - 12 - 8;
    let hx = sx + 30;
    if (hx + boxW > right) hx = sx - 30 - boxW;
    hx = Phaser.Math.Clamp(hx, 8, right - boxW);
    const hy = Phaser.Math.Clamp(sy - 16, TOP_BAR_HEIGHT + 6, GAME_HEIGHT - boxH - 12);
    this.hoverPreview.setPosition(hx, hy).setVisible(true);
  }

  private handlePointerMove(p: Phaser.Input.Pointer): void {
    if (this.fsm.isEnded()) return;
    const tile = this.spin || this.cameraDragState.active ? null : this.screenToTile(p.x, p.y);
    if (!tile) {
      this.cursorG.clear();
      this.clearXray();
      this.clearPathPreview();
      this.hoverPreview.setVisible(false);
      return;
    }
    this.cursorG.clear();
    const px = this.projection.tileToWorld(tile);
    this.cursorG.lineStyle(1, COLORS.hover, 0.9);
    const cq = this.tileQuad(tile);
    this.cursorG.strokeRect(cq.L + 0.5, cq.T + 0.5, cq.R - cq.L - 1, cq.B - cq.T - 1);
    this.updateXray(tile);

    // Path preview: hovering a reachable tile in move/roam mode shows the
    // dotted walking route + a translucent ghost of the unit at the
    // destination — the player sees exactly what a click commits to.
    {
      const st = this.fsm.current();
      const cur = this.initiative.current();
      const hoverReachable =
        (st.tag === "move" || st.tag === "roam") &&
        !!cur &&
        st.tiles.some((t) => t.x === tile.x && t.y === tile.y);
      if (hoverReachable && cur) this.drawPathPreview(cur, tile);
      else this.clearPathPreview();
    }

    // Damage preview when hovering an attackable enemy. Shown in BOTH attack
    // mode AND move mode (where in-range enemies are click-to-attack), so the
    // seamless attack has the same at-a-glance forecast as the menu path.
    const fsmState = this.fsm.current();
    const u = this.initiative.current();
    let target: Unit | undefined;
    if (u) {
      if (fsmState.tag === "attack") {
        target = fsmState.targets.find((t) => t.state.position.x === tile.x && t.state.position.y === tile.y);
      } else if (fsmState.tag === "move") {
        target = targetsForUnit(this.state, u).find((t) => t.state.position.x === tile.x && t.state.position.y === tile.y);
      }
    }
    if (u && target) {
      const tileDef = this.state.grid.tileAt(target.state.position);
      const pre = previewAttack(u, target, tileDef, false, this.state.units);
      const txt = this.hoverPreview.getData("txt") as Phaser.GameObjects.Text;
      // Equipment delta line — surfaces "why is my crit 35% not 25%?"
      // by spelling out the active passives. Skipped when neither
      // attacker nor defender carries equipment, so the tooltip stays
      // compact for vanilla attacks.
      const atkEq = equipmentBonuses(u);
      const defEq = equipmentBonuses(target);
      const eqParts: string[] = [];
      if (atkEq.hitPct) eqParts.push(`+${atkEq.hitPct}% hit`);
      if (atkEq.critPct) eqParts.push(`+${atkEq.critPct}% crit`);
      if (defEq.armorPenalty) eqParts.push(`-${defEq.armorPenalty} armr`);
      const lines = [
        `${u.name} → ${target.name}`,
        `Damage  ${pre.damage}`,
        `Hit     ${pre.hitRate}%`,
        `Crit    ${pre.critRate}%`,
        `Wpn x${pre.weaponMod.toFixed(2)}`,
        `Trn x${pre.terrainMod.toFixed(2)}  Stn x${pre.stanceMod.toFixed(2)}`
      ];
      if (eqParts.length > 0) lines.push(`Eq  ${eqParts.join(", ")}`);
      if (u.state.ravagedActive) lines.push(`RAVAGED +50% dmg`);
      if (target.state.ravagedActive) lines.push(`Target RAVAGED -50% arm`);
      txt.setText(lines.join("\n"));
      // Resize the backing to the measured text (6-9 lines depending on
      // equipment + Ravage states; the old fixed 220x100 box let the tail
      // lines spill unbacked onto the map). Same pattern as showInfoFor.
      const bg = this.hoverPreview.getData("bg") as Phaser.GameObjects.Graphics;
      const boxW = Math.max(220, Math.ceil(txt.width) + 20);
      const boxH = Math.max(100, Math.ceil(txt.height) + 16);
      bg.clear();
      bg.fillStyle(0x05060a, 0.94);
      bg.fillRect(0, 0, boxW, boxH);
      bg.lineStyle(1, COLORS.gold, 0.7);
      bg.strokeRect(0.5, 0.5, boxW - 1, boxH - 1);
      this.placeHoverPreview(px, boxW, boxH);
    } else {
      this.hoverPreview.setVisible(false);
    }
  }

  // ---- Animations ----
  private delay(ms: number): Promise<void> {
    return new Promise((res) => this.time.delayedCall(ms, res));
  }

  // Idle breathing — a slow ±1px y-bob with a randomized period per unit so
  // the army doesn't pulse in unison. Always re-target sprite.y around
  // view.baseY (not the current y) so multiple kill/restart cycles don't
  // accumulate drift.
  //
  // ANTI-FLOAT INVARIANT: baseY is recomputed here from the unit's live
  // tile, never trusted from the stored value. Breathing restarts pin
  // sprite.y to baseY — so a baseY left stale by ANY code path that
  // changed unit state without walking the sprite (scripted repositioning,
  // dialogue side effects, future content) used to hover the unit at the
  // OLD tile's height permanently, re-asserted on every idle re-entry
  // ("Ning floating in B3"). Re-deriving the anchor at every restart makes
  // the whole class of stale-anchor floats self-healing: the next idle
  // re-entry (after every walk, lunge, and turn) snaps the unit back to
  // the ground of the tile it actually occupies.
  private startBreathing(view: UnitView): void {
    view.breathTween?.stop();
    // Never bob a corpse — death poses (alpha + 90° tilt) must persist.
    if (!isAlive(view.unit)) return;
    // An arrival starts the breath itself when it lands.
    if (view.animLock === "arriving") return;
    const px = this.projection.tileToWorld(view.unit.state.position);
    view.baseY = px.y + this.unitLift;
    view.sprite.setPosition(px.x, view.baseY);
    view.shadow.setPosition(px.x, view.baseY + 24);
    view.breathTween = this.tweens.add({
      targets: view.sprite,
      y: view.baseY - 1,
      duration: 1200 + Math.floor(Math.random() * 700),
      ease: "Sine.easeInOut",
      yoyo: true,
      repeat: -1
    });
  }

  private stopBreathing(view: UnitView): void {
    // Every animation that takes a sprite over starts here — so this is
    // where an arrival still walking in gets out of its way.
    if (view.animLock === "arriving") view.finishArrival?.();
    view.breathTween?.stop();
    view.breathTween = undefined;
    view.sprite.y = view.baseY;
  }

  // Three small puffs at the unit's foot — fan upward + outward, fade out.
  // Sells the push-off without spamming particles per step.
  //
  // Sorted with the actors at that foot position. These were created at
  // depth 0 — under every terrain tile past the first row, so on most of
  // the board the footfalls were never actually seen.
  private spawnDust(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const dir = (i - 1) * 0.7; // -0.7, 0, +0.7 radians of horizontal spread
      const dist = 10 + Math.random() * 6;
      const puff = this.addWorld(this.add.circle(x, y, 2.5 + Math.random() * 1.5, 0xc9b07a, 0.55)
        .setDepth(this.dustDepth(y)));
      this.tweens.add({
        targets: puff,
        x: x + Math.sin(dir) * dist,
        y: y - 4 - Math.random() * 4,
        alpha: 0,
        scale: 0.3,
        duration: 360 + Math.random() * 120,
        ease: "Cubic.easeOut",
        onComplete: () => puff.destroy()
      });
    }
  }

  private async animateMove(u: Unit, dest: TilePos): Promise<void> {
    // Capture the start tile BEFORE moveUnit mutates u.state.position — needed
    // so the first-step facing flip is computed from the actual origin tile.
    const startTile: TilePos = { x: u.state.position.x, y: u.state.position.y };
    const path = this.state.grid.pathTo(startTile, dest, (p) => {
      const occ = unitAt(this.state, p);
      return occ !== null && occ !== u && occ.faction !== u.faction;
    });
    if (!path) {
      // Player branch: stuck in playerAnimating, recover to idle. Enemy branch:
      // FSM is in enemyTurn, ACTION_COMPLETE is a no-op there.
      this.fsm.send({ tag: "ACTION_COMPLETE" });
      return;
    }
    // Snapshot for Undo Move — player units only, and never for roam
    // moves (the roam-granted AP is move-only; restoring it would let
    // the player convert it into an attack).
    if (u.faction === "player" && this.fsm.current().tag !== "roam") {
      this.undoStack.push({
        unitId: u.id,
        pos: { x: startTile.x, y: startTile.y },
        ap: u.state.apRemaining,
        roamUsed: u.state.roamUsedThisTurn,
        facingX: u.state.facingX
      });
    }
    moveUnit(this.state, u, dest);
    const view = this.unitViews.get(u.id);
    if (!view) {
      this.fsm.send({ tag: "ACTION_COMPLETE" });
      return;
    }
    playUnitState(this, view.sprite, u, "walk");
    // Pause idle breathing for the duration of the walk so it doesn't fight
    // with the walk tween's y control. Restarted on arrival.
    this.stopBreathing(view);
    // Push-off dust at the starting tile's foot position.
    this.spawnDust(view.sprite.x, view.baseY + 22);

    // Continuous walk: ONE tween across the whole polyline instead of a
    // chained per-tile tween. The old per-step Sine.easeInOut meant the
    // sprite accelerated from rest and braked to a full stop at EVERY
    // tile edge (plus a one-frame handoff gap between tweens) — a
    // five-tile move visibly pulsed five times. A single eased counter
    // across all legs gives one acceleration, a constant cruise, and one
    // deceleration; facing flips and footstep SFX fire at leg boundaries
    // exactly as before.
    const legTiles = [startTile, ...path];
    const pts = legTiles.map((t) => this.projection.tileToWorld(t));
    const legs = pts.length - 1;
    const MS_PER_TILE = 95;
    const isActive = this.initiative.current() === u;
    let lastLeg = -1;
    await new Promise<void>((res) => {
      this.tweens.addCounter({
        from: 0,
        to: legs,
        duration: legs * MS_PER_TILE + 70,
        ease: "Sine.easeInOut",
        onUpdate: (tw) => {
          // Clamp fractionally below `legs` so the final frame still
          // resolves to the last leg (floor(legs) would index past it).
          const s = Math.min(tw.getValue() ?? 0, legs - 1e-6);
          const i = Math.floor(s);
          const f = s - i;
          const a = pts[i]!;
          const b = pts[i + 1]!;
          if (i !== lastLeg) {
            lastLeg = i;
            const dx = b.x - a.x;
            // Facing is kept in GRID terms (east/west), so it survives a
            // turn of the board; the sprite faces the way it moves on screen.
            const gdx = legTiles[i + 1]!.x - legTiles[i]!.x;
            if (gdx !== 0) u.state.facingX = gdx > 0 ? 1 : -1;
            if (Math.abs(dx) > 0.5) view.sprite.setFlipX(dx < 0);
            sfxStep();
            // Kick a small puff at each stride boundary (not just the
            // push-off) so a long run leaves a readable dust trail.
            if (i > 0) this.spawnDust(a.x, a.y + this.unitLift + 22);
          }
          const x = a.x + (b.x - a.x) * f;
          // A small lift through each stride so a walk reads as steps,
          // not a glide — and a real hop when the stride changes height.
          const ta = legTiles[i]!, tb = legTiles[i + 1]!;
          const climb = Math.abs(this.elevAtTile(tb) - this.elevAtTile(ta));
          const hop = Math.sin(f * Math.PI) * (2.5 + climb * 7);
          const y = a.y + (b.y - a.y) * f + this.unitLift - hop;
          view.sprite.setPosition(x, y);
          // Shadow stays planted on the ground under the hop.
          view.shadow.setPosition(x, y + hop + 22);
          if (isActive) this.followActiveMarker(u);
        },
        onComplete: () => res()
      });
    });
    const end = pts[legs]!;
    view.sprite.setPosition(end.x, end.y + this.unitLift);
    view.shadow.setPosition(end.x, end.y + this.unitLift + 22);
    view.baseY = end.y + this.unitLift;
    playUnitState(this, view.sprite, u, "idle");
    // Landing weight: a fast, tiny squash-and-recover on arrival. Scale
    // only — never y (baseY/breathing own that), so the anti-float
    // invariant holds. Origin is the sprite's center, so the squash
    // reads as settling onto the ground.
    const sx0 = view.sprite.scaleX;
    const sy0 = view.sprite.scaleY;
    this.tweens.add({
      targets: view.sprite,
      scaleX: sx0 * 1.05,
      scaleY: sy0 * 0.92,
      duration: 60,
      yoyo: true,
      ease: "Sine.easeOut",
      onComplete: () => view.sprite.setScale(sx0, sy0)
    });
    this.spawnDust(end.x, end.y + this.unitLift + 22);
    this.startBreathing(view);
    u.state.apRemaining -= 1;
    this.pushLog(`${u.name} moves.`);
    if (u.faction === "player") this.tutorial?.notify("moved");
    this.refreshUnitView(u);
    this.refreshSidePanel(u);
    // Rebuild the active marker's pulse tweens at the new sprite position.
    if (isActive) this.drawActiveMarker(u);
    this.clearActionButtons();
    this.clearOverlays();
    // Player path: playerAnimating → idle. Enemy path: stays in enemyTurn (no-op).
    this.fsm.send({ tag: "ACTION_COMPLETE" });
    if (this.checkEnd()) return;
    // Enemy turns are driven by runEnemyTurn — don't advance the queue here.
    if (u.faction !== "player") return;
    this.continueOrEnd(u);
  }

  // Apply (or clear) the "spent" dim+desaturate to a unit's sprite based on
  // whether it has acted this round. Called from refreshUnitView so the
  // visual stays in sync with hasActedThisRound automatically. Cool-grey
  // tint multiplies down the colour; alpha drop reinforces it.
  private applySpentTint(s: Phaser.GameObjects.Sprite, u: Unit): void {
    if (u.state.hasActedThisRound) {
      s.setTint(0x707888);
      s.setAlpha(0.55);
    } else {
      s.clearTint();
      s.setAlpha(1);
    }
  }

  // Brief impact flash on a defender's sprite. Takes the unit too so the
  // post-flash restore can reinstate the spent dim if the unit was already
  // dim before the flash — without this the flash would silently strip
  // the spent tint and the player would see a fresh-looking sprite for a
  // unit that's already acted.
  // Cinematic title slate on battle entry: two gold rules, the battle
  // ordinal in small caps, the subtitle large beneath. Fades up after
  // the camera fade-in, holds, dissolves. Pure presentation — input is
  // never blocked.
  private showBattleTitleCard(title: string, subtitle: string): void {
    const cx = (GAME_WIDTH - PANEL_W) / 2;
    const cy = GAME_HEIGHT * 0.30;
    const ruleW = 340;
    const topRule = this.add.rectangle(cx, cy - 34, ruleW, 2, 0xd9b257, 0.9);
    const botRule = this.add.rectangle(cx, cy + 44, ruleW, 2, 0xd9b257, 0.9);
    const small = this.add.text(cx, cy - 16, title.toUpperCase(), {
      fontFamily: FAMILY_HEADING,
      fontSize: "16px",
      color: "#d9b257",
      stroke: "#1a0e04",
      strokeThickness: 3,
      letterSpacing: 6
    }).setOrigin(0.5);
    const big = this.add.text(cx, cy + 14, subtitle, {
      fontFamily: FAMILY_HEADING,
      fontSize: "34px",
      color: "#f4e4b0",
      stroke: "#1a0e04",
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 3, color: "#000", blur: 12, fill: true }
    }).setOrigin(0.5);
    const card = this.add.container(0, 0, [topRule, botRule, small, big]);
    card.setDepth(1200).setAlpha(0);
    // Rules sweep outward from nothing as the text fades up.
    topRule.setScale(0, 1);
    botRule.setScale(0, 1);
    this.tweens.add({ targets: card, alpha: 1, duration: 450, delay: 350, ease: "Sine.easeOut" });
    this.tweens.add({ targets: [topRule, botRule], scaleX: 1, duration: 600, delay: 350, ease: "Cubic.easeOut" });
    this.tweens.add({
      targets: card,
      alpha: 0,
      y: -14,
      duration: 500,
      delay: 2300,
      ease: "Sine.easeIn",
      onComplete: () => card.destroy()
    });
  }

  // Death dissolve — the fall of a unit, upgraded from a bare alpha
  // fade: grey-out, a squash-and-topple, dark ash kicked off the body,
  // and one soft light rising away. Shared by every death site (normal
  // kills, Destruct mutual kills, counter deaths).
  //
  // The fall pivots at the FEET (where the shadow sits), away from the
  // blow, so the body comes down onto the tile it stood on. The old tilt
  // turned the sprite about its centre: the feet swung out into the air
  // and the body lay half a figure above the ground — invisible on the
  // flat board, obvious on the tilted one where the floor is a plane.
  private playDeathDissolve(view: UnitView, u: Unit, fromX?: number): void {
    playUnitState(this, view.sprite, u, "death");
    this.stopBreathing(view);
    const s = view.sprite;
    view.animLock = "dying";
    s.setVisible(true);
    // A killing blow flashed the sprite white a moment ago; flashSprite
    // hands it the death grey when the flash ends. Greying it here would
    // swallow the flash, the one "got hit" read the kill has.
    if (!s.tintFill) s.setTint(0x6a6a72);
    const x0 = s.x;
    const footY = view.shadow.y;
    const arm = footY - s.y; // feet → centre
    const away = fromX === undefined || Math.abs(fromX - x0) < 2
      ? (this.screenFlipX(u) ? 1 : -1)
      : Math.sign(x0 - fromX);
    const fallDeg = 82 * away;
    const sy0 = s.scaleY;
    const pose = (deg: number, squash: number) => {
      const th = Phaser.Math.DegToRad(deg);
      s.setAngle(deg);
      s.setPosition(x0 + arm * Math.sin(th), footY - arm * Math.cos(th));
      s.scaleY = sy0 * squash;
    };
    const world = <T extends Phaser.GameObjects.GameObject>(o: T) => this.addWorld(o);
    // Real death frames fall on their own — stagger, knees, collapse, lying
    // still — so they only need the landing and the fade. Toppling them as
    // well would fall the body twice.
    if (hasUnitState(this, u, "death")) {
      const FALL_MS = 4 * 1000 / 6; // four frames at the death sheet's 6fps
      this.tweens.add({
        targets: view.shadow, scaleX: 1.5, duration: FALL_MS, ease: "Quad.easeIn",
        onComplete: () => this.tweens.add({ targets: view.shadow, alpha: 0, duration: 500, delay: 200 })
      });
      this.time.delayedCall(FALL_MS * 0.75, () => {
        groundDust(this, world, x0, footY, {
          depth: this.dustDepth(footY), count: 7, spread: 16, squash: this.groundSquash()
        });
      });
      this.tweens.add({
        targets: s, alpha: 0, duration: 600, delay: FALL_MS + 420, ease: "Sine.easeIn",
        onComplete: () => {
          view.animLock = undefined;
          s.setVisible(false);
        }
      });
      ashBurst(this, world, x0, footY - 6);
      soulWisp(this, world, x0, footY - arm, ensureDotTexture(this));
      return;
    }
    const squash = this.diorama ? 0.86 : 0.9;
    this.tweens.addCounter({
      from: 0,
      to: 1,
      duration: 400,
      ease: "Quad.easeIn",
      onUpdate: (tw) => {
        const f = tw.getValue() ?? 0;
        pose(fallDeg * f, 1 - (1 - squash) * f);
      },
      onComplete: () => {
        // Landing: dust where the shoulders hit, a small rebound, then
        // the body settles and fades.
        const headX = x0 + arm * 1.6 * away;
        groundDust(this, world, headX, footY, {
          depth: this.dustDepth(footY), count: 7, spread: 16, squash: this.groundSquash()
        });
        this.tweens.addCounter({
          from: 0,
          to: 1,
          duration: 150,
          ease: "Sine.easeOut",
          onUpdate: (tw) => pose(fallDeg - 7 * away * Math.sin(Math.PI * (tw.getValue() ?? 0)), squash)
        });
        // Lie still a beat, then go. Hidden at the end, exactly as every
        // refresh leaves a dead unit.
        this.tweens.add({
          targets: s, alpha: 0, duration: 600, delay: 420, ease: "Sine.easeIn",
          onComplete: () => {
            view.animLock = undefined;
            s.setVisible(false);
          }
        });
      }
    });
    // The shadow stretches along the falling body, then goes with it.
    this.tweens.add({
      targets: view.shadow,
      x: x0 + arm * 0.8 * away,
      scaleX: 1.7,
      duration: 400,
      ease: "Quad.easeIn",
      onComplete: () => {
        this.tweens.add({ targets: view.shadow, alpha: 0, duration: 500, delay: 200 });
      }
    });
    ashBurst(this, world, x0, footY - 6);
    soulWisp(this, world, x0, footY - arm, ensureDotTexture(this));
  }

  /**
   * Vertical squash of anything lying on the floor: tile depth ÷ tile width
   * on the tilted board, 1 (a circle stays a circle) on the flat one.
   */
  private groundSquash(): number {
    return this.diorama ? DIORAMA_TILE_H / DIORAMA_TILE_W : 1;
  }

  /**
   * Depth for dust kicked up at ground y: just in front of whoever stands
   * there. Actors sort by their sprite's bottom edge, which sits a few px
   * below the feet (and the contact shadow), so dust sorted AT the feet
   * went behind the legs that raised it.
   */
  private dustDepth(groundY: number): number {
    return actorDepth(groundY + 10);
  }

  private flashSprite(s: Phaser.GameObjects.Sprite, color: number, u?: Unit): void {
    s.setTintFill(color);
    this.time.delayedCall(120, () => {
      // A killing blow: the death animation has taken the sprite over
      // (grey, falling, fading) — hand it back the death grey, not the
      // living unit's tint and full alpha.
      if (u && !isAlive(u)) {
        s.setTint(0x6a6a72);
        return;
      }
      s.clearTint();
      if (u) this.applySpentTint(s, u);
    });
  }

  private spawnDamageNumber(
    x: number,
    y: number,
    text: string,
    color: number,
    crit = false
  ): void {
    // Crit numbers render larger, with a heavier stroke + drop shadow, and
    // pop in with a more aggressive scale curve. Misses and regular hits
    // get the lighter treatment so the eye knows instantly when something
    // big landed.
    const fontSize = crit ? "26px" : "18px";
    const strokeThickness = crit ? 5 : 3;
    // Depth set explicitly: this sat at 0 before, UNDER the atmosphere
    // (23) and the darkness (25) — invisible on every night battle.
    const t = this.addWorld(this.add.text(x, y - 12, text, {
      fontFamily: FAMILY_HEADING,
      fontSize,
      color: `#${color.toString(16).padStart(6, "0")}`,
      stroke: "#000",
      strokeThickness,
      shadow: crit
        ? { offsetX: 0, offsetY: 3, color: "#000", blur: 10, fill: true, stroke: true }
        : { offsetX: 0, offsetY: 2, color: "#000", blur: 4, fill: true }
    }).setOrigin(0.5).setDepth(DEPTH.FLOATER));
    // Pop-in: scale punches up then settles. Crit overshoots harder.
    const peak = crit ? 1.45 : 1.2;
    t.setScale(0.5);
    this.tweens.add({
      targets: t,
      scaleX: peak,
      scaleY: peak,
      duration: 110,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: t,
          scaleX: 1.0,
          scaleY: 1.0,
          duration: 90,
          ease: "Sine.easeInOut"
        });
      }
    });
    // Drift up + fade. Crits hang slightly longer so the pop reads.
    this.tweens.add({
      targets: t,
      y: y - 42,
      alpha: 0,
      duration: crit ? 900 : 700,
      ease: "Sine.easeOut",
      onComplete: () => t.destroy()
    });
  }

  private async lunge(attacker: Unit, target: Unit): Promise<void> {
    const av = this.unitViews.get(attacker.id);
    const tv = this.unitViews.get(target.id);
    if (!av || !tv) return;
    const sx = av.sprite.x;
    const sy = av.sprite.y;
    const tx = tv.sprite.x;
    const ty = tv.sprite.y;
    av.sprite.setFlipX(tx < sx);
    playUnitState(this, av.sprite, attacker, "attack");
    // Halt breathing — lunge owns sprite.y for the duration.
    this.stopBreathing(av);

    // Bow attacks don't lunge across four tiles of empty air — the archer
    // recoils into the draw and an actual arrow flies to the target. The
    // promise resolves on IMPACT, so damage application (which callers run
    // right after awaiting us) lands the moment the arrow does. Counters
    // route through here too, so a Ready archer's retaliation also looses
    // a visible arrow.
    if (attacker.weapon === "bow") {
      const dirX = tx > sx ? 1 : -1;
      this.tweens.add({
        targets: av.sprite,
        x: sx - dirX * 5,
        duration: 90,
        ease: "Cubic.easeOut",
        yoyo: true
      });
      // Release at the top of the draw: the impact frame of a real attack
      // sheet (see ANIM_SPECS.attack), or a beat into the recoil without one.
      await this.delay(hasUnitState(this, attacker, "attack") ? 185 : 70);
      await fireArrow(this, (o) => this.addWorld(o), sx + dirX * 10, sy - 6, tx, ty + 2, {
        fromY: av.shadow.y,
        toY: tv.shadow.y,
        depth: DEPTH.SHADOW + 0.5
      });
      playUnitState(this, av.sprite, attacker, "idle");
      this.startBreathing(av);
      return;
    }

    // Lens attacks: no lunge, no projectile — Veya plants, the rig
    // charges, and the beam simply arrives. A slight brace-back sells
    // the recoil of holding focused light on target.
    if (attacker.weapon === "lens") {
      const dirX = tx > sx ? 1 : -1;
      this.tweens.add({
        targets: av.sprite,
        x: sx - dirX * 3,
        duration: 110,
        ease: "Sine.easeOut",
        yoyo: true
      });
      if (hasUnitState(this, attacker, "attack")) await this.delay(110);
      sfxLensBeam();
      await lensBeam(this, (o) => this.addWorld(o), sx + dirX * 8, sy - 8, tx, ty);
      playUnitState(this, av.sprite, attacker, "idle");
      this.startBreathing(av);
      return;
    }

    // Anticipation: a 60ms coil (squash down, slight lean back) before
    // the strike. Animation 101 — the wind-up is what makes the lunge
    // land. Scale-only, so the anti-float invariant holds.
    const lsx = av.sprite.scaleX;
    const lsy = av.sprite.scaleY;
    const dirX = tx > sx ? 1 : -1;
    await new Promise<void>((res) => {
      this.tweens.add({
        targets: av.sprite,
        scaleX: lsx * 1.04,
        scaleY: lsy * 0.9,
        x: sx - dirX * 3,
        duration: 60,
        ease: "Sine.easeOut",
        yoyo: true,
        onComplete: () => {
          av.sprite.setScale(lsx, lsy);
          res();
        }
      });
    });
    // The strike is a STEP: the body lifts off the back foot, drives a
    // third of the way in and plants — dust at the front foot — then
    // recovers. The shadow is the feet: it steps half as far, and the gap
    // between it and the rising body is what reads as weight leaving the
    // ground on the tilted board.
    const reach = 0.32;
    const sh0x = av.shadow.x, sh0y = av.shadow.y;
    const hop = this.diorama ? 4 : 2.5;
    const place = (f: number) => {
      av.sprite.setPosition(sx + (tx - sx) * reach * f, sy + (ty - sy) * reach * f - hop * Math.sin(Math.PI * f));
      av.shadow.setPosition(sh0x + (tx - sx) * reach * 0.55 * f, sh0y + (ty - sy) * reach * 0.55 * f);
    };
    await new Promise<void>((res) => {
      this.tweens.addCounter({
        from: 0, to: 1, duration: 130, ease: "Cubic.easeOut",
        onUpdate: (tw) => place(tw.getValue() ?? 0),
        onComplete: () => res()
      });
    });
    groundDust(this, (o) => this.addWorld(o), av.shadow.x + dirX * 6, av.shadow.y, {
      depth: this.dustDepth(av.shadow.y), count: 4, spread: 9, squash: this.groundSquash(), dirX
    });
    return new Promise((res) => {
      this.tweens.addCounter({
        from: 1, to: 0, duration: 150, ease: "Sine.easeInOut",
        onUpdate: (tw) => place(tw.getValue() ?? 0),
        onComplete: () => {
          av.shadow.setPosition(sh0x, sh0y);
          playUnitState(this, av.sprite, attacker, "idle");
          this.startBreathing(av);
          res();
        }
      });
    });
  }

  private applyAttackEffects(
    attacker: Unit,
    defender: Unit,
    result: { hit: boolean; crit: boolean; damage: number; defenderKilled: boolean },
    opts?: { interposedFrom?: Unit }
  ): void {
    const tv = this.unitViews.get(defender.id);
    const av = this.unitViews.get(attacker.id);
    if (!tv || !av) return;
    const tx = tv.sprite.x;
    const ty = tv.sprite.y;
    // Interpose VFX: a sparse golden "INTERPOSED!" floater rises off the
    // ORIGINAL target (the one who was saved) so the player sees the
    // redirect register on the unit they protected. The big red damage
    // number lands on the actual interposer below.
    if (opts?.interposedFrom) {
      const ov = this.unitViews.get(opts.interposedFrom.id);
      if (ov) {
        // addWorld: created after the setup sweep, so without it the UI
        // camera (which never scrolls) drew a second copy offset by the pan.
        const banner = this.addWorld(this.add.text(ov.sprite.x, ov.sprite.y - TILE_SIZE / 2 - 10, "INTERPOSED!", {
          fontFamily: FAMILY_HEADING,
          fontSize: "14px",
          color: "#fff7c4",
          stroke: "#1a0e04",
          strokeThickness: 4,
          shadow: { offsetX: 0, offsetY: 2, color: "#000", blur: 6, fill: true }
        }).setOrigin(0.5, 1).setDepth(45));
        this.tweens.add({
          targets: banner,
          y: banner.y - 22,
          alpha: 0,
          duration: 1300,
          ease: "Sine.easeOut",
          onComplete: () => banner.destroy()
        });
        this.pushLog(`${defender.name} steps in front of ${attacker.name}'s blow meant for ${opts.interposedFrom.name}.`);
      }
    }
    const impactAngle = Math.atan2(ty - av.sprite.y, tx - av.sprite.x);
    if (result.hit) {
      // Hit-stop: a beat of near-frozen time the instant damage lands.
      // 60ms reads as weight, 120ms as a crit. Restores through
      // applyTurnSpeed so the fast-forward 2x comes back correctly.
      hitStop(this, result.crit ? 120 : 60, () => this.applyTurnSpeed());
      if (result.crit) {
        sfxCrit();
        // Crit kicker: heavier camera shake on top of the hit-stop.
        this.cameras.main.shake(180, 0.012);
      } else {
        sfxAttackHit();
        // Every hit moves the camera a little — scaled by damage so a
        // 3-point poke whispers and a 14-point cleave thumps.
        this.cameras.main.shake(70, 0.0035 + Math.min(0.004, result.damage * 0.0002));
      }
      // Directional flinch: the defender is shoved along the blow's line
      // and recovers. Skipped on kills — the death dissolve owns the
      // sprite from here. startBreathing on completion re-anchors them
      // to their tile (the anti-float invariant).
      if (!result.defenderKilled) {
        const fx = Math.cos(impactAngle) * (result.crit ? 11 : 7);
        const fy = Math.sin(impactAngle) * (result.crit ? 11 : 7);
        this.stopBreathing(tv);
        this.tweens.add({
          targets: tv.sprite,
          x: tv.sprite.x + fx,
          y: tv.sprite.y + fy,
          duration: 80,
          ease: "Cubic.easeOut",
          yoyo: true,
          onComplete: () => this.startBreathing(tv)
        });
      }
      // Impact VFX: melee blows get the crescent slash sweep in the attack
      // direction; every hit gets the radial spark. Arrows skip the slash —
      // the projectile itself already carried the motion.
      // (lens skips it too — the beam's landing scatter is its impact.)
      if (attacker.weapon !== "bow" && attacker.weapon !== "lens") {
        slashArc(this, (o) => this.addWorld(o), tx, ty, impactAngle, result.crit);
      }
      hitSpark(this, (o) => this.addWorld(o), tx, ty, result.crit);
      // Crits own the moment: a gold ring snaps outward from the impact.
      if (result.crit) {
        critShockwave(this, (o) => this.addWorld(o), tx, ty);
        // Driven back a step: dust off the heels, on the far side.
        groundDust(this, (o) => this.addWorld(o), tv.shadow.x, tv.shadow.y, {
          depth: this.dustDepth(tv.shadow.y), count: 5, spread: 14,
          squash: this.groundSquash(), dirX: Math.cos(impactAngle) >= 0 ? 1 : -1
        });
      }
      // Crisp white impact flash — reads instantly as "got hit", regardless
      // of unit palette. Red tint blended in with enemy reds before.
      this.flashSprite(tv.sprite, 0xffffff, defender);
      playUnitState(this, tv.sprite, defender, "hit");
      this.spawnDamageNumber(
        tx, ty,
        result.crit ? `CRIT ${result.damage}` : `${result.damage}`,
        result.crit ? 0xffd45a : 0xff8a8a,
        result.crit
      );
      this.pushLog(`${attacker.name} hits ${defender.name} for ${result.damage}${result.crit ? " (crit!)" : ""}.`);
    } else {
      sfxAttackMiss();
      // Whiff puffs drifting past the defender in the swing direction —
      // a miss shows motion instead of nothing but the floater.
      missWhiff(this, (o) => this.addWorld(o), tx, ty, Math.cos(impactAngle) >= 0 ? 1 : -1);
      this.spawnDamageNumber(tx, ty, "MISS", 0xc0c5cf);
      this.pushLog(`${attacker.name} misses ${defender.name}.`);
    }
    this.refreshUnitView(defender);
    if (result.defenderKilled) {
      this.finalBlow = { attacker: attacker.id, target: defender.id };
      sfxDeath();
      this.pushLog(`${defender.name} falls.`);
      this.playDeathDissolve(tv, defender, av.sprite.x);
      // XP award: only player kills of enemies count. Allied kills (friendly
      // fire, AI vs AI) and enemy kills of players don't award anything.
      // The reward is computed from base-by-class × level-diff modifier; a
      // level-up may fire if the unit crosses 100 XP, with stat gains
      // surfaced in the log so the player sees what changed.
      if (attacker.faction === "player" && defender.faction === "enemy") {
        const reward = xpRewardFor(attacker, defender);
        const { totalAwarded, levelUps } = awardXp(attacker, reward);
        if (totalAwarded > 0) {
          this.pushLog(`${attacker.name} gains ${totalAwarded} XP.`);
          this.announceXpGain(attacker, totalAwarded);
        }
        for (const lu of levelUps) {
          this.announceLevelUp(attacker, lu);
        }
      }
      // Dialogue trigger: fire any ally_killed_target dialogue matching
      // this (attacker, defender) pair. Pauses the battle if one matches,
      // resumes after the player advances through the dialogue.
      this.dialogue.checkKill(attacker, defender);
      // Player/ally unit defeated — pop a one-beat retreat dialogue in
      // the character's own voice. No permadeath: the fall is reframed
      // as a wounded withdrawal, not a death. Gated so it does NOT fire
      // on a squad wipe (the last unit down is a defeat — "I'll
      // regroup" makes no sense with no squad left). The retreat beat
      // pauses the battle the same way an authored dialogue would; the
      // interpose modal already proves scene.pause() is safe here, mid
      // attack-resolution, on either faction's turn.
      if (
        (defender.faction === "player" || defender.faction === "ally") &&
        this.state.units.some(
          (o) =>
            o !== defender &&
            (o.faction === "player" || o.faction === "ally") &&
            isAlive(o)
        )
      ) {
        this.dialogue.fireAdHoc([
          buildRetreatBeat(defender.portraitId ?? defender.id, defender.name)
        ]);
      }
    }
    // Attack-based trigger fires regardless of kill outcome (hit, miss,
    // OR kill — the kill-specific case above is its own check). Placed
    // outside the defenderKilled block so it runs on every resolved
    // attack, not just lethal ones. Used for character beats keyed on
    // a unit swinging for the first time in this battle.
    this.dialogue.checkAttack(attacker);
    // Phase-two check runs last: the defender may have just refused to
    // die, and the staging pauses the scene behind a dialogue overlay.
    this.stageSecondWinds();
  }

  // Surface an XP gain to the player: brief two-note "ding" + a small
  // golden floater above the attacker's sprite. Pairs with the existing
  // log line (Amar gains 30 XP). Sits at -34px above sprite center so a
  // companion level-up floater (-10px) doesn't overlap it.
  private announceXpGain(unit: Unit, amount: number): void {
    sfxXpGain();
    const view = this.unitViews.get(unit.id);
    if (!view) return;
    const floater = this.addWorld(this.add.text(view.sprite.x, view.sprite.y - TILE_SIZE / 2 - 34, `+${amount} XP`, {
      fontFamily: FAMILY_HEADING,
      fontSize: "12px",
      color: "#fff7c4",
      stroke: "#1a0e04",
      strokeThickness: 3,
      shadow: { offsetX: 0, offsetY: 2, color: "#000", blur: 6, fill: true }
    }).setOrigin(0.5, 1).setDepth(40));
    this.tweens.add({
      targets: floater,
      y: floater.y - 24,
      alpha: 0,
      duration: 1100,
      ease: "Sine.easeOut",
      onComplete: () => floater.destroy()
    });
  }

  // Surface a level-up to the player: a log line and a brief golden floater
  // over the unit's sprite. Stats that didn't roll growths are simply not
  // mentioned — the floater stays compact.
  private announceLevelUp(unit: Unit, report: LevelUpReport): void {
    const view = this.unitViews.get(unit.id);
    const gainedKeys = Object.keys(report.gained) as Array<keyof typeof report.gained>;
    const shorthand: Record<string, string> = {
      hp: "HP", power: "PWR", armor: "ARM", speed: "SPD", movement: "MOV"
    };
    const gainedTags = gainedKeys.map((k) => `+${shorthand[k] ?? k.toUpperCase()}`).join(" ");
    const summary = gainedTags ? ` (${gainedTags})` : "";
    this.pushLog(`${unit.name} reaches level ${report.newLevel}!${summary}`);
    // Analytics — fire one event per level (cascading multi-level XP awards
    // call announceLevelUp once per gained level, so this naturally batches).
    trackCharacterLeveledUp(unit.id, report.newLevel);
    if (view) {
      const floater = this.addWorld(this.add.text(view.sprite.x, view.sprite.y - TILE_SIZE / 2 - 10, `LV ${report.newLevel}`, {
        fontFamily: FAMILY_HEADING,
        fontSize: "14px",
        color: "#fff7c4",
        stroke: "#1a0e04",
        strokeThickness: 3,
        shadow: { offsetX: 0, offsetY: 2, color: "#000", blur: 6, fill: true }
      }).setOrigin(0.5, 1).setDepth(40));
      this.tweens.add({
        targets: floater,
        y: floater.y - 28,
        alpha: 0,
        duration: 1200,
        ease: "Sine.easeOut",
        onComplete: () => floater.destroy()
      });
    }
  }

  private async animateAttack(u: Unit, target: Unit): Promise<void> {
    // Committing action — the move that got us here can no longer be undone.
    this.undoStack.length = 0;
    if (u.faction === "player") this.tutorial?.notify("attacked");
    await this.lunge(u, target);

    // Player path is interpose-aware: roll the attack outcome WITHOUT
    // applying damage so we can pause and ask the player about Interpose
    // when an enemy swing would kill a player unit. AI vs AI / player
    // attacks on enemies skip this and go through the original
    // performAttack path, which is identical to the inline split below
    // minus the modal — kept for the AI test path and to minimize churn.
    const interposeAware = u.faction !== "player" && target.faction === "player";

    if (!interposeAware) {
      const result = performAttack(this.state, u, target);
      u.state.apRemaining -= 1;
      this.applyAttackEffects(u, target, result);
      if (result.crit) await this.delay(90);
      if (result.destructTriggered && result.attackerKilled) {
        const av = this.unitViews.get(u.id);
        if (av) {
          sfxDeath();
          this.playDeathDissolve(av, u, this.unitViews.get(target.id)?.sprite.x);
        }
        this.pushLog(`${target.name}'s last act drags ${u.name} down.`);
      }
      if (result.counterTriggered && result.counterResult) {
        await this.delay(260);
        await this.lunge(target, u);
        this.applyAttackEffects(target, u, result.counterResult);
        if (result.counterResult.crit) await this.delay(90);
      }
      await this.delay(280);
      this.refreshAllUnits();
      this.refreshSidePanel(u);
      this.clearActionButtons();
      this.clearOverlays();
      this.fsm.send({ tag: "ACTION_COMPLETE" });
      if (this.checkEnd()) return;
      if (u.faction !== "player") return;
      this.continueOrEnd(u);
      return;
    }

    // Interpose-aware path. We roll the attack first, then check for
    // interpose, then apply. Counter logic moves out of performAttack and
    // is run inline here because it's contingent on (a) which unit was
    // ACTUALLY hit (interposer or original) and (b) whether the player
    // chose to interpose at all (interpose suppresses the counter — the
    // original defender's strike was deflected by their squadmate).
    const roll = rollAttackOnly(this.state, u, target, false);
    let actualDefender = target;
    let interposed = false;
    if (roll.hit && roll.damage >= target.state.hp) {
      const cands = interposeCandidates(this.state, target, u);
      if (cands.length > 0) {
        const choice = await this.askInterpose(u, target, roll.damage, cands);
        if (choice) {
          actualDefender = choice;
          interposed = true;
        }
      }
    }

    const result = applyAttackOutcome(u, actualDefender, roll);
    u.state.apRemaining -= 1;
    this.applyAttackEffects(u, actualDefender, result, { interposedFrom: interposed ? target : undefined });
    if (result.crit) await this.delay(90);

    // Destruct fires on whoever actually took the killing blow — which
    // means the interposer's Destruct can pull the attacker down even
    // though they weren't the original target. Narratively perfect:
    // "they caught the swing meant for Amar AND took the swordsman with
    // them." Mechanically a fair outcome since the interposer paid the
    // ultimate price.
    if (result.defenderKilled && hasAbility(actualDefender, "Destruct") && isAlive(u)) {
      damageUnit(u, u.state.hp);
      result.destructTriggered = true;
      result.attackerKilled = !isAlive(u);
      if (result.attackerKilled) {
        const av = this.unitViews.get(u.id);
        if (av) {
          sfxDeath();
          this.playDeathDissolve(av, u, this.unitViews.get(actualDefender.id)?.sprite.x);
        }
        this.pushLog(`${actualDefender.name}'s last act drags ${u.name} down.`);
      }
    }

    // Counter — suppressed entirely when an interpose redirect happened.
    // Otherwise mirrors performAttack's counter logic exactly: Ready
    // takes priority over Speed, Ready spends the stance.
    if (
      !interposed
      && result.hit
      && !result.defenderKilled
      && isAlive(actualDefender)
      && isAlive(u)
    ) {
      let counterFired = false;
      if (canTriggerReadyCounter(actualDefender, u, this.state.grid)) {
        await this.delay(260);
        await this.lunge(actualDefender, u);
        const counterRoll = rollAttackOnly(this.state, actualDefender, u, true);
        const counterRes = applyAttackOutcome(actualDefender, u, counterRoll);
        // spendReady, not stance = "none" — from the combined "both"
        // stance this demotes to "defensive", preserving the Defend the
        // unit paid separate AP for (mirrors performAttack in Actions.ts).
        spendReady(actualDefender);
        result.counterTriggered = true;
        result.counterResult = counterRes;
        this.applyAttackEffects(actualDefender, u, counterRes);
        if (counterRes.crit) await this.delay(90);
        counterFired = true;
      }
      if (!counterFired && canTriggerSpeedCounter(actualDefender, u)) {
        await this.delay(260);
        await this.lunge(actualDefender, u);
        const counterRoll = rollAttackOnly(this.state, actualDefender, u, true);
        const counterRes = applyAttackOutcome(actualDefender, u, counterRoll);
        result.counterTriggered = true;
        result.counterResult = counterRes;
        this.applyAttackEffects(actualDefender, u, counterRes);
        if (counterRes.crit) await this.delay(90);
        counterFired = true;
      }
      // Boss phase two — retaliates unconditionally inside weapon reach.
      // Checked last so a Ready counter (which costs AP and hits harder)
      // still wins the slot. Mirrors performAttack in Actions.ts.
      if (!counterFired && canTriggerRelentlessCounter(actualDefender, u)) {
        await this.delay(260);
        await this.lunge(actualDefender, u);
        const counterRoll = rollAttackOnly(this.state, actualDefender, u, true);
        const counterRes = applyAttackOutcome(actualDefender, u, counterRoll);
        result.counterTriggered = true;
        result.counterResult = counterRes;
        this.applyAttackEffects(actualDefender, u, counterRes);
        if (counterRes.crit) await this.delay(90);
      }
    } else if (
      !interposed
      && result.defenderKilled
      && canTriggerReadyCounter(actualDefender, u, this.state.grid)
    ) {
      // Mirror performAttack's "primed corpse" cleanup so any post-mortem
      // UI (autopsy, replay) doesn't show the dead unit still in Ready.
      spendReady(actualDefender);
    }

    await this.delay(280);
    this.refreshAllUnits();
    this.refreshSidePanel(u);
    this.clearActionButtons();
    this.clearOverlays();
    this.fsm.send({ tag: "ACTION_COMPLETE" });
    if (this.checkEnd()) return;
    if (u.faction !== "player") return;
    this.continueOrEnd(u);
  }

  // Pause the battle and run InterposeScene as a modal overlay. Resolves
  // to the chosen interposer Unit, or null if the player declined / let
  // the original blow land. Wraps the callback-style InterposeScene API
  // in a Promise so animateAttack can await the decision inline.
  private askInterpose(
    attacker: Unit,
    defender: Unit,
    incomingDamage: number,
    candidates: Unit[]
  ): Promise<Unit | null> {
    return new Promise((resolve) => {
      const candidatePayload: InterposeCandidate[] = candidates.map((c) => ({
        id: c.id,
        name: c.name,
        portraitId: c.portraitId ?? c.id,
        hp: c.state.hp,
        maxHp: c.stats.hp
      }));
      this.scene.pause();
      this.scene.run("InterposeScene", {
        incomingDamage,
        defenderName: defender.name,
        defenderPortraitId: defender.portraitId ?? defender.id,
        attackerName: attacker.name,
        candidates: candidatePayload,
        resumeKey: this.scene.key,
        onResolve: (interposerId: string | null) => {
          if (!interposerId) {
            resolve(null);
            return;
          }
          const picked = candidates.find((c) => c.id === interposerId) ?? null;
          resolve(picked);
        }
      });
    });
  }

  // ---- Enemy turn ----
  // Caller (beginCurrentTurn) has already sent BEGIN_ENEMY_TURN, so the FSM
  // is in enemyTurn for the entire body of this method. We don't transition
  // out here — endCurrentTurn → beginCurrentTurn handles the END_ENEMY_TURN
  // event when control passes back to a player unit (or BATTLE_END if the
  // battle resolved during an animation).
  private async runEnemyTurn(u: Unit): Promise<void> {
    if (this.fsm.isEnded()) return;
    while (u.state.apRemaining > 0 && isAlive(u)) {
      const plan = planEnemyTurn(this.state, u);
      if (plan.length === 0) break;
      const step = plan[0]!;
      if (step.kind === "move" && step.movePos) {
        await this.animateMove(u, step.movePos);
        // Note: animateMove already decrements AP and may end the turn.
        // But because the enemy is the active unit, control will return after the call.
        if (!isAlive(u) || u.state.apRemaining <= 0) break;
      } else if (step.kind === "attack" && step.targetId) {
        const target = this.state.units.find((x) => x.id === step.targetId);
        if (!target || !isAlive(target)) break;
        await this.animateAttack(u, target);
        if (!isAlive(u) || u.state.apRemaining <= 0) break;
      } else if (step.kind === "ready") {
        enterStance(u, "ready");
        u.state.apRemaining -= 1;
        sfxStance();
        this.pushLog(`${u.name} enters ready stance.`);
        this.refreshUnitView(u);
      } else if (step.kind === "defend") {
        enterStance(u, "defensive");
        u.state.apRemaining -= 1;
        sfxStance();
        this.pushLog(`${u.name} braces.`);
        this.refreshUnitView(u);
      } else {
        break;
      }
      if (this.fsm.isEnded()) return;
    }
    if (this.fsm.isEnded()) return;
    if (this.checkEnd()) return;
    this.endCurrentTurn();
  }

  // Dummy reference to satisfy unused-import linter for executePlan during static check.
  private _unused = executePlan;
}
