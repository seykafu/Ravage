import Phaser from "phaser";
import { COLORS, GAME_HEIGHT, GAME_WIDTH, TILE_SIZE } from "../util/constants";
import { ensureBackdropTexture, BACKDROPS } from "../art/BackdropArt";
import { ensureTileTexture } from "../art/TileArt";
import { ensureUnitTexture, tileToPixel } from "../art/UnitArt";
import { Grid } from "../combat/Grid";
import { Initiative } from "../combat/Initiative";
import { beginUnitTurn, createUnit, isAlive } from "../combat/Unit";
import { Rng } from "../util/rng";
import { drawPanel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { battleById } from "../data/battles";
import {
  BattleState,
  checkVictory,
  enterStance,
  moveUnit,
  performAttack,
  reachableForUnit,
  targetsForUnit,
  unitAt
} from "../combat/Actions";
import { previewAttack } from "../combat/Damage";
import { counterZoneTiles } from "../combat/Stances";
import { executePlan, planEnemyTurn } from "../combat/AI";
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
  sfxVictory
} from "../audio/Sfx";
import { completeBattle, loadSave, unlockBattle, writeSave } from "../util/save";
import { BATTLES } from "../data/battles";
import type { TilePos, Unit } from "../combat/types";
import { playUnitState } from "../assets/unitAnim";

const BACKDROP_LOOKUP: Record<string, keyof typeof BACKDROPS> = {
  bg_palace_coup: "palaceCoup",
  bg_thuling: "thuling",
  bg_farmland: "farmland",
  bg_mountain: "mountain",
  bg_swamp: "swamp",
  bg_caravan: "caravan",
  bg_monastery: "monastery",
  bg_orinhal: "orinhal",
  bg_cliffs: "cliffs",
  bg_gruge: "gruge",
  bg_finalBoss: "finalBoss"
};

interface BattleArgs { battleId: string; }

interface UnitView {
  unit: Unit;
  sprite: Phaser.GameObjects.Sprite;
  baseY: number;  // origin Y for idle bob; updates after every move
  hpBg: Phaser.GameObjects.Graphics;
  hpBar: Phaser.GameObjects.Graphics;
  stanceIcon: Phaser.GameObjects.Text;
}

type Mode = "idle" | "move" | "attack";

const PANEL_W = 280;

export class BattleScene extends Phaser.Scene {
  private battleId!: string;
  private state!: BattleState;
  private initiative!: Initiative;
  private originX = 0;
  private originY = 0;
  private unitViews = new Map<string, UnitView>();
  private overlayG!: Phaser.GameObjects.Graphics;
  private threatG!: Phaser.GameObjects.Graphics;
  private cursorG!: Phaser.GameObjects.Graphics;
  private actionButtons: Button[] = [];
  private activeUnitText!: Phaser.GameObjects.Text;
  private apText!: Phaser.GameObjects.Text;
  private statText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private logLines: string[] = [];
  private initiativeBar!: Phaser.GameObjects.Container;
  private mode: Mode = "idle";
  private moveTiles: TilePos[] = [];
  private targetUnits: Unit[] = [];
  private hoverPreview!: Phaser.GameObjects.Container;
  private debug = false;
  private debugText!: Phaser.GameObjects.Text;
  private acting = false;
  private ended = false;
  private roundText!: Phaser.GameObjects.Text;

  constructor() { super("BattleScene"); }

  init(data: BattleArgs): void {
    this.battleId = data.battleId;
    this.unitViews = new Map();
    this.actionButtons = [];
    this.logLines = [];
    this.mode = "idle";
    this.moveTiles = [];
    this.targetUnits = [];
    this.acting = false;
    this.ended = false;
    this.debug = false;
  }

  create(): void {
    const node = battleById(this.battleId);
    if (!node || !node.map || !node.buildPlayers || !node.buildEnemies) {
      this.scene.start("OverworldScene");
      return;
    }

    // Backdrop
    const camel = BACKDROP_LOOKUP[node.backdropKey] ?? "thuling";
    const bdSpec = BACKDROPS[camel];
    const bgKey = ensureBackdropTexture(this, node.backdropKey, bdSpec, `backdrop:${camel}`);
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
    enemies.forEach((e) => (e.state.facingX = -1));
    players.forEach((p) => (p.state.facingX = 1));
    const units: Unit[] = [...players, ...enemies];
    this.state = { units, grid, rng };

    this.initiative = new Initiative();
    this.initiative.reseed(units);

    // Layout
    const playW = GAME_WIDTH - PANEL_W - 40;
    const playH = GAME_HEIGHT - 80 - 40;
    this.originX = 20 + Math.floor((playW - map.width * TILE_SIZE) / 2);
    this.originY = 80 + Math.floor((playH - map.height * TILE_SIZE) / 2);

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
    this.cursorG = this.add.graphics();

    // Units
    for (const u of units) {
      const tex = ensureUnitTexture(this, u);
      const px = tileToPixel(u.state.position, this.originX, this.originY);
      const baseY = px.y - 4;
      const sprite = this.add.sprite(px.x, baseY, tex).setDisplaySize(40, 50);
      if (u.faction === "enemy") sprite.setFlipX(true);
      const hpBg = this.add.graphics();
      const hpBar = this.add.graphics();
      const stanceIcon = this.add.text(px.x, px.y - TILE_SIZE / 2 + 2, "", {
        fontFamily: "Cinzel, serif",
        fontSize: "12px",
        color: "#ffd45a",
        stroke: "#000",
        strokeThickness: 2
      }).setOrigin(0.5, 0);
      this.unitViews.set(u.id, { unit: u, sprite, baseY, hpBg, hpBar, stanceIcon });
      this.refreshUnitView(u);
      playUnitState(this, sprite, u, "idle");
    }

    // Top initiative bar
    const topG = this.add.graphics();
    topG.fillStyle(0x000000, 0.6);
    topG.fillRect(0, 0, GAME_WIDTH, 70);
    topG.lineStyle(1, COLORS.gold, 0.5);
    topG.strokeRect(0.5, 0.5, GAME_WIDTH - 1, 69);
    this.add.text(16, 8, "INITIATIVE", {
      fontFamily: "Cinzel, serif",
      fontSize: "11px",
      color: "#c9b07a"
    });
    this.roundText = this.add.text(16, 24, "", {
      fontFamily: "Cinzel, serif",
      fontSize: "16px",
      color: "#f4d999"
    });
    this.initiativeBar = this.add.container(110, 16);

    // Right panel
    const apg = this.add.graphics();
    drawPanel(apg, GAME_WIDTH - PANEL_W - 12, 80, PANEL_W, GAME_HEIGHT - 100);
    const px = GAME_WIDTH - PANEL_W;
    this.activeUnitText = this.add.text(px, 96, "", {
      fontFamily: "Cinzel, serif",
      fontSize: "20px",
      color: "#f4d999"
    });
    this.apText = this.add.text(px, 124, "", {
      fontFamily: "Georgia, serif",
      fontSize: "14px",
      color: "#dad3bd"
    });
    this.statText = this.add.text(px, 148, "", {
      fontFamily: "Consolas, Menlo, monospace",
      fontSize: "12px",
      color: "#9da7b8",
      lineSpacing: 4
    });

    // Battle log
    this.add.text(px, 470, "BATTLE LOG", {
      fontFamily: "Cinzel, serif",
      fontSize: "11px",
      color: "#c9b07a"
    });
    this.logText = this.add.text(px, 488, "", {
      fontFamily: "Georgia, serif",
      fontSize: "12px",
      color: "#c0c5cf",
      wordWrap: { width: PANEL_W - 24 },
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
      fontFamily: "Consolas, Menlo, monospace",
      fontSize: "12px",
      color: "#dad3bd",
      lineSpacing: 4
    });
    this.hoverPreview.add([hpBg2, hpTxt]);
    this.hoverPreview.setData("txt", hpTxt);

    // Debug overlay
    this.debugText = this.add.text(20, GAME_HEIGHT - 22, "", {
      fontFamily: "Consolas, Menlo, monospace",
      fontSize: "11px",
      color: "#9aa5b8"
    });
    this.input.keyboard?.on("keydown-TAB", () => {
      this.debug = !this.debug;
      this.refreshDebug();
    });
    this.input.keyboard?.on("keydown-ESC", () => {
      if (this.mode !== "idle") {
        this.clearOverlays();
        const cur = this.initiative.current();
        if (cur && cur.faction === "player") {
          this.clearActionButtons();
          this.buildActionButtons(cur);
        }
      }
    });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => this.handlePointerDown(p));
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => this.handlePointerMove(p));

    getMusic(this).play(node.music, { fadeMs: 800 });
    this.cameras.main.fadeIn(450, 0, 0, 0);

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
  }

  private refreshInitiativeBar(): void {
    this.initiativeBar.removeAll(true);
    const upcoming = this.initiative.upcoming(this.state.units, 8);
    const slot = 76;
    upcoming.forEach((u, i) => {
      const x = i * slot;
      const bg = this.add.graphics();
      const fill = u.faction === "player" ? 0x1a3554 : 0x4a1a1a;
      bg.fillStyle(fill, 0.85);
      bg.fillRect(x, 0, slot - 6, 44);
      bg.lineStyle(1, i === 0 ? COLORS.goldBright : COLORS.gold, i === 0 ? 1 : 0.5);
      bg.strokeRect(x + 0.5, 0.5, slot - 7, 43);
      const tex = ensureUnitTexture(this, u);
      const portrait = this.add.image(x + 18, 22, tex).setDisplaySize(28, 36);
      if (u.faction === "enemy") portrait.setFlipX(true);
      const name = this.add.text(x + 36, 6, u.name, {
        fontFamily: "Cinzel, serif",
        fontSize: "10px",
        color: i === 0 ? "#fff7c4" : "#dccfa8"
      });
      const sp = this.add.text(x + 36, 22, `SPD ${u.stats.speed}`, {
        fontFamily: "Consolas, Menlo, monospace",
        fontSize: "9px",
        color: "#9da7b8"
      });
      this.initiativeBar.add([bg, portrait, name, sp]);
    });
    this.roundText.setText(`Round ${this.initiative.round}`);
  }

  private pushLog(msg: string): void {
    this.logLines.push(msg);
    if (this.logLines.length > 8) this.logLines.shift();
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
    if (this.ended) return;
    let u = this.initiative.current();
    while (u && !isAlive(u)) {
      u = this.initiative.advance(this.state.units);
    }
    if (!u) return;
    beginUnitTurn(u);
    this.activeUnitText.setText(u.name);
    this.refreshSidePanel(u);
    this.refreshInitiativeBar();
    this.refreshAllUnits();
    this.refreshDebug();
    this.clearActionButtons();
    this.clearOverlays();
    this.drawOverlay();

    if (u.faction === "player" && isAlive(u)) {
      this.buildActionButtons(u);
    } else {
      this.time.delayedCall(450, () => this.runEnemyTurn(u));
    }
  }

  private refreshSidePanel(u: Unit): void {
    this.apText.setText(`AP ${u.state.apRemaining}/${u.stats.ap}  ·  ${u.faction.toUpperCase()}`);
    this.statText.setText(
      [
        `HP   ${u.state.hp}/${u.stats.hp}`,
        `PWR  ${u.stats.power}    ARM  ${u.stats.armor}`,
        `SPD  ${u.stats.speed}    MOV  ${u.stats.movement}`,
        `WPN  ${u.weapon}`,
        `STN  ${u.state.stance}`
      ].join("\n")
    );
  }

  private endCurrentTurn(): void {
    this.clearActionButtons();
    this.clearOverlays();
    if (this.checkEnd()) return;
    this.initiative.advance(this.state.units);
    this.beginCurrentTurn();
  }

  private checkEnd(): boolean {
    const v = checkVictory(this.state);
    if (!v) return false;
    this.ended = true;
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
    writeSave(save);
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
    const top = 250;
    const w = 240;
    const h = 38;
    const gap = 8;
    const make = (
      label: string,
      i: number,
      primary: boolean,
      enabled: boolean,
      onClick: () => void
    ) => {
      const b = new Button(this, {
        x: px,
        y: top + i * (h + gap),
        w,
        h,
        label,
        primary,
        enabled,
        fontSize: 14,
        onClick
      });
      this.actionButtons.push(b);
    };
    const canMove = u.state.apRemaining >= 1 && reachableForUnit(this.state, u).length > 0;
    const canAttack = u.state.apRemaining >= 1 && targetsForUnit(this.state, u).length > 0;
    const canStance = u.state.apRemaining >= 1;
    make("Move (1 AP)", 0, false, canMove, () => this.enterMoveMode(u));
    make("Attack (1 AP)", 1, true, canAttack, () => this.enterAttackMode(u));
    make("Ready (1 AP)", 2, false, canStance && u.weapon !== "bow", () => this.applyStance(u, "ready"));
    make("Defend (1 AP)", 3, false, canStance, () => this.applyStance(u, "defensive"));
    make("End Turn", 4, false, true, () => {
      sfxClick();
      this.endCurrentTurn();
    });
  }

  private enterMoveMode(u: Unit): void {
    sfxClick();
    this.mode = "move";
    const reach = reachableForUnit(this.state, u);
    this.moveTiles = reach.filter((t) => {
      const occ = unitAt(this.state, t);
      return !occ;
    });
    this.drawOverlay();
  }

  private enterAttackMode(u: Unit): void {
    sfxClick();
    this.mode = "attack";
    this.targetUnits = targetsForUnit(this.state, u);
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
    if (u.state.apRemaining > 0) this.buildActionButtons(u);
    else this.endCurrentTurn();
  }

  private clearOverlays(): void {
    this.overlayG.clear();
    this.threatG.clear();
    this.cursorG.clear();
    this.hoverPreview.setVisible(false);
    this.mode = "idle";
    this.moveTiles = [];
    this.targetUnits = [];
  }

  private drawOverlay(): void {
    this.overlayG.clear();
    this.threatG.clear();
    if (this.mode === "move") {
      this.overlayG.fillStyle(COLORS.moveTile, 0.28);
      for (const t of this.moveTiles) {
        const px = tileToPixel(t, this.originX, this.originY);
        this.overlayG.fillRect(px.x - TILE_SIZE / 2, px.y - TILE_SIZE / 2, TILE_SIZE, TILE_SIZE);
      }
      this.overlayG.lineStyle(1, COLORS.moveTile, 0.75);
      for (const t of this.moveTiles) {
        const px = tileToPixel(t, this.originX, this.originY);
        this.overlayG.strokeRect(px.x - TILE_SIZE / 2 + 0.5, px.y - TILE_SIZE / 2 + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
      }
    } else if (this.mode === "attack") {
      this.overlayG.fillStyle(COLORS.attackTile, 0.32);
      this.overlayG.lineStyle(1, COLORS.attackTile, 0.9);
      for (const t of this.targetUnits) {
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
    if (this.acting || this.ended) return;
    const u = this.initiative.current();
    if (!u || u.faction !== "player") return;
    const tile = this.screenToTile(p.x, p.y);
    if (!tile) return;
    if (this.mode === "move") {
      const ok = this.moveTiles.some((t) => t.x === tile.x && t.y === tile.y);
      if (!ok) return;
      this.acting = true;
      void this.animateMove(u, tile);
    } else if (this.mode === "attack") {
      const target = this.targetUnits.find(
        (t) => t.state.position.x === tile.x && t.state.position.y === tile.y
      );
      if (!target) return;
      this.acting = true;
      void this.animateAttack(u, target);
    } else {
      const occ = unitAt(this.state, tile);
      if (occ) {
        // peek at unit info via the side panel
        this.activeUnitText.setText(`${occ.name}`);
        this.refreshSidePanel(occ);
        this.time.delayedCall(2400, () => {
          if (this.ended) return;
          const cur = this.initiative.current();
          if (cur) {
            this.activeUnitText.setText(cur.name);
            this.refreshSidePanel(cur);
          }
        });
      }
    }
  }

  private handlePointerMove(p: Phaser.Input.Pointer): void {
    if (this.ended) return;
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

    if (this.mode === "attack") {
      const u = this.initiative.current();
      const target = u && this.targetUnits.find((t) => t.state.position.x === tile.x && t.state.position.y === tile.y);
      if (u && target) {
        const tileDef = this.state.grid.tileAt(target.state.position);
        const pre = previewAttack(u, target, tileDef, false);
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

  private async animateMove(u: Unit, dest: TilePos): Promise<void> {
    const path = this.state.grid.pathTo(u.state.position, dest, (p) => {
      const occ = unitAt(this.state, p);
      return occ !== null && occ !== u && occ.faction !== u.faction;
    });
    if (!path) {
      this.acting = false;
      return;
    }
    moveUnit(this.state, u, dest);
    const view = this.unitViews.get(u.id);
    if (!view) {
      this.acting = false;
      return;
    }
    let prev: TilePos = u.state.position; // already updated to dest, but path walks visually
    playUnitState(this, view.sprite, u, "walk");
    // Walk the visual sprite along path
    let lastY = view.baseY;
    for (const step of path) {
      const dx = step.x - (prev.x);
      if (dx !== 0) {
        u.state.facingX = dx > 0 ? 1 : -1;
        view.sprite.setFlipX(u.state.facingX === -1);
      }
      const px = tileToPixel(step, this.originX, this.originY);
      lastY = px.y - 4;
      sfxStep();
      await new Promise<void>((res) => {
        this.tweens.add({
          targets: view.sprite,
          x: px.x,
          y: lastY,
          duration: 110,
          ease: "Sine.easeInOut",
          onComplete: () => res()
        });
      });
      prev = step;
    }
    view.baseY = lastY;
    playUnitState(this, view.sprite, u, "idle");
    u.state.apRemaining -= 1;
    this.pushLog(`${u.name} moves.`);
    this.refreshUnitView(u);
    this.refreshSidePanel(u);
    this.clearActionButtons();
    this.clearOverlays();
    this.acting = false;
    if (this.checkEnd()) return;
    if (u.state.apRemaining > 0 && isAlive(u)) this.buildActionButtons(u);
    else this.endCurrentTurn();
  }

  private flashSprite(s: Phaser.GameObjects.Sprite, color: number): void {
    s.setTintFill(color);
    this.time.delayedCall(120, () => s.clearTint());
  }

  private spawnDamageNumber(x: number, y: number, text: string, color: number): void {
    const t = this.add.text(x, y - 12, text, {
      fontFamily: "Cinzel, serif",
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
      if (result.crit) sfxCrit();
      else sfxAttackHit();
      this.flashSprite(tv.sprite, 0xff5a4d);
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
      this.tweens.add({
        targets: tv.sprite,
        alpha: 0.18,
        angle: 90,
        duration: 420
      });
    }
  }

  private async animateAttack(u: Unit, target: Unit): Promise<void> {
    await this.lunge(u, target);
    const result = performAttack(this.state, u, target);
    u.state.apRemaining -= 1;
    this.applyAttackEffects(u, target, result);
    if (result.counterTriggered && result.counterResult) {
      await this.delay(260);
      await this.lunge(target, u);
      this.applyAttackEffects(target, u, result.counterResult);
    }
    await this.delay(280);
    this.refreshAllUnits();
    this.refreshSidePanel(u);
    this.clearActionButtons();
    this.clearOverlays();
    this.acting = false;
    if (this.checkEnd()) return;
    if (u.state.apRemaining > 0 && isAlive(u)) this.buildActionButtons(u);
    else this.endCurrentTurn();
  }

  // ---- Enemy turn ----
  private async runEnemyTurn(u: Unit): Promise<void> {
    if (this.ended) return;
    this.acting = true;
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
      // If checkEnd was hit during animation, ended is true
      if (this.ended) return;
    }
    this.acting = false;
    if (this.ended) return;
    if (this.checkEnd()) return;
    this.endCurrentTurn();
  }

  // Dummy reference to satisfy unused-import linter for executePlan during static check.
  private _unused = executePlan;
}
