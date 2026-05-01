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
import { createScrollableText } from "../ui/scrollableText";

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

    // Layout: 4 rows × 8 columns of battle cards (32 slots, 30 used).
    // Bumped from 3 rows × 7 cols (21 total) when the chapter list
    // expanded to 30. With the prior layout the bottom two rows
    // overlapped the detail panel at y=510 and — since cards are
    // created AFTER the panel in this scene — rendered ON TOP of it,
    // hiding the hover-detail text behind a wall of card backgrounds.
    // The new geometry keeps the grid above y=470 with a 40px breath
    // before the detail panel begins.
    const startX = 60;
    const startY = 140;
    const cardW = 136;
    const cardH = 80;
    const gapX = 10;
    const gapY = 12;
    const cols = 8;

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

    // Body uses the scrollable-text helper instead of the previous "truncate
    // to 3 lines + ellipsis" hack. Long intros stay readable in full via
    // the mouse wheel; the helper auto-shows a thin gold scrollbar on the
    // right edge of the body region when the body overflows the visible
    // height.
    //
    // Body extends to the BOTTOM of the panel (with 12px padding), not
    // just to the top of the button — earlier version tied bodyBottom to
    // btnTop-12 which collapsed the body to ~10px tall and clipped almost
    // the entire intro. The button doesn't actually block the body
    // vertically: bodyWrapWidth already excludes the button's horizontal
    // range, so body text + button can coexist at the same y range without
    // ever overlapping. The scrollbar lands ~30px to the left of the
    // button (sbX = bodyLeft + bodyWrapWidth - 6), well clear of it.
    const bodyTop = detailY + 72;
    const bodyBottom = detailY + detailH - 12;
    const bodyHeight = bodyBottom - bodyTop;
    const bodyHandle = createScrollableText(this, {
      x: bodyLeft,
      y: bodyTop,
      w: bodyWrapWidth,
      h: bodyHeight,
      text: "",
      style: {
        fontFamily: FAMILY_BODY,
        fontSize: "14px",
        color: "#dad3bd",
        lineSpacing: 4
      }
    });

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
        // Defensive check: same gating as the cards. The button is
        // disabled on locked-card hover so this branch shouldn't fire,
        // but a future code path that enables the button should still
        // be blocked from routing into a locked battle.
        const isUnlocked = save.unlockedBattles.includes(b.id);
        if (!isUnlocked) {
          const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 90, "Locked — complete previous battles to unlock.", {
            fontFamily: FAMILY_BODY,
            fontSize: "16px",
            color: "#ff9c7a"
          }).setOrigin(0.5);
          this.tweens.add({ targets: t, alpha: 0, duration: 1800, onComplete: () => t.destroy() });
          return;
        }
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

    // Roster button — opens RosterScene as a paused overlay so the player
    // can review their party's current levels / stats / abilities between
    // battles. Sits next to the Title button at the bottom-left.
    new Button(this, {
      x: 196, y: GAME_HEIGHT - 56,
      w: 140, h: 40,
      label: "📋 Roster",
      primary: false,
      fontSize: 14,
      onClick: () => {
        sfxClick();
        this.scene.pause();
        this.scene.run("RosterScene", { from: this.scene.key });
      }
    });

    BATTLES.forEach((b, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gapX);
      const y = startY + row * (cardH + gapY);

      // Three-state cascade per battle:
      //   - LOCKED: not in save.unlockedBattles. Player hasn't reached this
      //     point in the story. Card visible (builds anticipation) but
      //     darker; hover hides intro to avoid spoilers; click is no-op
      //     with a floater explaining how to unlock.
      //   - SCAFFOLDED: unlocked but b.playable === false. Battle is in
      //     the data but no map/units authored yet. Hover shows intro +
      //     "Story Scaffold ▸" affordance; click shows the existing
      //     "scaffolded for the full story" floater.
      //   - PLAYABLE: unlocked AND b.playable. Click enters the battle.
      const unlocked = save.unlockedBattles.includes(b.id);
      const playable = b.playable && unlocked;
      const scaffolded = !b.playable && unlocked;
      const locked = !unlocked;
      const completed = save.completedBattles.includes(b.id) && unlocked;

      const cardG = this.add.graphics();
      // Color tier: playable = blue/gold, scaffolded = grey, locked = darker grey.
      const fillTop = playable ? 0x141a2a : (scaffolded ? 0x0d0f17 : 0x07090f);
      const fillBot = playable ? 0x070912 : (scaffolded ? 0x05060a : 0x030408);
      cardG.fillGradientStyle(fillTop, fillTop, fillBot, fillBot, 1);
      cardG.fillRect(x, y, cardW, cardH);
      const border = playable ? 0xc9b07a : (scaffolded ? 0x4a4a52 : 0x2a2a32);
      cardG.lineStyle(1, border, 1);
      cardG.strokeRect(x + 0.5, y + 0.5, cardW - 1, cardH - 1);

      // index badge
      const badgeColor = playable ? "#f4d999" : (scaffolded ? "#6a6a72" : "#3a3a42");
      const badge = this.add.text(x + 6, y + 4, `#${b.index}`, {
        fontFamily: FAMILY_HEADING,
        fontSize: "11px",
        color: badgeColor
      });
      // title — compact "Battle N" instead of "First/Second/..." so the
      // narrow card width doesn't wrap two-word titles into a second line
      // that would push the subtitle off the bottom of the card.
      const titleColor = playable ? "#dccfa8" : (scaffolded ? "#76747a" : "#46454a");
      const t1 = this.add.text(x + cardW / 2, y + 18, `Battle ${b.index}`, {
        fontFamily: FAMILY_HEADING,
        fontSize: "12px",
        color: titleColor
      }).setOrigin(0.5, 0);
      // subtitle: hidden on locked battles to avoid spoilers in the grid view
      const subColor = playable ? "#f8f0d8" : (scaffolded ? "#9a9aa0" : "#46454a");
      const subText = locked ? "— locked —" : b.subtitle;
      const t2 = this.add.text(x + cardW / 2, y + 35, subText, {
        fontFamily: FAMILY_BODY,
        fontSize: "12px",
        color: subColor,
        wordWrap: { width: cardW - 12 },
        align: "center",
        fontStyle: locked ? "italic" : "normal"
      }).setOrigin(0.5, 0);
      const diffColor = playable ? "#c9b07a" : (scaffolded ? "#5a5a62" : "#3a3a42");
      const t3 = this.add.text(x + cardW / 2, y + cardH - 16, b.difficultyLabel, {
        fontFamily: FAMILY_BODY,
        fontSize: "10px",
        color: diffColor
      }).setOrigin(0.5, 0);

      if (completed) {
        const dot = this.add.text(x + cardW - 14, y + 2, "✓", {
          fontFamily: FAMILY_HEADING,
          fontSize: "14px",
          color: "#a4d36a"
        });
        void dot;
      }
      if (locked) {
        const lockIcon = this.add.text(x + cardW - 16, y + 2, "🔒", {
          fontFamily: FAMILY_BODY,
          fontSize: "12px",
          color: "#5a5a62"
        });
        void lockIcon;
      }

      // Hit area — locked cards are interactive (hover + click) but the
      // hover suppresses the intro and the click shows a "locked" floater
      // instead of routing into BattlePrepScene.
      const zone = this.add.zone(x, y, cardW, cardH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      const hoverBorder = playable ? 0xffd97a : (scaffolded ? 0x8a8a92 : 0x4a4a52);
      zone.on("pointerover", () => {
        cardG.lineStyle(2, hoverBorder, 1);
        cardG.strokeRect(x + 0.5, y + 0.5, cardW - 1, cardH - 1);
        selectedId = b.id;
        if (locked) {
          detailTitle.setText(`Battle ${b.index} — Locked`);
          detailSub.setText("Complete previous battles to unlock");
          bodyHandle.setText("This battle hasn't been unlocked yet. Progress through the story to reach it.");
          playBtn.setEnabled(false);
          playBtn.setLabel("Locked 🔒");
        } else {
          detailTitle.setText(`${b.title} — ${b.subtitle}`);
          detailSub.setText(`${b.difficultyLabel} · music: ${b.music.replace("music_", "").replace(/_/g, " ")}`);
          // Full intro shown — scrollable when it overflows. setText resets
          // scroll to the top so the player sees the start of every new
          // hovered battle.
          bodyHandle.setText(b.intro);
          playBtn.setEnabled(true);
          playBtn.setLabel(playable ? "Enter Battle ▸" : "Story Scaffold ▸");
        }
      });
      zone.on("pointerout", () => {
        cardG.lineStyle(1, border, 1);
        cardG.strokeRect(x + 0.5, y + 0.5, cardW - 1, cardH - 1);
      });
      zone.on("pointerup", () => {
        if (playable) {
          this.scene.start("BattlePrepScene", { battleId: b.id });
        } else if (locked) {
          // Floater: "Locked — complete previous battles to unlock"
          const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 90, "Locked — complete previous battles to unlock.", {
            fontFamily: FAMILY_BODY,
            fontSize: "16px",
            color: "#ff9c7a"
          }).setOrigin(0.5);
          this.tweens.add({ targets: t, alpha: 0, duration: 1800, onComplete: () => t.destroy() });
        }
        // Scaffolded (unlocked but unauthored) is handled by the playBtn
        // onClick — the floater there is the same "story scaffold" message.
      });

      void badge; void t1; void t2; void t3;
    });

    getMusic(this).play(MUSIC.adventureAnthros, { fadeMs: 800 });
    this.cameras.main.fadeIn(450, 0, 0, 0);

    new SettingsButton(this, GAME_WIDTH - 32, 32);
  }
}
