import Phaser from "phaser";
import { COLORS, FAMILY_BODY, FAMILY_HEADING, FAMILY_MONO, GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from "../util/constants";
import { ensureBackdropForKey } from "../art/BackdropArt";
import type { BattleId } from "../data/contentIds";
import { ensureTileTexture } from "../art/TileArt";
import { ensureUnitTexture, tileToPixel } from "../art/UnitArt";
import { Grid } from "../combat/Grid";
import { Initiative } from "../combat/Initiative";
import { beginUnitTurn, createUnit, endUnitTurn, hasAbility, isAlive, useItem } from "../combat/Unit";
import { Rng } from "../util/rng";
import { drawPanel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { SettingsButton } from "../ui/SettingsButton";
import { FastForwardButton } from "../ui/FastForwardButton";
import { battleById } from "../data/battles";
import {
  BattleState,
  effectiveMovement,
  enterStance,
  moveUnit,
  performAttack,
  reachableForUnit,
  targetsForUnit,
  unitAt
} from "../combat/Actions";
import { routEnemies, type VictoryCondition } from "../combat/Victory";
import { previewAttack } from "../combat/Damage";
import { counterZoneTiles } from "../combat/Stances";
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
  sfxClick,
  sfxCrit,
  sfxDeath,
  sfxDefeat,
  sfxStance,
  sfxStep,
  sfxVictory,
  sfxXpGain
} from "../audio/Sfx";
import {
  completeBattle,
  getCharacterRecord,
  loadSave,
  setCharacterRecord,
  unlockBattle,
  writeSave
} from "../util/save";
import { BATTLES } from "../data/battles";
import type { TilePos, Unit } from "../combat/types";
import { playUnitState } from "../assets/unitAnim";
import { hasAsset } from "../assets/manifest";
import { BattleFSM } from "./battle/BattleFSM";

interface BattleArgs { battleId: BattleId; }

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
}

const PANEL_W = 280;

// Tooltip copy. Weapon entries cover the triangle math + base hit so a player
// hovering "WPN sword" can see why their numbers shift against a shield-user.
const WEAPON_INFO: Record<string, { title: string; body: string }> = {
  sword:  { title: "Sword",  body: "Beats Spear  (\u00d71.15)\nLoses to Shield (\u00d70.85)\nBase hit 85%   Range 1\nMelee — can counter and be countered." },
  spear:  { title: "Spear",  body: "Beats Shield (\u00d71.15)\nLoses to Sword  (\u00d70.85)\nBase hit 80%   Range 1\nMelee — can counter and be countered." },
  shield: { title: "Shield", body: "Beats Sword  (\u00d71.15)\nLoses to Spear  (\u00d70.85)\nBase hit 80%   Range 1\nDurable — strong with Defend stance." },
  bow:    { title: "Bow",    body: "Range 2 only — outranges all melee.\nCannot Ready stance counter.\nBase hit 75%.\nSafe at distance, weak up close." },
  dactyl: { title: "Dactyl", body: "Mounted melee. Range 1.\nNo weapon-triangle bonus or penalty.\nBase hit 80%.\nFast and resilient — boss-tier mount." }
};

const ABILITY_INFO: Record<string, { title: string; body: string }> = {
  BossFighter: { title: "Boss Fighter", body: "+100% damage when attacking a boss-class enemy.\nThe finisher you build a strategy around." },
  Aide:        { title: "Aide",         body: "Take half damage while adjacent to a friendly unit.\nReward for keeping your line tight." },
  Destruct:    { title: "Destruct",     body: "On death, the unit that landed the killing blow also dies.\nMakes finishing this unit very expensive." },
  Roam:        { title: "Roam",         body: "Once per turn after AP is spent, pay 1 extra AP to make a single Move.\nClosing distance or repositioning out of danger." }
};

// ---- Initiative bar layout ----
// Compact-icon style: portrait stacked above a centered name, no per-box
// stat line (stats live in the side panel). Box dimensions and slot pitch
// drive both the inline bar and the dropdown panel — keep them in sync.
//
// BOX_H was bumped 52 → 64 to give the name area enough vertical room for
// two wrapped lines. Names like "Royal Guard" and "Crown Archer" wrap to
// two lines with the heading-font glyph widths; previously the second line
// rendered below the box border. The companion change is TOP_BAR_HEIGHT
// (70 → 84) so the bar still fits cleanly within the top banner.
const INITIATIVE_BAR_X = 320;       // px from left; clears the goal label
const INITIATIVE_BAR_Y = 14;        // matches container y in create()
const INITIATIVE_BOX_W = 64;
const INITIATIVE_BOX_H = 64;
const INITIATIVE_SLOT_PITCH = 70;   // box width + 6px gap
// How many boxes fit between the bar's start and the right margin. With
// GAME_WIDTH 1280 and bar X 320, that's (1280 - 320 - 16) / 70 ≈ 13. We cap
// at 10 so the bar never visually competes with the side panel; the
// remainder spills into the dropdown.
const INITIATIVE_BAR_MAX_BOXES = 10;
// Top banner height. Sized so INITIATIVE_BAR_Y + INITIATIVE_BOX_H = 78 fits
// inside (with 2px headroom) and the side panel below — which has many
// hard-coded child Y positions anchored to its y=80 origin — sits flush
// with the bar's bottom. If you bump BOX_H further you'll need to push the
// side panel down too, which means touching every absolute y inside it.
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
  private initiative!: Initiative;
  private originX = 0;
  private originY = 0;
  private unitViews = new Map<string, UnitView>();
  private overlayG!: Phaser.GameObjects.Graphics;
  private threatG!: Phaser.GameObjects.Graphics;
  private cursorG!: Phaser.GameObjects.Graphics;
  private actionButtons: Button[] = [];
  private activeUnitText!: Phaser.GameObjects.Text;
  private activeRibbon!: Phaser.GameObjects.Graphics;
  private activeRibbonText!: Phaser.GameObjects.Text;
  private inspectTag!: Phaser.GameObjects.Text;
  private apText!: Phaser.GameObjects.Text;
  private statText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private logLines: string[] = [];
  private initiativeBar!: Phaser.GameObjects.Container;
  // Optional dropdown that expands the full upcoming-turn order when the
  // initiative bar can't show everyone (battles with > INITIATIVE_BAR_MAX_BOXES
  // upcoming turns). Toggled by the "▾ +N" expander cell at the right end of
  // the bar; auto-closes on every refreshInitiativeBar() so it never persists
  // through a stale turn snapshot.
  private initiativeDropdown?: Phaser.GameObjects.Container;
  private initiativeDropdownOpen = false;
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
  // Hover tooltips for weapon and ability rows in the side panel.
  private infoTooltip!: Phaser.GameObjects.Container;
  private wpnZone!: Phaser.GameObjects.Zone;
  private ablZone!: Phaser.GameObjects.Zone;
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

  constructor() { super("BattleScene"); }

  init(data: BattleArgs): void {
    this.battleId = data.battleId;
    this.unitViews = new Map();
    this.actionButtons = [];
    this.logLines = [];
    this.fsm = new BattleFSM();
    this.debug = false;
  }

  create(): void {
    const node = battleById(this.battleId);
    if (!node || !node.map || !node.buildPlayers || !node.buildEnemies) {
      this.scene.start("OverworldScene");
      return;
    }

    // Analytics — pair with trackBattleCompleted in checkEnd() to compute
    // win/loss rates and drop-off per battle.
    trackBattleStarted(this.battleId);

    // Backdrop — see ensureBackdropForKey in BackdropArt.ts. The BackdropKey
    // union and the spec lookup are co-located so a typo'd key fails to compile.
    const bgKey = ensureBackdropForKey(this, node.backdropKey);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    const v = this.add.graphics();
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.45, 0.45, 0.78, 0.78);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const map = node.map;
    const grid = new Grid(map);
    const rng = new Rng(0xc0de ^ (map.id.length * 2654435761) ^ Date.now());

    const players = node.buildPlayers().map((def, i) =>
      createUnit(def, map.startPositions.player[i] ?? { x: 0, y: 0 })
    );
    const enemies = node.buildEnemies().map((def, i) =>
      createUnit(def, map.startPositions.enemy[i] ?? { x: 0, y: 0 })
    );

    // Hydrate player units from the save slot. Characters with a saved
    // record have their level / xp / current stats / post-promotion class
    // restored from disk; first-time appearances use the factory baseline,
    // and the catch-up rule fast-forwards veterans (e.g., Selene rejoining
    // at L10 when the squad average has reached L13). See Progression.ts
    // and docs/RAVAGE_DESIGN.md §4.
    const save = loadSave();
    const squadAvg = squadAverageLevel(players);
    for (const p of players) {
      const rec = getCharacterRecord(save, p.id);
      if (rec) {
        p.level = rec.level;
        p.state.xp = rec.xp;
        p.stats = { ...rec.stats };
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
          // eslint-disable-next-line no-console
          if (import.meta.env.DEV) console.info(`[Progression] ${p.name} catches up: +${gained} levels (now L${p.level})`);
        }
      }
    }

    enemies.forEach((e) => (e.state.facingX = -1));
    players.forEach((p) => (p.state.facingX = 1));
    const units: Unit[] = [...players, ...enemies];
    this.state = { units, grid, rng };

    // Win/lose rule. Most battles use the default "rout all enemies"; battles
    // that override .victory in their BattleNode (defense, escort, escape,
    // boss-only kills) set a custom condition that drives both checkEnd()
    // and the goal label in the HUD.
    this.victory = node.victory ?? routEnemies;

    this.initiative = new Initiative();
    this.initiative.reseed(units);

    // Layout
    const playW = GAME_WIDTH - PANEL_W - 40;
    const playH = GAME_HEIGHT - MAP_TOP_OFFSET - 40;
    this.originX = 20 + Math.floor((playW - map.width * TILE_SIZE) / 2);
    this.originY = MAP_TOP_OFFSET + Math.floor((playH - map.height * TILE_SIZE) / 2);

    // Tiles
    const tileSeed = map.id.length * 31 + 7;
    for (let y = 0; y < map.height; y++) {
      for (let x = 0; x < map.width; x++) {
        const tile = grid.tileAt({ x, y });
        const key = ensureTileTexture(this, tile.terrain, tile.obstacle, tileSeed + (x * 73 + y * 131));
        const px = tileToPixel({ x, y }, this.originX, this.originY);
        this.add.image(px.x, px.y, key).setDisplaySize(TILE_SIZE, TILE_SIZE);
      }
    }

    this.overlayG = this.add.graphics();
    this.threatG = this.add.graphics();
    this.activeRing = this.add.graphics();
    this.cursorG = this.add.graphics();
    this.activeArrow = this.add.text(0, 0, "\u25BC", {
      fontFamily: "Arial, sans-serif",
      fontSize: "20px",
      color: "#ffd45a",
      stroke: "#000",
      strokeThickness: 3
    }).setOrigin(0.5, 1).setVisible(false);

    // Units
    for (const u of units) {
      const tex = ensureUnitTexture(this, u);
      const px = tileToPixel(u.state.position, this.originX, this.originY);
      const baseY = px.y - 4;
      // Cast-shadow first so the sprite is drawn on top of it.
      const shadow = this.add.ellipse(px.x, baseY + 24, 33, 10, 0x000000, 0.42);
      const sprite = this.add.sprite(px.x, baseY, tex).setDisplaySize(44, 55);
      if (u.faction === "enemy") sprite.setFlipX(true);
      const hpBg = this.add.graphics();
      const hpBar = this.add.graphics();
      const stanceIcon = this.add.text(px.x, px.y - TILE_SIZE / 2 + 2, "", {
        fontFamily: FAMILY_HEADING,
        fontSize: "12px",
        color: "#ffd45a",
        stroke: "#000",
        strokeThickness: 2
      }).setOrigin(0.5, 0);
      const view: UnitView = { unit: u, sprite, shadow, baseY, hpBg, hpBar, stanceIcon };
      this.unitViews.set(u.id, view);
      this.refreshUnitView(u);
      playUnitState(this, sprite, u, "idle");
      this.startBreathing(view);
    }

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
    this.goalText = this.add.text(16, 46, `Goal: ${this.victory.label}`, {
      fontFamily: FAMILY_BODY,
      fontSize: "12px",
      color: "#c9b07a"
    });
    // Initiative bar is pushed right of the goal text so the goal stays
    // legible. INITIATIVE_BAR_X needs to clear the longest goal label —
    // currently "Goal: Survive 4 rounds or Defeat all enemies" at ~280px.
    // 320px gives a safe margin and still leaves room for ~13 boxes before
    // the right edge.
    this.initiativeBar = this.add.container(INITIATIVE_BAR_X, 14);

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
    // Stat block can grow to 7 lines (HP / PWR-ARM / SPD-MOV / WPN / STN / ABL
    // / INV) ≈ 119px starting at y=272, ending near y=391. Leave breathing room.
    this.add.text(px, 408, "ACTIONS", {
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

    // Hover zones over the WPN and ABL rows of statText. Position is recomputed
    // in refreshSidePanel() each time the panel updates.
    this.wpnZone = this.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive();
    this.ablZone = this.add.zone(0, 0, 1, 1).setOrigin(0, 0).setInteractive();
    this.wpnZone.on("pointerover", () => this.showInfoFor("weapon"));
    this.wpnZone.on("pointerout", () => this.infoTooltip.setVisible(false));
    this.ablZone.on("pointerover", () => this.showInfoFor("ability"));
    this.ablZone.on("pointerout", () => this.infoTooltip.setVisible(false));
    // Hidden until a unit is selected.
    this.wpnZone.disableInteractive();
    this.ablZone.disableInteractive();

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

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.handlePointerDown(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.handlePointerMove(p));

    getMusic(this).play(node.music, { fadeMs: 800 });
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

    this.pushLog(`${node.subtitle} begins.`);
    this.refreshInitiativeBar();
    this.beginCurrentTurn();
  }

  // ---- Helpers ----
  private screenToTile(px: number, py: number): TilePos | null {
    const x = Math.floor((px - this.originX) / TILE_SIZE);
    const y = Math.floor((py - this.originY) / TILE_SIZE);
    if (x < 0 || y < 0 || x >= this.state.grid.width || y >= this.state.grid.height) return null;
    return { x, y };
  }

  private refreshUnitView(u: Unit): void {
    const v = this.unitViews.get(u.id);
    if (!v) return;
    const px = tileToPixel(u.state.position, this.originX, this.originY);
    v.sprite.setPosition(px.x, px.y - 4);
    v.sprite.setVisible(isAlive(u));
    v.sprite.setFlipX(u.state.facingX === -1);
    v.hpBg.clear();
    v.hpBar.clear();
    if (!isAlive(u)) {
      v.stanceIcon.setText("");
      return;
    }
    const barW = 36;
    const barH = 4;
    const bx = px.x - barW / 2;
    const by = px.y + TILE_SIZE / 2 - 8;
    v.hpBg.fillStyle(0x000000, 0.7);
    v.hpBg.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
    const ratio = Math.max(0, u.state.hp / u.stats.hp);
    const color = u.faction === "player" ? 0x6db2ff : 0xd05a4a;
    v.hpBar.fillStyle(0x2a2a36, 1);
    v.hpBar.fillRect(bx, by, barW, barH);
    v.hpBar.fillStyle(color, 1);
    v.hpBar.fillRect(bx, by, Math.max(0, Math.floor(barW * ratio)), barH);
    v.stanceIcon.setPosition(px.x, by - 14);
    v.stanceIcon.setText(u.state.stance === "ready" ? "▲" : u.state.stance === "defensive" ? "◆" : "");
    v.stanceIcon.setColor(u.state.stance === "ready" ? "#ffd45a" : "#8ad6ff");
  }

  private refreshAllUnits(): void {
    for (const u of this.state.units) this.refreshUnitView(u);
    const cur = this.initiative.current();
    if (cur) this.drawActiveMarker(cur);
  }

  private refreshInitiativeBar(): void {
    this.initiativeBar.removeAll(true);
    // Always close the dropdown on a refresh \u2014 initiative state has just
    // changed, so a stale snapshot would mislead.
    this.closeInitiativeDropdown();

    // Pull enough upcoming turns to cover every alive unit, then dedupe by
    // unit id. Initiative.upcoming() cycles virtually into the NEXT round
    // when asked for more turns than there are alive units, which surfaces
    // the same character twice (once for end-of-this-round and once for
    // start-of-next). The bar/dropdown should only ever show distinct
    // characters \u2014 no one wants to see "Lucian, Lucian" in the lineup.
    const raw = this.initiative.upcoming(this.state.units, 32);
    const seen = new Set<string>();
    const distinct: Unit[] = [];
    for (const u of raw) {
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      distinct.push(u);
    }

    const willOverflow = distinct.length > INITIATIVE_BAR_MAX_BOXES;
    // Reserve the last slot for the expander when overflow exists.
    const visibleCount = willOverflow
      ? INITIATIVE_BAR_MAX_BOXES - 1
      : Math.min(distinct.length, INITIATIVE_BAR_MAX_BOXES);
    const visible = distinct.slice(0, visibleCount);
    // Dropdown shows ONLY what the bar can't fit. Previously this passed
    // the entire upcoming list, which (a) duplicated everything already
    // visible inline and (b) inherited the same cycle-duplicate problem.
    const overflow = willOverflow ? distinct.slice(visibleCount) : [];

    visible.forEach((u, i) => {
      const x = i * INITIATIVE_SLOT_PITCH;
      const isActive = i === 0;
      const cell = this.buildInitiativeCell(x, 0, u, isActive);
      this.initiativeBar.add(cell);
    });

    if (willOverflow) {
      const x = visibleCount * INITIATIVE_SLOT_PITCH;
      const expander = this.buildInitiativeExpander(x, 0, overflow.length, overflow);
      this.initiativeBar.add(expander);
    }

    this.roundText.setText(`Round ${this.initiative.round}`);
  }

  // Builds a single compact initiative cell: tinted background, faction-
  // mirrored portrait centered on top, and a centered name underneath. No
  // stat line \u2014 speed/HP/etc. live in the side panel for the active unit.
  // The active cell (first in the upcoming list) gets a brighter border and
  // text color so the player can spot whose turn is next at a glance.
  private buildInitiativeCell(
    offsetX: number,
    offsetY: number,
    u: Unit,
    isActive: boolean
  ): Phaser.GameObjects.GameObject[] {
    const bg = this.add.graphics();
    const fill = u.faction === "player" ? 0x1a3554 : 0x4a1a1a;
    bg.fillStyle(fill, 0.85);
    bg.fillRect(offsetX, offsetY, INITIATIVE_BOX_W, INITIATIVE_BOX_H);
    bg.lineStyle(1, isActive ? COLORS.goldBright : COLORS.gold, isActive ? 1 : 0.5);
    bg.strokeRect(offsetX + 0.5, offsetY + 0.5, INITIATIVE_BOX_W - 1, INITIATIVE_BOX_H - 1);

    const tex = ensureUnitTexture(this, u);
    // Portrait stacked on top, centered horizontally. 28\u00d730 leaves room for
    // the name below within the 52px box height.
    const portrait = this.add.image(offsetX + INITIATIVE_BOX_W / 2, offsetY + 4, tex)
      .setOrigin(0.5, 0)
      .setDisplaySize(28, 30);
    if (u.faction === "enemy") portrait.setFlipX(true);

    // Name centered under the portrait. wordWrap to box width minus 4px
    // padding so long names wrap to a 2nd line instead of bleeding past the
    // border. useAdvancedWrap: true allows mid-word breaks for hypothetical
    // single-token names that exceed the line width (e.g., "Banditspearton"
    // with no space) — defensive against future unit names. setOrigin(0.5, 0)
    // anchors at the top-center for clean vertical stacking under the portrait.
    const name = this.add.text(offsetX + INITIATIVE_BOX_W / 2, offsetY + 36, u.name, {
      fontFamily: FAMILY_HEADING,
      fontSize: "10px",
      color: isActive ? "#fff7c4" : "#dccfa8",
      align: "center",
      wordWrap: { width: INITIATIVE_BOX_W - 4, useAdvancedWrap: true }
    }).setOrigin(0.5, 0);

    return [bg, portrait, name];
  }

  // Builds the expander cell at the right end of the bar. Visually styled
  // like a regular cell but neutral (gold border, black fill) and labeled
  // "\u25be +N" where N is the count of units not shown inline. Clicking opens
  // the dropdown that lists all upcoming units.
  private buildInitiativeExpander(
    offsetX: number,
    offsetY: number,
    overflowCount: number,
    fullUpcoming: Unit[]
  ): Phaser.GameObjects.GameObject[] {
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(offsetX, offsetY, INITIATIVE_BOX_W, INITIATIVE_BOX_H);
    bg.lineStyle(1, COLORS.gold, 0.6);
    bg.strokeRect(offsetX + 0.5, offsetY + 0.5, INITIATIVE_BOX_W - 1, INITIATIVE_BOX_H - 1);

    const arrow = this.add.text(offsetX + INITIATIVE_BOX_W / 2, offsetY + 8, "\u25be", {
      fontFamily: FAMILY_HEADING,
      fontSize: "20px",
      color: "#f4d999"
    }).setOrigin(0.5, 0);

    const label = this.add.text(offsetX + INITIATIVE_BOX_W / 2, offsetY + 32, `+${overflowCount} more`, {
      fontFamily: FAMILY_BODY,
      fontSize: "10px",
      color: "#dccfa8",
      align: "center"
    }).setOrigin(0.5, 0);

    // Hit zone covers the full cell. Created as a child of the container
    // (initiativeBar) so its hit testing uses the bar's world position.
    const hit = this.add.zone(offsetX, offsetY, INITIATIVE_BOX_W, INITIATIVE_BOX_H)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerover", () => bg.clear()
      .fillStyle(0x1a1a1a, 0.85).fillRect(offsetX, offsetY, INITIATIVE_BOX_W, INITIATIVE_BOX_H)
      .lineStyle(1, COLORS.goldBright, 1).strokeRect(offsetX + 0.5, offsetY + 0.5, INITIATIVE_BOX_W - 1, INITIATIVE_BOX_H - 1));
    hit.on("pointerout", () => bg.clear()
      .fillStyle(0x000000, 0.7).fillRect(offsetX, offsetY, INITIATIVE_BOX_W, INITIATIVE_BOX_H)
      .lineStyle(1, COLORS.gold, 0.6).strokeRect(offsetX + 0.5, offsetY + 0.5, INITIATIVE_BOX_W - 1, INITIATIVE_BOX_H - 1));
    hit.on("pointerdown", () => this.toggleInitiativeDropdown(fullUpcoming));

    return [bg, arrow, label, hit];
  }

  // Toggle / open / close the initiative dropdown panel. The panel is a
  // grid of compact cells (same style as the bar) showing the full upcoming
  // turn order. Lives at depth 30 so it overlays the action button block
  // underneath. Auto-closes whenever refreshInitiativeBar() runs.
  private toggleInitiativeDropdown(upcoming: Unit[]): void {
    if (this.initiativeDropdownOpen) {
      this.closeInitiativeDropdown();
    } else {
      this.openInitiativeDropdown(upcoming);
    }
  }

  private openInitiativeDropdown(upcoming: Unit[]): void {
    this.closeInitiativeDropdown();
    const cols = INITIATIVE_BAR_MAX_BOXES; // grid width matches the bar
    const rows = Math.ceil(upcoming.length / cols);
    const panelPad = 10;
    const panelW = cols * INITIATIVE_SLOT_PITCH - (INITIATIVE_SLOT_PITCH - INITIATIVE_BOX_W) + panelPad * 2;
    const panelH = rows * (INITIATIVE_BOX_H + 8) + panelPad * 2;
    const panelX = INITIATIVE_BAR_X - panelPad;
    const panelY = INITIATIVE_BAR_Y + INITIATIVE_BOX_H + 8;

    this.initiativeDropdown = this.add.container(panelX, panelY).setDepth(30);

    const bg = this.add.graphics();
    bg.fillStyle(0x05060a, 0.96);
    bg.fillRect(0, 0, panelW, panelH);
    bg.lineStyle(1, COLORS.gold, 0.8);
    bg.strokeRect(0.5, 0.5, panelW - 1, panelH - 1);
    this.initiativeDropdown.add(bg);

    upcoming.forEach((u, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = panelPad + c * INITIATIVE_SLOT_PITCH;
      const y = panelPad + r * (INITIATIVE_BOX_H + 8);
      // The dropdown now shows OVERFLOW only — the active turn is always in
      // the bar, never here. So no cell in the dropdown gets active styling.
      const cell = this.buildInitiativeCell(x, y, u, false);
      this.initiativeDropdown!.add(cell);
    });

    this.initiativeDropdownOpen = true;
  }

  private closeInitiativeDropdown(): void {
    if (this.initiativeDropdown) {
      this.initiativeDropdown.destroy();
      this.initiativeDropdown = undefined;
    }
    this.initiativeDropdownOpen = false;
  }

  private pushLog(msg: string): void {
    this.logLines.push(msg);
    if (this.logLines.length > 7) this.logLines.shift();
    this.logText.setText(this.logLines.join("\n"));
  }

  private refreshDebug(): void {
    if (!this.debug) {
      this.debugText.setText("");
      return;
    }
    const u = this.initiative.current();
    if (!u) return;
    this.debugText.setText(
      `[debug] round=${this.initiative.round}  active=${u.id}  ap=${u.state.apRemaining}/${u.stats.ap}  pos=${u.state.position.x},${u.state.position.y}  alive=${isAlive(u)}`
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
    beginUnitTurn(u);
    this.inspectedUnitId = null;
    this.inspectTag.setText("");
    this.activeUnitText.setText(u.name);
    this.refreshSidePanel(u);
    this.refreshInitiativeBar();
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
      if (u.faction === "player" && isAlive(u)) {
        // Coming off an enemy phase: drop back to idle before unlocking input.
        if (this.fsm.current().tag === "enemyTurn") {
          this.fsm.send({ tag: "END_ENEMY_TURN" });
        }
        this.buildActionButtons(u);
      } else {
        // Enter enemyTurn before kicking off the AI loop so any tile click
        // arriving during the 450ms grace window is properly blocked.
        this.fsm.send({ tag: "BEGIN_ENEMY_TURN" });
        this.time.delayedCall(450, () => this.runEnemyTurn(u));
      }
    };
    if (isNewPhase) this.showPhaseBanner(u.faction, startTurn);
    else startTurn();
  }

  private lastActorFaction: Unit["faction"] | null = null;

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
    this.activeArrow.setPosition(px, py - 28);
    this.activeArrow.setVisible(true);
    this.activeArrowTween = this.tweens.add({
      targets: this.activeArrow,
      y: py - 22,
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

    const tex = this.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const srcW = tex.width || 1024;
    const srcH = tex.height || 1536;
    // Scale the portrait modestly wider than the circle. Less zoom than before
    // (1.5× vs 1.95×) means the whole head — crown to chin — lands inside the
    // circle even when the character's head sits slightly off-center in the
    // source. Then pull the image up so the face center lands on the circle's
    // vertical center. Our portraits put the eye-line at roughly y=22% of the
    // source height (per public/assets/portraits/README.md), so the face midline
    // is around 24% down.
    const displayW = size * 1.5;
    const displayH = displayW * (srcH / srcW);
    const headCenterFromTop = displayH * 0.24;

    const img = this.add.image(cx, cy - headCenterFromTop, key)
      .setOrigin(0.5, 0)
      .setDisplaySize(displayW, displayH)
      .setDepth(2);

    const maskG = this.make.graphics({ x: 0, y: 0 }, false);
    maskG.fillStyle(0xffffff);
    maskG.fillCircle(cx, cy, size / 2);
    img.setMask(maskG.createGeometryMask());

    const ring = this.add.graphics().setDepth(3);
    ring.lineStyle(2, COLORS.gold, 0.92);
    ring.strokeCircle(cx, cy, size / 2 + 1);
    ring.lineStyle(1, 0x000000, 0.5);
    ring.strokeCircle(cx, cy, size / 2 + 3);

    this.avatarImg = img;
    this.avatarMaskG = maskG;
    this.avatarRing = ring;
  }

  private refreshSidePanel(u: Unit): void {
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
      `LV ${u.level}${xpSuffix}  ·  AP ${u.state.apRemaining}/${u.stats.ap}  ·  ${u.faction.toUpperCase()}`
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
      lines.push(`ABL  ${u.abilities.join(", ")}`);
    }
    if (u.state.inventory.length > 0) {
      lines.push(`INV  ${u.state.inventory.map((it) => it.name).join(", ")}`);
    }
    this.statText.setText(lines.join("\n"));
    this.panelUnit = u;
    // Position the hover zones over the WPN and (optional) ABL rows. Use the
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
      this.infoTooltip.setVisible(false);
    }
    this.refreshActiveRibbon(u);
  }

  // Shows the info tooltip anchored to the LEFT of the side panel, aligned
  // with whichever row the player is hovering. Content comes from the static
  // WEAPON_INFO / ABILITY_INFO tables at the top of this file.
  private showInfoFor(kind: "weapon" | "ability"): void {
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
    } else {
      if (!u.abilities || u.abilities.length === 0) return;
      const blocks = u.abilities
        .map((a) => ABILITY_INFO[a])
        .filter((info): info is { title: string; body: string } => Boolean(info))
        .map((info) => `${info.title}\n${info.body}`);
      title.setText(u.abilities.length === 1 ? (ABILITY_INFO[u.abilities[0]!]?.title ?? "Ability") : "Abilities");
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
    const zone = kind === "weapon" ? this.wpnZone : this.ablZone;
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
    const cur = this.initiative.current();
    if (cur) endUnitTurn(cur);
    this.clearActionButtons();
    this.clearOverlays();
    // Advance BEFORE evaluating victory so round-based conditions
    // (surviveRounds, protectUnit) see the new round counter on the same
    // tick the player crosses the threshold. The rout/defeat-unit checks
    // are state-only and don't care about ordering.
    this.initiative.advance(this.state.units);
    if (this.checkEnd()) return;
    this.beginCurrentTurn();
  }

  private checkEnd(): boolean {
    const v = this.victory.evaluate({ state: this.state, round: this.initiative.round });
    if (!v) return false;
    this.fsm.send({ tag: "BATTLE_END" });
    if (v === "player") sfxVictory();
    else sfxDefeat();
    let save = loadSave();
    if (v === "player") {
      save = completeBattle(save, this.battleId);
      // unlock next BATTLE in sequence
      const nodeIdx = BATTLES.findIndex((b) => b.id === this.battleId);
      if (nodeIdx >= 0 && nodeIdx + 1 < BATTLES.length) {
        save = unlockBattle(save, BATTLES[nodeIdx + 1]!.id);
      }
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
    // Analytics — capture outcome + duration so we can see pacing issues
    // (e.g., a battle averaging 12+ rounds is probably overlong).
    trackBattleCompleted(this.battleId, v === "player" ? "victory" : "defeat", this.initiative.round);
    getMusic(this).stop(650);
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("EndScene", { battleId: this.battleId, outcome: v });
    });
    return true;
  }

  // ---- Action buttons ----
  private clearActionButtons(): void {
    for (const b of this.actionButtons) b.destroy();
    this.actionButtons = [];
  }

  private buildActionButtons(u: Unit): void {
    const px = GAME_WIDTH - PANEL_W;
    const top = 426;             // sits just under the ACTIONS label at y=408
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
        this.actionButtons.push(new Button(this, {
          x: px, y, w: colW, h,
          label: left.label, primary: left.primary, enabled: left.enabled,
          fontSize: 12, onClick: left.onClick
        }));
      }
      if (right) {
        this.actionButtons.push(new Button(this, {
          x: px + colW + colGap, y, w: colW, h,
          label: right.label, primary: right.primary, enabled: right.enabled,
          fontSize: 12, onClick: right.onClick
        }));
      }
      row++;
    };
    const placeFull = (label: string, primary: boolean, enabled: boolean, onClick: () => void): void => {
      const y = top + row * (h + rowGap);
      this.actionButtons.push(new Button(this, {
        x: px, y, w: fullW, h,
        label, primary, enabled, fontSize: 13, onClick
      }));
      row++;
    };

    const hasAP = u.state.apRemaining >= 1;
    const canMove = hasAP && reachableForUnit(this.state, u).length > 0;
    const canAttack = hasAP && targetsForUnit(this.state, u).length > 0;
    const hasPotion = u.state.inventory.some((it) => it.kind === "potion");
    const canPotion = hasAP && hasPotion && u.state.hp < u.stats.hp;
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
      { label: "Ready  1AP",  primary: false, enabled: hasAP, onClick: () => this.applyStance(u, "ready") },
      { label: "Defend  1AP", primary: false, enabled: hasAP, onClick: () => this.applyStance(u, "defensive") }
    );
    placeRow(
      { label: "Potion  1AP", primary: false, enabled: canPotion, onClick: () => this.useFirstPotion(u) },
      canRoam ? { label: "Roam (free)", primary: false, enabled: true, onClick: () => this.enterRoamMode(u) } : null
    );
    placeFull("End Turn", false, true, () => { sfxClick(); this.endCurrentTurn(); });
  }

  // After a player action consumes AP, decide whether to keep showing buttons
  // or auto-end the turn. Roam units get to see their free-move offer at AP=0.
  private continueOrEnd(u: Unit): void {
    if (!isAlive(u)) { this.endCurrentTurn(); return; }
    const hasRoamLeft = hasAbility(u, "Roam") && !u.state.roamUsedThisTurn;
    if (u.state.apRemaining > 0 || hasRoamLeft) this.buildActionButtons(u);
    else this.endCurrentTurn();
  }

  private useFirstPotion(u: Unit): void {
    const item = u.state.inventory.find((it) => it.kind === "potion");
    if (!item) return;
    sfxClick();
    const result = useItem(u, item.id);
    if (!result.ok) return;
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
    sfxStance();
    enterStance(u, stance);
    u.state.apRemaining -= 1;
    this.pushLog(`${u.name} enters ${stance} stance.`);
    this.refreshUnitView(u);
    this.refreshSidePanel(u);
    this.clearActionButtons();
    this.continueOrEnd(u);
  }

  private clearOverlays(): void {
    this.overlayG.clear();
    this.threatG.clear();
    this.cursorG.clear();
    this.hoverPreview.setVisible(false);
  }

  private drawOverlay(): void {
    this.overlayG.clear();
    this.threatG.clear();
    const state = this.fsm.current();
    if (state.tag === "move" || state.tag === "roam") {
      const tint = state.tag === "roam" ? 0xffd45a : COLORS.moveTile;
      const fillA = state.tag === "roam" ? 0.32 : 0.28;
      this.overlayG.fillStyle(tint, fillA);
      for (const t of state.tiles) {
        const px = tileToPixel(t, this.originX, this.originY);
        this.overlayG.fillRect(px.x - TILE_SIZE / 2, px.y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
      }
      this.overlayG.lineStyle(1, tint, 0.85);
      for (const t of state.tiles) {
        const px = tileToPixel(t, this.originX, this.originY);
        this.overlayG.strokeRect(px.x - TILE_SIZE / 2 + 0.5, px.y - TILE_SIZE / 2 + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      }
    } else if (state.tag === "attack") {
      this.overlayG.fillStyle(COLORS.attackTile, 0.32);
      this.overlayG.lineStyle(1, COLORS.attackTile, 0.9);
      for (const t of state.targets) {
        const px = tileToPixel(t.state.position, this.originX, this.originY);
        this.overlayG.fillRect(px.x - TILE_SIZE / 2, px.y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
        this.overlayG.strokeRect(px.x - TILE_SIZE / 2 + 0.5, px.y - TILE_SIZE / 2 + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      }
    }
    // Always show enemy ready threat zones
    this.threatG.fillStyle(COLORS.threat, 0.16);
    this.threatG.lineStyle(1, COLORS.threat, 0.5);
    for (const u of this.state.units) {
      if (!isAlive(u) || u.faction === "player") continue;
      if (u.state.stance !== "ready") continue;
      for (const z of counterZoneTiles(u)) {
        if (z.x < 0 || z.y < 0 || z.x >= this.state.grid.width || z.y >= this.state.grid.height) continue;
        const px = tileToPixel(z, this.originX, this.originY);
        this.threatG.fillRect(px.x - TILE_SIZE / 2, px.y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // ---- Pointer handlers ----
  private handlePointerDown(p: Phaser.Input.Pointer): void {
    if (this.fsm.isInputBlocked()) return;
    const u = this.initiative.current();
    if (!u || u.faction !== "player") return;
    const tile = this.screenToTile(p.x, p.y);
    if (!tile) return;
    const fsmState = this.fsm.current();
    if (fsmState.tag === "move" || fsmState.tag === "roam") {
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

  private handlePointerMove(p: Phaser.Input.Pointer): void {
    if (this.fsm.isEnded()) return;
    const tile = this.screenToTile(p.x, p.y);
    if (!tile) {
      this.cursorG.clear();
      this.hoverPreview.setVisible(false);
      return;
    }
    this.cursorG.clear();
    const px = tileToPixel(tile, this.originX, this.originY);
    this.cursorG.lineStyle(1, COLORS.hover, 0.9);
    this.cursorG.strokeRect(px.x - TILE_SIZE / 2 + 0.5, px.y - TILE_SIZE / 2 + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);

    const fsmState = this.fsm.current();
    if (fsmState.tag === "attack") {
      const u = this.initiative.current();
      const target = u && fsmState.targets.find((t) => t.state.position.x === tile.x && t.state.position.y === tile.y);
      if (u && target) {
        const tileDef = this.state.grid.tileAt(target.state.position);
        const pre = previewAttack(u, target, tileDef, false, this.state.units);
        const txt = this.hoverPreview.getData("txt") as Phaser.GameObjects.Text;
        txt.setText(
          [
            `${u.name} → ${target.name}`,
            `Damage  ${pre.damage}`,
            `Hit     ${pre.hitRate}%`,
            `Crit    ${pre.critRate}%`,
            `Wpn x${pre.weaponMod.toFixed(2)}`,
            `Trn x${pre.terrainMod.toFixed(2)}  Stn x${pre.stanceMod.toFixed(2)}`
          ].join("\n")
        );
        const hx = Math.min(px.x + 30, GAME_WIDTH - PANEL_W - 230);
        const hy = Math.min(px.y - 16, GAME_HEIGHT - 110);
        this.hoverPreview.setPosition(hx, hy).setVisible(true);
      } else {
        this.hoverPreview.setVisible(false);
      }
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
  private startBreathing(view: UnitView): void {
    view.breathTween?.stop();
    view.sprite.y = view.baseY;
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
    view.breathTween?.stop();
    view.breathTween = undefined;
    view.sprite.y = view.baseY;
  }

  // Three small puffs at the unit's foot — fan upward + outward, fade out.
  // Sells the push-off without spamming particles per step.
  private spawnDust(x: number, y: number): void {
    for (let i = 0; i < 3; i++) {
      const dir = (i - 1) * 0.7; // -0.7, 0, +0.7 radians of horizontal spread
      const dist = 10 + Math.random() * 6;
      const puff = this.add.circle(x, y, 2.5 + Math.random() * 1.5, 0xc9b07a, 0.55);
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
    moveUnit(this.state, u, dest);
    const view = this.unitViews.get(u.id);
    if (!view) {
      this.fsm.send({ tag: "ACTION_COMPLETE" });
      return;
    }
    let prev: TilePos = startTile;
    playUnitState(this, view.sprite, u, "walk");
    // Pause idle breathing for the duration of the walk so it doesn't fight
    // with the per-step y tween. Restarted on the final step.
    this.stopBreathing(view);
    // Push-off dust at the starting tile's foot position.
    this.spawnDust(view.sprite.x, view.baseY + 22);
    // Walk the visual sprite along path
    let lastY = view.baseY;
    const isActive = this.initiative.current() === u;
    for (const step of path) {
      const dx = step.x - prev.x;
      if (dx !== 0) {
        u.state.facingX = dx > 0 ? 1 : -1;
        view.sprite.setFlipX(u.state.facingX === -1);
      }
      const px = tileToPixel(step, this.originX, this.originY);
      lastY = px.y - 4;
      sfxStep();
      // Shadow tweens in parallel — same x as the sprite, but its own y so
      // it stays planted at foot height (baseY + 22) rather than the sprite's
      // chest level.
      this.tweens.add({
        targets: view.shadow,
        x: px.x,
        y: lastY + 22,
        duration: 110,
        ease: "Sine.easeInOut"
      });
      await new Promise<void>((res) => {
        this.tweens.add({
          targets: view.sprite,
          x: px.x,
          y: lastY,
          duration: 110,
          ease: "Sine.easeInOut",
          onUpdate: () => { if (isActive) this.followActiveMarker(u); },
          onComplete: () => res()
        });
      });
      prev = step;
    }
    view.baseY = lastY;
    playUnitState(this, view.sprite, u, "idle");
    this.startBreathing(view);
    u.state.apRemaining -= 1;
    this.pushLog(`${u.name} moves.`);
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

  private flashSprite(s: Phaser.GameObjects.Sprite, color: number): void {
    s.setTintFill(color);
    this.time.delayedCall(120, () => s.clearTint());
  }

  private spawnDamageNumber(x: number, y: number, text: string, color: number): void {
    const t = this.add.text(x, y - 12, text, {
      fontFamily: FAMILY_HEADING,
      fontSize: "16px",
      color: `#${color.toString(16).padStart(6, "0")}`,
      stroke: "#000",
      strokeThickness: 3
    }).setOrigin(0.5);
    this.tweens.add({
      targets: t,
      y: y - 36,
      alpha: 0,
      duration: 700,
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
    // Shadow only follows the horizontal lunge — the body leans in but feet
    // stay on the same tile.
    this.tweens.add({
      targets: av.shadow,
      x: sx + (tx - sx) * 0.32,
      duration: 130,
      ease: "Cubic.easeOut",
      yoyo: true
    });
    return new Promise((res) => {
      this.tweens.add({
        targets: av.sprite,
        x: sx + (tx - sx) * 0.32,
        y: sy + (ty - sy) * 0.32,
        duration: 130,
        ease: "Cubic.easeOut",
        yoyo: true,
        onComplete: () => {
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
    result: { hit: boolean; crit: boolean; damage: number; defenderKilled: boolean }
  ): void {
    const tv = this.unitViews.get(defender.id);
    const av = this.unitViews.get(attacker.id);
    if (!tv || !av) return;
    const tx = tv.sprite.x;
    const ty = tv.sprite.y;
    if (result.hit) {
      if (result.crit) {
        sfxCrit();
        // Crit kicker: short camera shake to sell the impact. The hit-pause
        // (a brief scene-wide freeze) is sequenced in animateAttack so it
        // doesn't fight with this frame's tweens.
        this.cameras.main.shake(180, 0.012);
      } else {
        sfxAttackHit();
      }
      // Crisp white impact flash — reads instantly as "got hit", regardless
      // of unit palette. Red tint blended in with enemy reds before.
      this.flashSprite(tv.sprite, 0xffffff);
      playUnitState(this, tv.sprite, defender, "hit");
      this.spawnDamageNumber(tx, ty, result.crit ? `CRIT ${result.damage}` : `${result.damage}`, result.crit ? 0xffd45a : 0xff8a8a);
      this.pushLog(`${attacker.name} hits ${defender.name} for ${result.damage}${result.crit ? " (crit!)" : ""}.`);
    } else {
      sfxAttackMiss();
      this.spawnDamageNumber(tx, ty, "MISS", 0xc0c5cf);
      this.pushLog(`${attacker.name} misses ${defender.name}.`);
    }
    this.refreshUnitView(defender);
    if (result.defenderKilled) {
      sfxDeath();
      this.pushLog(`${defender.name} falls.`);
      playUnitState(this, tv.sprite, defender, "death");
      this.stopBreathing(tv);
      this.tweens.add({
        targets: tv.sprite,
        alpha: 0.18,
        angle: 90,
        duration: 420
      });
      // Shadow shrinks and fades with the body so the corpse doesn't sit on
      // a still-vivid black puddle.
      this.tweens.add({
        targets: tv.shadow,
        alpha: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 420
      });
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
    }
  }

  // Surface an XP gain to the player: brief two-note "ding" + a small
  // golden floater above the attacker's sprite. Pairs with the existing
  // log line (Amar gains 30 XP). Sits at -34px above sprite center so a
  // companion level-up floater (-10px) doesn't overlap it.
  private announceXpGain(unit: Unit, amount: number): void {
    sfxXpGain();
    const view = this.unitViews.get(unit.id);
    if (!view) return;
    const floater = this.add.text(view.sprite.x, view.sprite.y - TILE_SIZE / 2 - 34, `+${amount} XP`, {
      fontFamily: FAMILY_HEADING,
      fontSize: "12px",
      color: "#fff7c4",
      stroke: "#1a0e04",
      strokeThickness: 3,
      shadow: { offsetX: 0, offsetY: 2, color: "#000", blur: 6, fill: true }
    }).setOrigin(0.5, 1).setDepth(40);
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
      const floater = this.add.text(view.sprite.x, view.sprite.y - TILE_SIZE / 2 - 10, `LV ${report.newLevel}`, {
        fontFamily: FAMILY_HEADING,
        fontSize: "14px",
        color: "#fff7c4",
        stroke: "#1a0e04",
        strokeThickness: 3,
        shadow: { offsetX: 0, offsetY: 2, color: "#000", blur: 6, fill: true }
      }).setOrigin(0.5, 1).setDepth(40);
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
    await this.lunge(u, target);
    const result = performAttack(this.state, u, target);
    u.state.apRemaining -= 1;
    this.applyAttackEffects(u, target, result);
    // Hit-pause: on a crit, freeze the action for ~90ms so the camera shake
    // and the CRIT damage number have a moment to land before the chain
    // continues. Cheap "this hit mattered" feedback.
    if (result.crit) await this.delay(90);
    if (result.destructTriggered && result.attackerKilled) {
      // Destruct: defender's death pulled the attacker down too.
      const av = this.unitViews.get(u.id);
      if (av) {
        sfxDeath();
        playUnitState(this, av.sprite, u, "death");
        this.stopBreathing(av);
        this.tweens.add({ targets: av.sprite, alpha: 0.18, angle: 90, duration: 420 });
        this.tweens.add({ targets: av.shadow, alpha: 0, scaleX: 0.5, scaleY: 0.5, duration: 420 });
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
    // Player path: playerAnimating → idle. Enemy path: stays in enemyTurn (no-op).
    this.fsm.send({ tag: "ACTION_COMPLETE" });
    if (this.checkEnd()) return;
    // Enemy turns are driven by runEnemyTurn — don't advance the queue here.
    if (u.faction !== "player") return;
    this.continueOrEnd(u);
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
