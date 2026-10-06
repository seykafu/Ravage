// First-battle guided tutorial — a play-by-play director for B1.
//
// A short run of tips, each of which WAITS for a battle event (the battle
// starting, the player's turn, the first move landing...), then shows a
// card in the lower left with a bobbing arrow at the thing it teaches. A
// tip closes on "Got it", on its ✕, or by itself when the player does what
// it teaches. "Skip tutorial" ends the whole run. The battle never waits
// on a tip, and clicks on the card belong to the card alone (BattleScene
// asks covers() before reading a click as a board click).
//
// Pacing: one idea per tip, and no more than two in a row — the rest wait
// for the moment they describe (moving, attacking, the second unit's turn,
// the enemy's turn, round two).
//
// Shown once per save (flags["tutorial_b01_done"]). BattleScene owns the
// instance and forwards events via notify().

import Phaser from "phaser";
import { Button } from "../../ui/Button";
import { drawPanel } from "../../ui/Panel";
import { FAMILY_BODY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../../util/constants";
import { loadSave, writeSave } from "../../util/save";
import { sfxClick, sfxHover } from "../../audio/Sfx";

export type TutorialEvent =
  | "battleStart"
  | "playerTurn"
  | "moved"
  | "attacked"
  | "enemyPhase"
  | "roundStart";

type WorldTag = <T extends Phaser.GameObjects.GameObject>(obj: T) => T;

interface ArrowSpec {
  x: number;
  y: number;
  glyph: string;     // "▲" pointing up at top-bar targets, "➤" at panel buttons
  bobAxis: "x" | "y";
}

interface TutorialStep {
  title: string;
  body: string;
  // Event that reveals this step. "immediate" = the moment the previous
  // step is dismissed.
  waitFor: TutorialEvent | "immediate";
  // Round gate for roundStart triggers.
  minRound?: number;
  // Only on a NEW occurrence of `waitFor` — never the turn already under
  // way when the step comes up (Stances waits for the next unit's turn).
  fresh?: boolean;
  // Optional event that closes the step by itself (the player DID the
  // thing) — "Got it" always works too.
  completeOn?: TutorialEvent;
  arrow?: ArrowSpec;
}

// Layout facts mirrored from BattleScene: side panel x = GAME_WIDTH-280,
// action buttons from top=438 in 30px rows with 4px gaps (Move/Attack,
// Ready/Defend, Item/Undo, then End Turn), goal text at (16,46), toggles
// at (GAME_WIDTH-120,35) and (GAME_WIDTH-76,35).
const BTN_X = GAME_WIDTH - 280;
const BTN_ROW = (r: number): number => 438 + r * 34 + 15;
const AT_BUTTON = (row: number): ArrowSpec => ({ x: BTN_X - 22, y: BTN_ROW(row), glyph: "➤", bobAxis: "x" });

const STEPS: TutorialStep[] = [
  {
    title: "Your First Battle",
    body: "Defeat every enemy to win. Your goal is always shown here, top left. If your whole squad falls, the battle is lost.",
    waitFor: "battleStart",
    arrow: { x: 120, y: 78, glyph: "▲", bobAxis: "y" }
  },
  {
    title: "Who Moves Next",
    body: "This bar shows the turn order. Your side goes first each round. The gold arrow on the field marks whose turn it is.",
    waitFor: "immediate",
    arrow: { x: 430, y: 78, glyph: "▲", bobAxis: "y" }
  },
  {
    title: "Move",
    body: "Blue tiles show where this unit can walk. Click one to move there. Changed your mind? Press UNDO MOVE.",
    waitFor: "playerTurn",
    completeOn: "moved",
    arrow: AT_BUTTON(0)
  },
  {
    title: "Attack",
    body: "Enemies in reach glow red. Point at one to see the damage you'll do, then click it to strike.\nSwords beat spears. Spears beat shields. Shields beat swords.",
    waitFor: "immediate",
    completeOn: "attacked",
    arrow: AT_BUTTON(0)
  },
  {
    title: "End the Turn",
    body: "Every action costs AP (action points), shown in the panel. When this unit is done, press END TURN.",
    waitFor: "immediate",
    arrow: AT_BUTTON(3)
  },
  {
    title: "Stances",
    body: "Spare AP? READY hits back at the first enemy who attacks you. DEFEND halves the damage you take. Both last until your next turn.",
    waitFor: "playerTurn",
    fresh: true,
    arrow: AT_BUTTON(1)
  },
  {
    title: "Enemy Turn",
    body: "Now the enemy moves. Watch where they go. The ▶▶ button speeds their turn up.",
    waitFor: "enemyPhase",
    completeOn: "playerTurn",
    arrow: { x: GAME_WIDTH - 76, y: 70, glyph: "▲", bobAxis: "y" }
  },
  {
    title: "Two Last Things",
    body: "The ⚔ button (or the T key) shades every tile the enemy can hit next turn. Drag the map, or use WASD, to look around. The game saves every turn.",
    waitFor: "roundStart",
    minRound: 2,
    arrow: { x: GAME_WIDTH - 120, y: 70, glyph: "▲", bobAxis: "y" }
  }
];

const CARD_W = 440;
const CARD_X = 20;
const PAD = 18;

export class TutorialDirector {
  private scene: Phaser.Scene;
  private pin: WorldTag;
  private idx = 0;
  private showing = false;
  private done = false;
  private panelObjs: Phaser.GameObjects.GameObject[] = [];
  private arrowObj?: Phaser.GameObjects.Text;
  private arrowTween?: Phaser.Tweens.Tween;
  /** The card on screen, for covers(). */
  private card?: Phaser.Geom.Rectangle;
  // Whose phase it is and which round, as the battle last reported: a tip
  // that comes up while its moment is already under way (the player's turn
  // began while an earlier tip was open) shows at once, not a turn late.
  private phase: "player" | "enemy" | null = null;
  private round = 1;

  constructor(scene: Phaser.Scene, pin: WorldTag) {
    this.scene = scene;
    this.pin = pin;
  }

  static wanted(battleId: string, resume: boolean): boolean {
    if (battleId !== "b01_palace_coup" || resume) return false;
    return loadSave().flags["tutorial_b01_done"] !== true;
  }

  /** Whether a screen point (design px) is on the tip card. */
  covers(x: number, y: number): boolean {
    return !!this.card && this.card.contains(x, y);
  }

  notify(event: TutorialEvent, round = 1): void {
    if (event === "playerTurn") this.phase = "player";
    if (event === "enemyPhase") this.phase = "enemy";
    if (event === "roundStart") this.round = round;
    if (this.done) return;
    const step = STEPS[this.idx];
    if (!step) return;
    if (this.showing) {
      // The player performed the taught action — advance.
      if (step.completeOn === event) this.dismiss();
      return;
    }
    if (step.waitFor === event && (step.minRound === undefined || round >= step.minRound)) {
      this.show(step);
    }
  }

  private show(step: TutorialStep): void {
    this.showing = true;
    // The body first: the card grows to fit it.
    const body = this.scene.add.text(0, 0, step.body, {
      fontFamily: FAMILY_BODY,
      fontSize: "17px",
      color: "#ece6d6",
      wordWrap: { width: CARD_W - PAD * 2 },
      lineSpacing: 5
    });
    const H = 50 + body.height + 58;
    const X = CARD_X;
    const Y = GAME_HEIGHT - H - 24;
    body.setPosition(X + PAD, Y + 46);
    this.card = new Phaser.Geom.Rectangle(X, Y, CARD_W, H);

    const g = this.scene.add.graphics();
    drawPanel(g, X, Y, CARD_W, H);
    const title = this.scene.add.text(X + PAD, Y + 15, step.title.toUpperCase(), {
      fontFamily: FAMILY_HEADING,
      fontSize: "17px",
      color: "#f4d999",
      letterSpacing: 2
    });
    // Where we are in the run, so the end is always in sight.
    const count = this.scene.add.text(X + CARD_W - 50, Y + 17, `${this.idx + 1} / ${STEPS.length}`, {
      fontFamily: FAMILY_BODY,
      fontSize: "14px",
      color: "#9a907e"
    }).setOrigin(1, 0);
    // ✕ closes this tip.
    const close = this.scene.add.text(X + CARD_W - 16, Y + 12, "✕", {
      fontFamily: "Arial, sans-serif",
      fontSize: "18px",
      color: "#b8ab92"
    }).setOrigin(1, 0).setInteractive({ useHandCursor: true });
    close.on("pointerover", () => { sfxHover(); close.setColor("#f4d999"); });
    close.on("pointerout", () => close.setColor("#b8ab92"));
    close.on("pointerdown", () => { sfxClick(); this.dismiss(); });

    const last = this.idx === STEPS.length - 1;
    const got = new Button(this.scene, {
      x: X + CARD_W - 124, y: Y + H - 44, w: 108, h: 32,
      label: last ? "Done ✓" : "Got it ▸", primary: true, fontSize: 14,
      onClick: () => { sfxClick(); this.dismiss(); }
    });
    const skip = new Button(this.scene, {
      x: X + PAD - 2, y: Y + H - 44, w: 144, h: 32,
      label: "Skip tutorial ✕", primary: false, fontSize: 13,
      onClick: () => { sfxClick(); this.finish(); }
    });

    for (const o of [g, title, count, close, body, got, skip]) {
      this.pin(o as Phaser.GameObjects.GameObject);
      // The panel under everything on it (the body was made first, to size it).
      (o as Phaser.GameObjects.Container).setDepth?.(o === g ? 1300 : 1301);
      this.panelObjs.push(o as Phaser.GameObjects.GameObject);
    }
    if (last) skip.setVisible(false);

    // Fade the card in so tips don't teleport.
    for (const o of this.panelObjs) {
      const withAlpha = o as unknown as { setAlpha?: (a: number) => unknown };
      withAlpha.setAlpha?.(0);
    }
    this.scene.tweens.add({ targets: this.panelObjs, alpha: 1, duration: 200 });

    if (step.arrow) {
      const a = step.arrow;
      this.arrowObj = this.scene.add.text(a.x, a.y, a.glyph, {
        fontFamily: "Arial, sans-serif",
        fontSize: "28px",
        color: "#ffd45a",
        stroke: "#1a0e04",
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(1300);
      this.pin(this.arrowObj);
      const prop = a.bobAxis === "x" ? "x" : "y";
      this.arrowTween = this.scene.tweens.add({
        targets: this.arrowObj,
        [prop]: (a.bobAxis === "x" ? a.x : a.y) - 8,
        duration: 380,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut"
      });
    }
  }

  private dismiss(): void {
    this.teardown();
    this.idx++;
    const next = STEPS[this.idx];
    if (!next) {
      this.finish();
      return;
    }
    // Chain immediate steps straight on; event-gated steps wait — unless
    // their moment is already here.
    if (next.waitFor === "immediate" || this.isNow(next)) this.show(next);
  }

  /** Whether a step's moment is the one the battle is in right now. */
  private isNow(step: TutorialStep): boolean {
    if (step.fresh) return false;
    switch (step.waitFor) {
      case "playerTurn": return this.phase === "player";
      case "enemyPhase": return this.phase === "enemy";
      case "roundStart": return step.minRound !== undefined && this.round >= step.minRound;
      default: return false;
    }
  }

  private finish(): void {
    this.teardown();
    this.done = true;
    const s = loadSave();
    s.flags["tutorial_b01_done"] = true;
    writeSave(s);
  }

  private teardown(): void {
    this.showing = false;
    this.card = undefined;
    if (this.arrowTween) { this.arrowTween.stop(); this.arrowTween = undefined; }
    if (this.arrowObj) { this.arrowObj.destroy(); this.arrowObj = undefined; }
    for (const o of this.panelObjs) o.destroy();
    this.panelObjs = [];
  }
}
