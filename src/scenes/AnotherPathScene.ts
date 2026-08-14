import Phaser from "phaser";
import { FAMILY_BODY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { Button } from "../ui/Button";
import { drawPanel } from "../ui/Panel";
import { ensureBackdropForKey } from "../art/BackdropArt";
import { sfxClick, sfxConfirm } from "../audio/Sfx";
import {
  findEmptySlot,
  getSevenPath,
  loadSave,
  markCampaignComplete,
  pathsWalked,
  rewindToPathChoice,
  writeSave,
  writeSaveToSlot
} from "../util/save";

// ─────────────────────────────────────────────────────────────────────────
// AnotherPathScene — Khione's offer, made mechanical.
//
// Reached from post_epilogue (the road after the post-credits skirmish).
// The player may walk one of the roads they didn't take: the campaign
// rewinds to the B18 fork with progression intact (levels, promotions,
// squad inventory) and restarts at ChoiceScene.
//
// THE FINISHED RUN IS NEVER DESTROYED. The completed save is stamped
// with its path in CAMPAIGN_COMPLETE_FLAG and left exactly where it is;
// the rewound copy is written into an EMPTY slot and made active. If all
// three slots are full, the offer is shown as unavailable with the
// reason spelled out, rather than silently overwriting a 28-battle
// campaign to make room for itself.
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
    // Stamp the completion FIRST — before any rewind can be offered, the
    // finished run is on the record.
    const finished = loadSave();
    const walkedPath = getSevenPath(finished);
    const stamped = markCampaignComplete(finished, walkedPath);
    writeSave(stamped);

    const bgKey = ensureBackdropForKey(this, "bg_farmland");
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey)
      .setDisplaySize(GAME_WIDTH, GAME_HEIGHT).setAlpha(0.32);
    const v = this.add.graphics();
    v.fillStyle(0x05060a, 0.68);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.text(GAME_WIDTH / 2, 74, "The Road Forks", {
      fontFamily: FAMILY_HEADING, fontSize: "34px", color: "#f4e4b0",
      stroke: "#1a0e04", strokeThickness: 4
    }).setOrigin(0.5);

    const walked = pathsWalked(stamped);
    const walkedLine = walked.length > 0
      ? `Roads walked: ${walked.map((p) => PATH_LABEL[p] ?? p).join(" · ")}`
      : "";
    this.add.text(GAME_WIDTH / 2, 116, walkedLine, {
      fontFamily: FAMILY_BODY, fontSize: "15px", color: "#c9b07a"
    }).setOrigin(0.5);

    const panelW = 760;
    const panelH = 210;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = 158;
    const pg = this.add.graphics();
    drawPanel(pg, panelX, panelY, panelW, panelH);

    const slot = findEmptySlot();
    const body = slot
      ? "Khione keeps a ship, and she knows the water to every road you didn't take.\n\n" +
        "Your squad keeps everything it earned — levels, promotions, the whole armoury. " +
        `The story rewinds to the night in the hold, three days before landfall, and you choose again.\n\n` +
        `This finished run stays exactly where it is. The new road begins in save slot ${slot}.`
      : "Khione keeps a ship — but every save slot is full, and she will not sail over " +
        "a life someone already finished.\n\nFree a slot from the title screen's save menu " +
        "and her offer stands. Your completed campaign is recorded either way.";

    this.add.text(panelX + 30, panelY + 26, body, {
      fontFamily: FAMILY_BODY, fontSize: "16px", color: "#e6e0d0",
      wordWrap: { width: panelW - 60 }, lineSpacing: 6
    });

    const btnY = GAME_HEIGHT - 150;
    const btnW = 300;
    const gap = 28;

    new Button(this, {
      x: GAME_WIDTH / 2 - btnW - gap / 2, y: btnY, w: btnW, h: 52,
      label: slot ? "Walk another road" : "Walk another road (no free slot)",
      primary: true, enabled: !!slot, fontSize: 17,
      onClick: () => {
        if (!slot) return;
        sfxConfirm();
        // The rewind lands in the EMPTY slot; the finished save (already
        // stamped above) is untouched in its own.
        writeSaveToSlot(slot, rewindToPathChoice(stamped));
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("ChoiceScene"));
      }
    });

    new Button(this, {
      x: GAME_WIDTH / 2 + gap / 2, y: btnY, w: btnW, h: 52,
      label: "Rest here",
      primary: false, fontSize: 17,
      onClick: () => {
        sfxClick();
        this.cameras.main.fadeOut(600, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("TitleScene"));
      }
    });

    this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 62,
      "Either answer is a real one. The war is over in both.", {
      fontFamily: FAMILY_BODY, fontSize: "14px", color: "#7a7165", fontStyle: "italic"
    }).setOrigin(0.5);

    this.cameras.main.fadeIn(700, 0, 0, 0);
  }
}
