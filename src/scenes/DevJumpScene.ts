import Phaser from "phaser";
import { FAMILY_BODY, FAMILY_HEADING, FAMILY_MONO, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { drawPanel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { BATTLES } from "../data/battles";
import { ARCS } from "../story/beats";
import type { ArcId, BattleId } from "../data/contentIds";

// ---- Dev-only battle/arc warp panel ---------------------------------------
// Toggled with the backquote (`) key from anywhere in the game (see main.ts).
// Lets the developer jump straight to any battle's prep screen, any story
// arc, the overworld, or the title — useful when iterating on a single
// battle without replaying the slice up to it.
//
// The scene is registered conditionally on import.meta.env.DEV so neither the
// scene class nor the keyboard hook ship in production builds.
//
// Interaction model: this scene is `launch`ed (not `start`ed) by main.ts,
// which also pauses the underlying scene. Cancelling resumes it; jumping
// stops the paused scene first so we don't leak a paused-but-orphan source
// into the scene manager.

interface DevJumpArgs {
  // Scene key that was paused when this overlay opened. Resumed on Cancel,
  // stopped on jump. Undefined when nothing was running (shouldn't happen in
  // practice, but the cancel path handles it).
  resumeKey?: string;
}

export class DevJumpScene extends Phaser.Scene {
  private resumeKey?: string;

  constructor() { super("DevJumpScene"); }

  init(data: DevJumpArgs): void {
    this.resumeKey = data.resumeKey;
  }

  create(): void {
    // Dim the underlying scene. Click-through is blocked by a full-canvas
    // input rectangle below the panel — clicks outside the panel are a noop.
    const dim = this.add.graphics();
    dim.fillStyle(0x000000, 0.72);
    dim.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const blocker = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0)
      .setOrigin(0)
      .setInteractive();
    blocker.on("pointerdown", () => { /* swallow */ });

    // Modal panel
    const panelW = 1100;
    const panelH = 620;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = (GAME_HEIGHT - panelH) / 2;
    const pg = this.add.graphics();
    drawPanel(pg, panelX, panelY, panelW, panelH);

    // Header
    this.add.text(panelX + 24, panelY + 18, "DEV — Jump To", {
      fontFamily: FAMILY_HEADING,
      fontSize: "22px",
      color: "#f4d999"
    });
    this.add.text(panelX + 24, panelY + 46, "Press ` to close · Esc to cancel · click any cell to warp", {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: "#9b9080",
      fontStyle: "italic"
    });

    // ---- Battles grid: 3 cols × 7 rows ------------------------------------
    const cols = 3;
    const cellW = 340;
    const cellH = 56;
    const cellGapX = 12;
    const cellGapY = 8;
    const gridX = panelX + 24;
    const gridY = panelY + 90;

    BATTLES.forEach((b, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = gridX + col * (cellW + cellGapX);
      const y = gridY + row * (cellH + cellGapY);
      const tag = b.playable ? "PLAY" : "stub";
      const label = `${b.id.toUpperCase()}  ·  ${b.subtitle}  [${tag}]`;
      const btn = new Button(this, {
        x, y, w: cellW, h: cellH,
        label,
        primary: b.playable,
        fontSize: 13,
        onClick: () => this.jumpToBattle(b.id)
      });
      void btn;
    });

    // ---- Story arcs row ---------------------------------------------------
    const arcsY = gridY + 7 * (cellH + cellGapY) + 16;
    this.add.text(gridX, arcsY, "Story arcs:", {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: "#c9b07a"
    });

    const arcIds = Object.keys(ARCS) as ArcId[];
    const arcBtnW = 170;
    const arcBtnH = 32;
    const arcGap = 8;
    arcIds.forEach((id, i) => {
      const x = gridX + i * (arcBtnW + arcGap);
      const y = arcsY + 24;
      const btn = new Button(this, {
        x, y, w: arcBtnW, h: arcBtnH,
        label: id,
        primary: false,
        fontSize: 11,
        onClick: () => this.jumpToArc(id)
      });
      void btn;
    });

    // ---- Bottom row: cancel + scene jumps ---------------------------------
    const footY = panelY + panelH - 56;
    const cancelBtn = new Button(this, {
      x: panelX + 24,
      y: footY,
      w: 140, h: 40,
      label: "Cancel (`)",
      primary: false,
      fontSize: 13,
      onClick: () => this.cancel()
    });
    void cancelBtn;

    const overworldBtn = new Button(this, {
      x: panelX + panelW - 24 - 140,
      y: footY,
      w: 140, h: 40,
      label: "Overworld",
      primary: false,
      fontSize: 13,
      onClick: () => this.jumpScene("OverworldScene")
    });
    void overworldBtn;

    const titleBtn = new Button(this, {
      x: panelX + panelW - 24 - 140 - 8 - 140,
      y: footY,
      w: 140, h: 40,
      label: "Title",
      primary: false,
      fontSize: 13,
      onClick: () => this.jumpScene("TitleScene")
    });
    void titleBtn;

    const creditsBtn = new Button(this, {
      x: panelX + panelW - 24 - 140 - 8 - 140 - 8 - 140,
      y: footY,
      w: 140, h: 40,
      label: "Credits",
      primary: false,
      fontSize: 13,
      onClick: () => this.jumpScene("CreditsScene")
    });
    void creditsBtn;

    // Footer hint about which scene we paused so the dev knows where Cancel
    // returns them.
    if (this.resumeKey) {
      this.add.text(panelX + panelW / 2, footY + 18, `↩ Cancel returns to: ${this.resumeKey}`, {
        fontFamily: FAMILY_MONO,
        fontSize: "11px",
        color: "#7a7165"
      }).setOrigin(0.5);
    }

    // Esc closes (mirrors backquote handler in main.ts).
    this.input.keyboard?.on("keydown-ESC", () => this.cancel());
  }

  // Resume the underlying scene and stop ourselves. If nothing was paused
  // (edge case — opened from no scene), fall back to the overworld so the
  // game remains in a usable state.
  private cancel(): void {
    if (this.resumeKey) {
      this.scene.resume(this.resumeKey);
      this.scene.stop();
    } else {
      this.scene.stop();
      this.scene.start("OverworldScene");
    }
  }

  // Stops the paused source scene (paused scenes don't auto-stop when another
  // scene starts) and warps to the target battle's prep screen.
  private jumpToBattle(battleId: BattleId): void {
    this.stopPaused();
    this.scene.start("BattlePrepScene", { battleId });
  }

  private jumpToArc(arcId: ArcId): void {
    this.stopPaused();
    this.scene.start("StoryScene", { arcId });
  }

  private jumpScene(key: string): void {
    this.stopPaused();
    this.scene.start(key);
  }

  private stopPaused(): void {
    if (this.resumeKey && this.resumeKey !== this.scene.key) {
      this.scene.stop(this.resumeKey);
    }
  }
}
