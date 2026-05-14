import Phaser from "phaser";
import { FAMILY_BODY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { Button } from "../ui/Button";
import { drawPanel } from "../ui/Panel";
import { battleById } from "../data/battles";
import { ensureBackdropForKey } from "../art/BackdropArt";
import { getMusic, MUSIC } from "../audio/Music";
import { sfxConfirm, sfxDefeat } from "../audio/Sfx";
import { loadSave, MAX_PERMITTED_DEATHS, resetSaveSlot } from "../util/save";
import { SettingsButton } from "../ui/SettingsButton";
import type { BattleId } from "../data/contentIds";

interface GameOverArgs {
  battleId: BattleId;
}

// Terminal scene shown when the campaign-wide death budget is exceeded.
// Reachable only from BattleScene.transitionToEndScene when the just-
// completed battle pushes squadDeaths past MAX_PERMITTED_DEATHS.
//
// Two affordances:
//   * "Restart slot" — wipes the save back to a fresh slot and routes to
//     SaveSlotScene so the player can re-enter B1 from a clean state.
//   * "Title" — bows out to TitleScene without modifying the save (a
//     curious player can poke at the broken run via DevJump if they
//     want, but the campaign itself won't let them progress).
//
// The scene reuses EndScene's defeat treatment (heavy vignette, danger
// music) on top of a unique "the line broke for good" copy block so the
// player understands this is a campaign-level loss, not a single-battle
// retry.
export class GameOverScene extends Phaser.Scene {
  private battleId!: BattleId;

  constructor() { super("GameOverScene"); }

  init(data: GameOverArgs): void {
    this.battleId = data.battleId;
  }

  create(): void {
    const node = battleById(this.battleId);
    const bdKey = node?.backdropKey ?? "bg_thuling";
    const bgKey = ensureBackdropForKey(this, bdKey);
    const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    bg.setAlpha(0.35);

    const v = this.add.graphics();
    v.fillStyle(0x000000, 0.65);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Banner — same scale as VICTORY/DEFEAT but in the deep crimson the
    // EndScene defeat path uses, so the player reads "this is worse than
    // a normal loss" without needing copy to spell it out.
    const banner = this.add.text(GAME_WIDTH / 2, 200, "GAME OVER", {
      fontFamily: FAMILY_HEADING,
      fontSize: "96px",
      color: "#a83c3c",
      stroke: "#1a0404",
      strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 6, color: "#000", blur: 18, fill: true }
    }).setOrigin(0.5);
    banner.setAlpha(0);
    this.tweens.add({ targets: banner, alpha: 1, y: 220, duration: 800, ease: "Sine.easeOut" });

    const subtitle = this.add.text(GAME_WIDTH / 2, 290, "The squad's losses crossed the line.", {
      fontFamily: FAMILY_BODY,
      fontSize: "20px",
      color: "#c9b07a"
    }).setOrigin(0.5);
    void subtitle;

    // Body panel — explains the lives system in-fiction so the player
    // understands what happened. Numbers come from the live save so the
    // copy stays accurate even if MAX_PERMITTED_DEATHS is retuned later.
    const panelW = 880;
    const panelH = 240;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = 340;
    const pg = this.add.graphics();
    drawPanel(pg, panelX, panelY, panelW, panelH);

    const save = loadSave();
    const deaths = save.squadDeaths ?? 0;
    const body =
      `Four bodies in the dirt. The squad can absorb a hard fight or two — but a campaign can't ` +
      `bury more than ${MAX_PERMITTED_DEATHS}. Madame Dawn's people will keep moving without you. ` +
      `Amar's name will fade.\n\n` +
      `Total losses: ${deaths} of ${MAX_PERMITTED_DEATHS} permitted.\n\n` +
      `Restart the slot to take another run at it, or step back to the title.`;

    this.add.text(panelX + 28, panelY + 22, body, {
      fontFamily: FAMILY_BODY,
      fontSize: "18px",
      color: "#e6e0d0",
      wordWrap: { width: panelW - 56 },
      lineSpacing: 6
    });

    // Buttons row.
    const btnY = GAME_HEIGHT - 80;
    const btnH = 48;
    const btnW = 220;
    const gap = 24;

    const restartBtn = new Button(this, {
      x: GAME_WIDTH / 2 - btnW - gap / 2,
      y: btnY,
      w: btnW,
      h: btnH,
      label: "Restart Slot",
      primary: true,
      fontSize: 18,
      onClick: () => {
        sfxConfirm();
        // Wipe the save first so the player can't dodge by hitting
        // back/forward — squadDeaths goes back to 0, completed/unlocked
        // resets, character records cleared. Then route to SaveSlotScene
        // (which is the canonical "pick a slot to play" entry).
        resetSaveSlot();
        this.cameras.main.fadeOut(450, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("SaveSlotScene"));
      }
    });

    const titleBtn = new Button(this, {
      x: GAME_WIDTH / 2 + gap / 2,
      y: btnY,
      w: btnW,
      h: btnH,
      label: "Title",
      primary: false,
      fontSize: 16,
      onClick: () => {
        sfxConfirm();
        this.cameras.main.fadeOut(450, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("TitleScene"));
      }
    });

    void restartBtn; void titleBtn;

    sfxDefeat();
    getMusic(this).play(MUSIC.danger, { fadeMs: 1000 });
    this.cameras.main.fadeIn(500, 0, 0, 0);

    new SettingsButton(this, GAME_WIDTH - 32, 32);
  }
}
