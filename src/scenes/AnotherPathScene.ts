import Phaser from "phaser";
import { FAMILY_BODY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { Button } from "../ui/Button";
import { drawPanel } from "../ui/Panel";
import { ensureBackdropForKey } from "../art/BackdropArt";
import { sfxClick, sfxConfirm } from "../audio/Sfx";
import {
  getSevenPath,
  loadSave,
  markCampaignComplete,
  pathsWalked,
  rewindToPathChoice,
  slotsPastThePathFork,
  writeSave,
  writeSaveToSlot,
  type SaveState,
  type SlotIndex
} from "../util/save";

// ─────────────────────────────────────────────────────────────────────────
// AnotherPathScene — Khione's offer, made mechanical.
//
// Reached two ways: from post_epilogue (the road after the post-credits
// skirmish) and from the title screen's standing "Another Road" entry.
//
// The player picks WHICH SAVE walks the new road. Any save that has
// passed the Seven Paths fork (B18) qualifies; the chosen one rewinds to
// the fork and restarts at ChoiceScene. Progression is restored from
// that save's own fork snapshot, so the second road begins with the
// squad the player actually had at B18 — their levels then, their items
// then — not the level-20 veterans who finished the campaign.
//
// The rewind REPLACES the chosen save's post-fork progress, so it asks
// first. The campaign-completion record is stamped before anything
// moves and survives the rewind, so a finished run is never erased from
// the record even when its slot is reused.
// ─────────────────────────────────────────────────────────────────────────

const PATH_LABEL: Record<string, string> = {
  vengeance: "Vengeance",
  restoration: "Restoration",
  revolution: "Revolution",
  duty: "Duty",
  mercy: "Mercy",
  exile: "Exile",
  forgetting: "Forgetting"
};

export class AnotherPathScene extends Phaser.Scene {
  constructor() { super("AnotherPathScene"); }

  create(): void {
    // Stamp completion on the ACTIVE save first, if it finished a road —
    // before any rewind can touch anything.
    const active = loadSave();
    if (active.completedBattles.includes("b29_epilogue")) {
      writeSave(markCampaignComplete(active, getSevenPath(active)));
    }

    const bgKey = ensureBackdropForKey(this, "bg_farmland");
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.30);
    const v = this.add.graphics();
    v.fillStyle(0x05060a, 0.70);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.text(GAME_WIDTH / 2, 56, "The Road Forks", {
      fontFamily: FAMILY_HEADING, fontSize: "34px", color: "#f4e4b0",
      stroke: "#1a0e04", strokeThickness: 4
    }).setOrigin(0.5);

    const eligible = slotsPastThePathFork();

    this.add.text(GAME_WIDTH / 2, 98,
      eligible.length > 0
        ? "Khione knows the water to every road you didn't take. Which life should she sail back?"
        : "No save has reached the fork yet — there is no road to sail back to.", {
      fontFamily: FAMILY_BODY, fontSize: "16px", color: "#c9b07a",
      fontStyle: "italic", align: "center", wordWrap: { width: 900 }
    }).setOrigin(0.5);

    if (eligible.length === 0) {
      this.addExit("Back to the title");
      this.cameras.main.fadeIn(600, 0, 0, 0);
      return;
    }

    // One card per eligible save.
    const cardW = 300;
    const cardH = 250;
    const gap = 26;
    const totalW = eligible.length * cardW + (eligible.length - 1) * gap;
    const startX = (GAME_WIDTH - totalW) / 2;
    eligible.forEach((entry, i) => {
      this.buildSlotCard(entry.slot, entry.save, startX + i * (cardW + gap), 150, cardW, cardH);
    });

    this.addExit("Rest here");
    this.cameras.main.fadeIn(600, 0, 0, 0);
  }

  private buildSlotCard(slot: SlotIndex, save: SaveState, x: number, y: number, w: number, h: number): void {
    const g = this.add.graphics();
    drawPanel(g, x, y, w, h);

    const path = getSevenPath(save);
    const walked = pathsWalked(save);
    const finished = save.completedBattles.includes("b29_epilogue");
    const snap = save.pathForkSnapshot;
    const chapters = save.completedBattles.length;

    this.add.text(x + w / 2, y + 16, `Save Slot ${slot}`, {
      fontFamily: FAMILY_HEADING, fontSize: "20px", color: "#f4d999",
      stroke: "#1a0e04", strokeThickness: 3
    }).setOrigin(0.5, 0);

    const lines: string[] = [];
    lines.push(path ? `Road walked: ${PATH_LABEL[path] ?? path}` : "At the fork, undecided");
    lines.push(finished ? "Campaign finished" : `${chapters} battles behind them`);
    if (walked.length > 0) lines.push(`Recorded: ${walked.map((p) => PATH_LABEL[p] ?? p).join(", ")}`);
    lines.push("");
    if (snap) {
      const roster = Object.entries(snap.characters);
      const avg = roster.length
        ? Math.round(roster.reduce((n, [, r]) => n + r.level, 0) / roster.length)
        : 0;
      lines.push(`Restores the squad as it stood at the fork:`);
      lines.push(`${roster.length} character${roster.length === 1 ? "" : "s"}, around level ${avg}`);
      lines.push(`${snap.squadInventory.length} item${snap.squadInventory.length === 1 ? "" : "s"} in the pack`);
    } else {
      lines.push("No fork snapshot on this save — it predates them.");
      lines.push("The squad keeps the levels and items it has now.");
    }

    this.add.text(x + 18, y + 52, lines.join("\n"), {
      fontFamily: FAMILY_BODY, fontSize: "13px", color: "#c8c2b2",
      wordWrap: { width: w - 36 }, lineSpacing: 4
    });

    new Button(this, {
      x: x + 20, y: y + h - 54, w: w - 40, h: 40,
      label: "Walk another road", primary: true, fontSize: 15,
      onClick: () => this.commit(slot, save)
    });
  }

  private commit(slot: SlotIndex, save: SaveState): void {
    sfxConfirm();
    const finished = save.completedBattles.includes("b29_epilogue");
    const ok = window.confirm(
      `Slot ${slot} rewinds to the Seven Paths choice.\n\n` +
      `The squad returns to the levels and items it had at that point, and everything ` +
      `after the fork is replaced by the new road.` +
      (finished ? `\n\nThis save's finished campaign stays on the record.` : "") +
      `\n\nContinue?`
    );
    if (!ok) return;
    // The completion record is stamped onto the rewound state itself, so
    // reusing a finished slot never erases the fact that it was finished.
    const stamped = finished ? markCampaignComplete(save, getSevenPath(save)) : save;
    writeSaveToSlot(slot, rewindToPathChoice(stamped));
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("ChoiceScene"));
  }

  private addExit(label: string): void {
    new Button(this, {
      x: GAME_WIDTH / 2 - 130, y: GAME_HEIGHT - 78, w: 260, h: 46,
      label, primary: false, fontSize: 16,
      onClick: () => {
        sfxClick();
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("TitleScene"));
      }
    });
    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 26,
      "Either answer is a real one. The war is over in both.", {
      fontFamily: FAMILY_BODY, fontSize: "13px", color: "#7a7165", fontStyle: "italic"
    }).setOrigin(0.5);
  }
}
