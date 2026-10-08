import Phaser from "phaser";
import { FAMILY_BODY, FAMILY_DISPLAY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { BATTLES, resolveBattleForPath } from "../data/battles";
import { ensureBackdropForKey } from "../art/BackdropArt";
import { getSevenPath, loadSave } from "../util/save";
import { sfxCineBoom } from "../audio/Sfx";

// "Previously on Ravage" — a returning player's way back in.
//
// Played when a save is resumed (the title's Resume, or a slot loaded from
// the save screen), before the camp: the last chapter won, over its own
// battlefield, with the words that closed it. A click or a key skips it;
// a save that hasn't won a battle yet goes straight on.

export class RecapScene extends Phaser.Scene {
  private leaving = false;

  constructor() { super("RecapScene"); }

  create(): void {
    this.leaving = false;
    const save = loadSave();
    const last = BATTLES
      .filter((b) => save.completedBattles.includes(b.id))
      .sort((a, b) => b.index - a.index)[0];
    if (!last) { this.scene.start("CampScene"); return; }
    const node = resolveBattleForPath(last, getSevenPath(save));
    const W = GAME_WIDTH, H = GAME_HEIGHT;

    const bg = this.add.image(W / 2, H / 2, ensureBackdropForKey(this, node.backdropKey))
      .setDisplaySize(W * 1.08, H * 1.08).setAlpha(0.6);
    this.tweens.add({ targets: bg, x: W / 2 - 30, y: H / 2 + 8, duration: 12000, ease: "Sine.easeInOut" });
    const v = this.add.graphics();
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0.9, 0.9);
    v.fillRect(0, 0, W, H);

    const small = this.add.text(W / 2, 150, "PREVIOUSLY ON", {
      fontFamily: FAMILY_HEADING, fontSize: "18px", color: "#c9b07a", letterSpacing: 10
    }).setOrigin(0.5).setAlpha(0);
    const title = this.add.text(W / 2, 200, "RAVAGE", {
      fontFamily: FAMILY_DISPLAY, fontSize: "64px", color: "#f4d999", stroke: "#1a0e04", strokeThickness: 7,
      shadow: { offsetX: 0, offsetY: 4, color: "#000", blur: 16, fill: true }
    }).setOrigin(0.5).setAlpha(0).setLetterSpacing(14);
    const rule = this.add.rectangle(W / 2, 252, 0, 2, 0xc9a24a, 0.9);
    const chapter = this.add.text(W / 2, 290, `${node.title} — ${node.subtitle}`, {
      fontFamily: FAMILY_HEADING, fontSize: "24px", color: "#f3ecd9", stroke: "#000", strokeThickness: 3
    }).setOrigin(0.5).setAlpha(0);
    const outro = this.add.text(W / 2, 340, node.outro ?? "", {
      fontFamily: FAMILY_BODY, fontSize: "22px", color: "#e6dcc4", fontStyle: "italic", align: "center",
      wordWrap: { width: 860 }, lineSpacing: 8, stroke: "#000", strokeThickness: 3
    }).setOrigin(0.5, 0).setAlpha(0);
    const hint = this.add.text(W - 30, H - 26, "click to continue", {
      fontFamily: FAMILY_BODY, fontSize: "15px", color: "#8a8272", fontStyle: "italic"
    }).setOrigin(1, 0.5).setAlpha(0);

    this.cameras.main.fadeIn(600, 0, 0, 0);
    this.tweens.add({ targets: small, alpha: 1, duration: 600, delay: 300 });
    const spacing = { v: 14 };
    this.tweens.add({ targets: title, alpha: 1, duration: 800, delay: 300 });
    this.tweens.add({ targets: spacing, v: 6, duration: 1400, delay: 300, ease: "Cubic.easeOut", onUpdate: () => title.setLetterSpacing(spacing.v) });
    this.time.delayedCall(450, () => sfxCineBoom());
    this.tweens.add({ targets: rule, width: 420, duration: 900, delay: 700, ease: "Cubic.easeOut" });
    this.tweens.add({ targets: chapter, alpha: 1, duration: 700, delay: 1100 });
    this.tweens.add({ targets: outro, alpha: 1, duration: 900, delay: 1700 });
    this.tweens.add({ targets: hint, alpha: 0.75, duration: 600, delay: 2200 });

    // Long enough to read the outro at an easy pace; a click goes sooner.
    const readMs = 3200 + (node.outro?.length ?? 0) * 38;
    this.time.delayedCall(readMs, () => this.leave());
    this.time.delayedCall(500, () => {
      this.input.once("pointerdown", () => this.leave());
      this.input.keyboard?.once("keydown", () => this.leave());
    });
  }

  private leave(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("CampScene"));
  }
}
