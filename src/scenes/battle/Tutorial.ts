// First-battle guided tutorial — a play-by-play director for B1.
//
// A sequence of steps, each of which WAITS for a battle event
// ("battleStart", the player's first turn, the first move landing...),
// shows a pinned popup panel with a bobbing arrow pointed at the thing
// being taught, and dismisses either on "Got it" or automatically when
// the player performs the taught action. The battle is never blocked —
// popups sit in the lower-left of the playfield and input passes
// through everywhere else.
//
// Shown once per save (flags["tutorial_b01_done"]); "Skip tutorial"
// ends the whole sequence immediately. BattleScene owns the instance
// and forwards events via notify().

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
  // Optional event that auto-dismisses the step (the player DID the
  // thing) — "Got it" always works too.
  completeOn?: TutorialEvent;
  arrow?: ArrowSpec;
}

// Layout facts mirrored from BattleScene: side panel x = GAME_WIDTH-280,
// action buttons at top=438 in 30px rows with 4px gaps, goal text at
// (16,46), toggles at (GAME_WIDTH-120,35) and (GAME_WIDTH-76,35).
const BTN_X = GAME_WIDTH - 280;
const BTN_ROW = (r: number): number => 438 + r * 34 + 15;

const STEPS: TutorialStep[] = [
  {
    title: "The Field",
    body: "Welcome to your first battle. Your objective sits in the top-left — for most fights: defeat every enemy. Lose your whole squad and the battle is lost.",
    waitFor: "battleStart",
    arrow: { x: 120, y: 78, glyph: "▲", bobAxis: "y" }
  },
  {
    title: "Turn Order",
    body: "The bar up top shows who acts next: your side first each round, fastest units leading. The gold arrow on the field marks whose turn it is right now.",
    waitFor: "immediate",
    arrow: { x: 430, y: 78, glyph: "▲", bobAxis: "y" }
  },
  {
    title: "Movement",
    body: "The blue region is everywhere the active unit can walk. Hover a tile to preview the path, click it to move — or use the MOVE button. Try it now.",
    waitFor: "playerTurn",
    completeOn: "moved",
    arrow: { x: BTN_X - 22, y: BTN_ROW(0), glyph: "➤", bobAxis: "x" }
  },
  {
    title: "Undo",
    body: "Second thoughts? UNDO MOVE walks it back — position and AP both. Anything that commits (an attack, a stance, an item) locks the move in.",
    waitFor: "immediate",
    arrow: { x: BTN_X + 108, y: BTN_ROW(2), glyph: "➤", bobAxis: "x" }
  },
  {
    title: "Attack",
    body: "Enemies in reach are marked red. Hover one to see the damage forecast — hit chance, crit, and their counter — then click to strike. Swords beat spears, spears beat shields, shields beat swords.",
    waitFor: "immediate",
    completeOn: "attacked",
    arrow: { x: BTN_X + 108, y: BTN_ROW(0), glyph: "➤", bobAxis: "x" }
  },
  {
    title: "Action Points",
    body: "Every action costs AP, shown in the side panel. A unit can move, attack, and more in one turn — spend in any order, then END TURN at the bottom passes to the next unit.",
    waitFor: "immediate",
    arrow: { x: BTN_X - 22, y: 200, glyph: "➤", bobAxis: "x" }
  },
  {
    title: "Stances",
    body: "Spare AP? READY counters the first enemy that attacks you. DEFEND halves incoming damage. They stack — and they last until your next turn.",
    waitFor: "immediate",
    arrow: { x: BTN_X - 22, y: BTN_ROW(1), glyph: "➤", bobAxis: "x" }
  },
  {
    title: "Danger Sense",
    body: "The ⚔ toggle (or the T key) shades every tile the enemy could strike next turn. Check it before you commit anyone somewhere lonely.",
    waitFor: "immediate",
    arrow: { x: GAME_WIDTH - 120, y: 70, glyph: "▲", bobAxis: "y" }
  },
  {
    title: "Enemy Phase",
    body: "The enemy moves now — watch where they commit. The ▶▶ button doubles their animation speed once you've seen enough.",
    waitFor: "enemyPhase",
    completeOn: "playerTurn",
    arrow: { x: GAME_WIDTH - 76, y: 70, glyph: "▲", bobAxis: "y" }
  },
  {
    title: "One More Thing",
    body: "Drag with any mouse button (or WASD / arrows) to pan the battlefield — some maps run taller than the screen. And your progress saves every turn: leave any time and RESUME from the battle-prep screen. Good hunting.",
    waitFor: "roundStart",
    minRound: 2
  }
];

export class TutorialDirector {
  private scene: Phaser.Scene;
  private pin: WorldTag;
  private idx = 0;
  private showing = false;
  private done = false;
  private panelObjs: Phaser.GameObjects.GameObject[] = [];
  private arrowObj?: Phaser.GameObjects.Text;
  private arrowTween?: Phaser.Tweens.Tween;
  // Steps with waitFor:"immediate" chain off the previous dismissal, but
  // only once their PREDECESSOR closed. Queued events that arrived while
  // a step was showing are consumed for completeOn only.
  private pendingImmediate = false;

  constructor(scene: Phaser.Scene, pin: WorldTag) {
    this.scene = scene;
    this.pin = pin;
  }

  static wanted(battleId: string, resume: boolean): boolean {
    if (battleId !== "b01_palace_coup" || resume) return false;
    return loadSave().flags["tutorial_b01_done"] !== true;
  }

  notify(event: TutorialEvent, round = 1): void {
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
    const W = 400;
    const H = 128;
    const X = 20;
    const Y = GAME_HEIGHT - H - 24;

    const g = this.scene.add.graphics();
    drawPanel(g, X, Y, W, H);
    const title = this.scene.add.text(X + 16, Y + 12, step.title.toUpperCase(), {
      fontFamily: FAMILY_HEADING,
      fontSize: "14px",
      color: "#f4d999",
      letterSpacing: 2
    });
    const body = this.scene.add.text(X + 16, Y + 34, step.body, {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: "#e6e0d0",
      wordWrap: { width: W - 32 },
      lineSpacing: 3
    });
    const got = new Button(this.scene, {
      x: X + W - 96, y: Y + H - 34, w: 82, h: 26,
      label: "Got it ▸", primary: true, fontSize: 12,
      onClick: () => { sfxClick(); this.dismiss(); }
    });
    const skip = this.scene.add.text(X + 16, Y + H - 26, "Skip tutorial ✕", {
      fontFamily: FAMILY_BODY,
      fontSize: "11px",
      color: "#7a7165"
    }).setInteractive({ useHandCursor: true });
    skip.on("pointerover", () => { sfxHover(); skip.setColor("#c9b07a"); });
    skip.on("pointerout", () => skip.setColor("#7a7165"));
    skip.on("pointerdown", () => { sfxClick(); this.finish(); });

    for (const o of [g, title, body, got, skip]) {
      this.pin(o as Phaser.GameObjects.GameObject);
      (o as Phaser.GameObjects.Container).setDepth?.(1300);
      this.panelObjs.push(o as Phaser.GameObjects.GameObject);
    }

    // Fade the panel group in so steps don't teleport.
    for (const o of this.panelObjs) {
      const withAlpha = o as unknown as { setAlpha?: (a: number) => unknown; alpha?: number };
      withAlpha.setAlpha?.(0);
    }
    this.scene.tweens.add({ targets: this.panelObjs, alpha: 1, duration: 180 });

    if (step.arrow) {
      const a = step.arrow;
      this.arrowObj = this.scene.add.text(a.x, a.y, a.glyph, {
        fontFamily: "Arial, sans-serif",
        fontSize: "24px",
        color: "#ffd45a",
        stroke: "#1a0e04",
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(1300);
      this.pin(this.arrowObj);
      const prop = a.bobAxis === "x" ? "x" : "y";
      this.arrowTween = this.scene.tweens.add({
        targets: this.arrowObj,
        [prop]: (a.bobAxis === "x" ? a.x : a.y) - 7,
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
    // Chain immediate steps straight on; event-gated steps wait.
    if (next.waitFor === "immediate") this.show(next);
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
    if (this.arrowTween) { this.arrowTween.stop(); this.arrowTween = undefined; }
    if (this.arrowObj) { this.arrowObj.destroy(); this.arrowObj = undefined; }
    for (const o of this.panelObjs) o.destroy();
    this.panelObjs = [];
  }
}
