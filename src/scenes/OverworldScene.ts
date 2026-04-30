import Phaser from "phaser";
import { FAMILY_BODY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { ensureBackdropTexture, BACKDROPS } from "../art/BackdropArt";
import { getMusic, MUSIC } from "../audio/Music";
import { drawPanel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { BATTLES } from "../data/battles";
import { loadSave } from "../util/save";
import { sfxClick } from "../audio/Sfx";
import { SettingsButton } from "../ui/SettingsButton";

// World map / battle log. Lists all 21 battle nodes; lit-up = playable & unlocked.
export class OverworldScene extends Phaser.Scene {
  constructor() { super("OverworldScene"); }

  create(): void {
    const bgKey = ensureBackdropTexture(this, "bg_overworld", BACKDROPS.thuling);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    const v = this.add.graphics();
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.6, 0.6, 0.85, 0.85);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.text(GAME_WIDTH / 2, 50, "ANTHROS — Chronicle of Battles", {
      fontFamily: FAMILY_HEADING,
      fontSize: "32px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 92, "Pick a battle to enter. Lit nodes are playable in this build; the rest scaffold the full story.", {
      fontFamily: FAMILY_BODY,
      fontSize: "14px",
      color: "#c9b07a"
    }).setOrigin(0.5);

    // Layout: 3 rows × 7 columns of battle cards (21 total).
    const startX = 60;
    const startY = 140;
    const cardW = 158;
    const cardH = 100;
    const gapX = 10;
    const gapY = 12;
    const cols = 7;

    const save = loadSave();

    const detailG = this.add.graphics();
    const detailX = 40;
    const detailY = 510;
    const detailW = GAME_WIDTH - 80;
    const detailH = 160;
    drawPanel(detailG, detailX, detailY, detailW, detailH);

    // Button geometry computed up front so the body's wordWrap can use the
    // button's left edge as its right boundary. Previously body wrap was
    // (detailW - 220) which was based on panel width, not button position —
    // off by ~24px because the body text has its own 24px left margin and
    // the wrap width didn't account for the gap-to-button.
    const btnW = 180;
    const btnH = 40;
    const btnLeft = detailX + detailW - btnW - 24;          // 24px right padding
    const btnTop = detailY + detailH - btnH - 20;           // 20px bottom padding
    const bodyLeft = detailX + 24;
    const bodyWrapWidth = btnLeft - bodyLeft - 24;          // 24px gap before button

    const detailTitle = this.add.text(bodyLeft, detailY + 18, "", {
      fontFamily: FAMILY_HEADING,
      fontSize: "22px",
      color: "#f4d999"
    });
    const detailSub = this.add.text(bodyLeft, detailY + 50, "", {
      fontFamily: FAMILY_BODY,
      fontSize: "14px",
      color: "#c9b07a"
    });
    const detailBody = this.add.text(bodyLeft, detailY + 80, "", {
      fontFamily: FAMILY_BODY,
      fontSize: "14px",
      color: "#dad3bd",
      wordWrap: { width: bodyWrapWidth }
    });

    // Truncate the intro to MAX_BODY_LINES wrapped lines with an ellipsis
    // when it's longer. Battle intros are paragraph-length (5–8 wrapped
    // lines for the longer ones) and would otherwise overflow the panel
    // and slide under the Enter Battle button. The full intro text still
    // shows in BattlePrepScene before the fight, so this is just a teaser.
    const MAX_BODY_LINES = 3;
    const setBodyTruncated = (intro: string): void => {
      const wrapped = detailBody.getWrappedText(intro);
      if (wrapped.length <= MAX_BODY_LINES) {
        detailBody.setText(intro);
        return;
      }
      const visible = wrapped.slice(0, MAX_BODY_LINES);
      // Drop the last word on the trimmed line so the ellipsis sits flush
      // against a natural word boundary instead of mid-word.
      const lastIdx = MAX_BODY_LINES - 1;
      visible[lastIdx] = (visible[lastIdx] ?? "").replace(/\s*\S+$/, "") + " …";
      detailBody.setText(visible.join("\n"));
    };

    let selectedId: string | null = null;
    const playBtn = new Button(this, {
      x: btnLeft,
      y: btnTop,
      w: btnW, h: btnH,
      label: "Enter Battle ▸",
      primary: true,
      enabled: false,
      fontSize: 16,
      onClick: () => {
        if (!selectedId) return;
        sfxClick();
        const b = BATTLES.find((x) => x.id === selectedId);
        if (!b) return;
        if (b.playable) {
          this.scene.start("BattlePrepScene", { battleId: b.id });
        } else {
          // Show "not yet playable" floater
          const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 90, "This battle is scaffolded for the full story — not yet playable.", {
            fontFamily: FAMILY_BODY,
            fontSize: "16px",
            color: "#ff9c7a"
          }).setOrigin(0.5);
          this.tweens.add({ targets: t, alpha: 0, duration: 1800, onComplete: () => t.destroy() });
        }
      }
    });

    new Button(this, {
      x: 40, y: GAME_HEIGHT - 56,
      w: 140, h: 40,
      label: "◂ Title",
      primary: false,
      fontSize: 14,
      onClick: () => this.scene.start("TitleScene")
    });

    BATTLES.forEach((b, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);

      const cardG = this.add.graphics();
      const playable = b.playable;
      const completed = save.completedBattles.includes(b.id);
      const fillTop = playable ? 0x141a2a : 0x0d0f17;
      const fillBot = playable ? 0x070912 : 0x05060a;
      cardG.fillGradientStyle(fillTop, fillTop, fillBot, fillBot, 1);
      cardG.fillRect(x, y, cardW, cardH);
      const border = playable ? 0xc9b07a : 0x4a4a52;
      cardG.lineStyle(1, border, 1);
      cardG.strokeRect(x + 0.5, y + 0.5, cardW - 1, cardH - 1);

      // index badge
      const badge = this.add.text(x + 8, y + 6, `#${b.index}`, {
        fontFamily: FAMILY_HEADING,
        fontSize: "12px",
        color: playable ? "#f4d999" : "#6a6a72"
      });
      // title
      const t1 = this.add.text(x + cardW / 2, y + 26, b.title, {
        fontFamily: FAMILY_HEADING,
        fontSize: "13px",
        color: playable ? "#dccfa8" : "#76747a"
      }).setOrigin(0.5, 0);
      const t2 = this.add.text(x + cardW / 2, y + 46, b.subtitle, {
        fontFamily: FAMILY_BODY,
        fontSize: "13px",
        color: playable ? "#f8f0d8" : "#9a9aa0",
        wordWrap: { width: cardW - 16 },
        align: "center"
      }).setOrigin(0.5, 0);
      const t3 = this.add.text(x + cardW / 2, y + cardH - 22, b.difficultyLabel, {
        fontFamily: FAMILY_BODY,
        fontSize: "11px",
        color: playable ? "#c9b07a" : "#5a5a62"
      }).setOrigin(0.5, 0);

      if (completed) {
        const dot = this.add.text(x + cardW - 18, y + 4, "✓", {
          fontFamily: FAMILY_HEADING,
          fontSize: "18px",
          color: "#a4d36a"
        });
        void dot;
      }

      // Hit area
      const zone = this.add.zone(x, y, cardW, cardH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on("pointerover", () => {
        cardG.lineStyle(2, playable ? 0xffd97a : 0x8a8a92, 1);
        cardG.strokeRect(x + 0.5, y + 0.5, cardW - 1, cardH - 1);
        selectedId = b.id;
        detailTitle.setText(`${b.title} — ${b.subtitle}`);
        detailSub.setText(`${b.difficultyLabel} · music: ${b.music.replace("music_", "").replace(/_/g, " ")}`);
        setBodyTruncated(b.intro);
        playBtn.setEnabled(true);
        playBtn.setLabel(playable ? "Enter Battle ▸" : "Story Scaffold ▸");
      });
      zone.on("pointerout", () => {
        cardG.lineStyle(1, border, 1);
        cardG.strokeRect(x + 0.5, y + 0.5, cardW - 1, cardH - 1);
      });
      zone.on("pointerup", () => {
        if (b.playable) {
          this.scene.start("BattlePrepScene", { battleId: b.id });
        }
      });

      void badge; void t1; void t2; void t3;
    });

    getMusic(this).play(MUSIC.adventureAnthros, { fadeMs: 800 });
    this.cameras.main.fadeIn(450, 0, 0, 0);

    new SettingsButton(this, GAME_WIDTH - 32, 32);
  }
}
