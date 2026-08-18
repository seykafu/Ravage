import Phaser from "phaser";
import { FAMILY_BODY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { Button } from "../ui/Button";
import { drawPanel } from "../ui/Panel";
import { battleById } from "../data/battles";
import { ensureBackdropForKey } from "../art/BackdropArt";
import { getMusic, MUSIC } from "../audio/Music";
import { sfxConfirm, sfxDefeat } from "../audio/Sfx";
import { clearSuspendedBattle, loadSave, MAX_PERMITTED_DEATHS, resetSaveSlot, setSquadDeaths, writeSave } from "../util/save";
import { SettingsButton } from "../ui/SettingsButton";
import type { BattleId } from "../data/contentIds";

interface GameOverArgs {
  battleId: BattleId;
  // Player units lost in the battle that ended the run. Restarting the
  // chapter refunds exactly these, so the retry begins with the budget
  // the player carried INTO the chapter — otherwise the refunded run
  // would game-over again the moment anyone fell.
  deathsThisBattle?: number;
}

// Terminal scene shown when the campaign-wide death budget is exceeded.
// Reachable only from BattleScene.transitionToEndScene when the just-
// completed battle pushes squadDeaths past MAX_PERMITTED_DEATHS.
//
// Two ways back in, because losing a campaign twenty chapters deep to a
// death budget should not mean losing the campaign:
//   * "Restart Chapter" — refunds the losses this battle cost, clears
//     any suspend, and drops the player back into that chapter's prep.
//     The run continues; only the failed attempt is undone.
//   * "Restart Entire Game" — wipes the slot back to a fresh save after
//     confirming, and routes to SaveSlotScene for a clean B1.
// A small Title exit remains so the screen is never a trap.
//
// The scene reuses EndScene's defeat treatment (heavy vignette, danger
// music) on top of a unique "the line broke for good" copy block so the
// player understands this is a campaign-level loss, not a single-battle
// retry.
export class GameOverScene extends Phaser.Scene {
  private battleId!: BattleId;
  private deathsThisBattle = 0;

  constructor() { super("GameOverScene"); }

  init(data: GameOverArgs): void {
    this.battleId = data.battleId;
    this.deathsThisBattle = data.deathsThisBattle ?? 0;
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
    const refunded = Math.max(0, deaths - this.deathsThisBattle);
    const chapterName = node ? `${node.title} — ${node.subtitle}` : "this chapter";
    const body =
      `The squad can absorb a hard fight or two — but a campaign can't bury more than ` +
      `${MAX_PERMITTED_DEATHS}. Madame Dawn's people will keep moving without you.

` +
      `Total losses: ${deaths} of ${MAX_PERMITTED_DEATHS} permitted` +
      (this.deathsThisBattle > 0 ? `  ·  ${this.deathsThisBattle} of them in ${chapterName}` : "") +
      `.

` +
      `Take the chapter again and those ${this.deathsThisBattle > 0 ? this.deathsThisBattle : "recent"} ` +
      `losses are struck from the ledger — you'd go back in at ${refunded} of ${MAX_PERMITTED_DEATHS}. ` +
      `Or start the whole road over from the palace.`;

    this.add.text(panelX + 28, panelY + 22, body, {
      fontFamily: FAMILY_BODY,
      fontSize: "18px",
      color: "#e6e0d0",
      wordWrap: { width: panelW - 56 },
      lineSpacing: 6
    });

    // Buttons row.
    const btnY = GAME_HEIGHT - 108;
    const btnH = 48;
    const btnW = 220;
    const gap = 24;

    const chapterBtn = new Button(this, {
      x: GAME_WIDTH / 2 - btnW - gap / 2,
      y: btnY,
      w: btnW,
      h: btnH,
      label: "Restart Chapter",
      primary: true,
      fontSize: 18,
      onClick: () => {
        sfxConfirm();
        // Refund this chapter's losses and drop any mid-battle snapshot,
        // then hand the player back to its prep screen. Everything else
        // about the run — levels, items, unlocks — is untouched.
        const s = loadSave();
        writeSave(setSquadDeaths(s, (s.squadDeaths ?? 0) - this.deathsThisBattle));
        clearSuspendedBattle();
        this.cameras.main.fadeOut(450, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () =>
          this.scene.start("BattlePrepScene", { battleId: this.battleId })
        );
      }
    });

    const restartBtn = new Button(this, {
      x: GAME_WIDTH / 2 + gap / 2,
      y: btnY,
      w: btnW,
      h: btnH,
      label: "Restart Entire Game",
      primary: false,
      fontSize: 16,
      onClick: () => {
        sfxConfirm();
        // Destructive and previously unguarded — one click used to erase
        // a whole campaign.
        const ok = window.confirm(
          "Restart the entire game?\n\nThis erases this slot completely — every chapter, " +
          "level, and item — and begins again at the palace.\n\nRestarting just the chapter " +
          "keeps your run."
        );
        if (!ok) return;
        resetSaveSlot();
        this.cameras.main.fadeOut(450, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("SaveSlotScene"));
      }
    });

    // Small exit so the screen is never a dead end.
    const titleBtn = new Button(this, {
      x: GAME_WIDTH / 2 - 70,
      y: btnY + btnH + 10,
      w: 140,
      h: 30,
      label: "Title",
      primary: false,
      fontSize: 13,
      onClick: () => {
        sfxConfirm();
        this.cameras.main.fadeOut(450, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("TitleScene"));
      }
    });

    void chapterBtn; void restartBtn; void titleBtn;

    sfxDefeat();
    getMusic(this).play(MUSIC.danger, { fadeMs: 1000 });
    this.cameras.main.fadeIn(500, 0, 0, 0);

    new SettingsButton(this, GAME_WIDTH - 32, 32);
  }
}
