import Phaser from "phaser";
import { FAMILY_BODY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { Button } from "../ui/Button";
import { drawPanel } from "../ui/Panel";
import { battleById, BATTLES, resolveBattleForPath } from "../data/battles";
import { getMusic, MUSIC } from "../audio/Music";
import { sfxConfirm, sfxDefeat, sfxVictory } from "../audio/Sfx";
import { ensureBackdropForKey } from "../art/BackdropArt";
import { getSevenPath, loadSave, MAX_PERMITTED_DEATHS } from "../util/save";
import { FINAL_PLAYABLE, resolvePostArc } from "../data/postArcs";
import { SettingsButton } from "../ui/SettingsButton";
import { ITEM_CATALOG } from "../combat/items";
import type { ItemKind } from "../combat/types";
import type { ArcId, BattleId } from "../data/contentIds";

interface EndArgs {
  battleId: BattleId;
  outcome: "player" | "enemy";
}

// Post-battle arc routing lives in src/data/postArcs.ts so the
// campaign-integrity suite can assert every non-terminal battle
// actually routes into a real arc (b20/b21/b23-b28 once fell through
// the camp fallback below with no story at all).

export class EndScene extends Phaser.Scene {
  private battleId!: BattleId;
  private outcome!: "player" | "enemy";

  constructor() { super("EndScene"); }

  init(data: EndArgs): void {
    this.battleId = data.battleId;
    this.outcome = data.outcome;
  }

  private resolvePostArc(): ArcId | undefined {
    return resolvePostArc(this.battleId, getSevenPath(loadSave()));
  }

  create(): void {
    const rawNode = battleById(this.battleId);
    // Per-path outro text for the endgame climaxes.
    const node = rawNode ? resolveBattleForPath(rawNode, getSevenPath(loadSave())) : undefined;
    const isVictory = this.outcome === "player";

    const bdKey = node?.backdropKey ?? "bg_thuling";
    const bgKey = ensureBackdropForKey(this, bdKey);
    const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    bg.setAlpha(0.55);

    // Heavy vignette
    const v = this.add.graphics();
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.7, 0.7, 0.92, 0.92);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Banner word
    const word = isVictory ? "VICTORY" : "DEFEAT";
    const accent = isVictory ? "#f4d999" : "#a83c3c";
    const stroke = isVictory ? "#1a0e04" : "#1a0404";

    const banner = this.add.text(GAME_WIDTH / 2, 180, word, {
      fontFamily: FAMILY_HEADING,
      fontSize: "96px",
      color: accent,
      stroke,
      strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 6, color: "#000", blur: 18, fill: true }
    }).setOrigin(0.5);
    banner.setAlpha(0);
    this.tweens.add({ targets: banner, alpha: 1, y: 200, duration: 700, ease: "Sine.easeOut" });

    // Battle subtitle
    if (node) {
      this.add.text(GAME_WIDTH / 2, 280, `${node.title} — ${node.subtitle}`, {
        fontFamily: FAMILY_BODY,
        fontSize: "20px",
        color: "#c9b07a"
      }).setOrigin(0.5);
    }

    // Outro panel.
    //
    // panelH was 200 originally, but the longest outros (B9 post-ravine
    // at 631 chars) wrap to ~8 lines and were overflowing into the
    // spoils row pinned to the bottom. Bumped to 280 so even worst-case
    // outros have headroom, with a gold divider separating the prose
    // from the spoils line so the eye doesn't read them as one block.
    // panelY moved up 20 to keep the buttons + stats line where they
    // already had room below.
    const panelW = 880;
    const panelH = 280;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = 310;
    const pg = this.add.graphics();
    drawPanel(pg, panelX, panelY, panelW, panelH);

    const outroText = isVictory
      ? (node?.outro ?? "The field is yours.")
      : "The line broke. You wake to the smell of damp stone and someone else's bandages. Try again — the harvest will not wait.";

    // Reserve the bottom strip for the spoils row + divider so the outro
    // text wraps above it instead of running underneath it. Strip height
    // (50px) covers a 14px line of spoils text + padding above and below
    // the divider.
    const SPOILS_STRIP_H = 50;
    const outroAreaH = panelH - 22 - SPOILS_STRIP_H;
    const outroBody = this.add.text(panelX + 28, panelY + 22, outroText, {
      fontFamily: FAMILY_BODY,
      fontSize: "18px",
      color: "#e6e0d0",
      wordWrap: { width: panelW - 56 },
      lineSpacing: 6
    });
    // Measured safety: the longest outros (8 wrapped lines) sit within a
    // few px of the spoils divider under real font metrics. If the prose
    // doesn't fit its area, step the font down until it does — same
    // philosophy as the dialogue paginator: never let text cross into the
    // furniture below it.
    for (const size of [17, 16, 15]) {
      if (outroBody.height <= outroAreaH) break;
      outroBody.setFontSize(size);
      outroBody.setLineSpacing(5);
    }

    // Spoils — only on victory and only if the BattleNode authored a
    // rewards array. Tally by kind (so "potion ×3" reads more cleanly
    // than three identical lines), build a single comma-separated
    // line, anchor it to the bottom of the outro panel below a faint
    // gold divider so it reads as a separate block from the prose.
    if (isVictory && node?.rewards && node.rewards.length > 0) {
      const dividerY = panelY + panelH - SPOILS_STRIP_H + 4;
      const dg = this.add.graphics();
      dg.lineStyle(1, 0xc9b07a, 0.45);
      dg.lineBetween(panelX + 28, dividerY, panelX + panelW - 28, dividerY);

      const counts: Partial<Record<ItemKind, number>> = {};
      for (const k of node.rewards) counts[k] = (counts[k] ?? 0) + 1;
      const parts: string[] = [];
      for (const k of Object.keys(counts) as ItemKind[]) {
        const n = counts[k]!;
        const meta = ITEM_CATALOG[k];
        parts.push(`${meta.glyph} ${meta.name}${n > 1 ? ` ×${n}` : ""}`);
      }
      this.add.text(panelX + 28, panelY + panelH - 28, `Spoils: ${parts.join("  ")}`, {
        fontFamily: FAMILY_HEADING,
        fontSize: "14px",
        color: "#f4d999",
        stroke: "#1a0e04",
        strokeThickness: 2,
        wordWrap: { width: panelW - 56 }
      }).setOrigin(0, 0.5);
    }

    // Stats line — battle progress + remaining campaign-wide death budget.
    // The lives line dims its colour when the budget hasn't been touched
    // and brightens to the warning yellow once any deaths have landed,
    // so a no-loss player isn't visually nagged about a number that
    // reads 0/3.
    const save = loadSave();
    const completedCount = save.completedBattles.length;
    const totalPlayable = BATTLES.filter(b => b.playable).length;
    const deaths = save.squadDeaths ?? 0;
    const livesLeft = Math.max(0, MAX_PERMITTED_DEATHS - deaths);
    const livesColor = deaths === 0 ? "#5a5448" : deaths >= MAX_PERMITTED_DEATHS ? "#a83c3c" : "#c9b07a";
    this.add.text(GAME_WIDTH / 2, panelY + panelH + 14, `Battles completed: ${completedCount} / ${totalPlayable} playable`, {
      fontFamily: FAMILY_BODY,
      fontSize: "14px",
      color: "#7a7165"
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, panelY + panelH + 32, `Squad losses: ${deaths} / ${MAX_PERMITTED_DEATHS}  (lives remaining: ${livesLeft})`, {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: livesColor
    }).setOrigin(0.5);

    // Buttons row — nudged down 10px to keep clearance from the taller panel.
    const btnY = GAME_HEIGHT - 80;
    const btnH = 48;
    const btnW = 220;
    const gap = 24;

    if (isVictory) {
      const isFinalPlayable = FINAL_PLAYABLE.has(this.battleId); // last in the slice (any path opener)
      const continueLabel = isFinalPlayable ? "Continue ▸" : "Continue ▸";
      const onContinue = () => {
        sfxConfirm();
        this.cameras.main.fadeOut(450, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
          const arc = this.resolvePostArc();
          if (arc) {
            this.scene.start("StoryScene", { arcId: arc });
          } else {
            // No post arc — return to camp (the new home), not the
            // world map directly. Player can re-open the map from the
            // camp's signpost. Camp Hub commit 1.
            this.scene.start("CampScene");
          }
        });
      };

      const continueBtn = new Button(this, {
        x: GAME_WIDTH / 2 - btnW - gap / 2,
        y: btnY,
        w: btnW,
        h: btnH,
        label: continueLabel,
        primary: true,
        fontSize: 18,
        onClick: onContinue
      });

      const mapBtn = new Button(this, {
        x: GAME_WIDTH / 2 + gap / 2,
        y: btnY,
        w: btnW,
        h: btnH,
        label: "World Map",
        primary: false,
        fontSize: 16,
        onClick: () => {
          sfxConfirm();
          this.cameras.main.fadeOut(450, 0, 0, 0);
          this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("OverworldScene"));
        }
      });

      void continueBtn; void mapBtn;
    } else {
      const retryBtn = new Button(this, {
        x: GAME_WIDTH / 2 - btnW - gap / 2,
        y: btnY,
        w: btnW,
        h: btnH,
        label: "Try Again",
        primary: true,
        fontSize: 18,
        onClick: () => {
          sfxConfirm();
          this.cameras.main.fadeOut(450, 0, 0, 0);
          this.cameras.main.once("camerafadeoutcomplete", () =>
            this.scene.start("BattlePrepScene", { battleId: this.battleId })
          );
        }
      });

      const mapBtn = new Button(this, {
        x: GAME_WIDTH / 2 + gap / 2,
        y: btnY,
        w: btnW,
        h: btnH,
        label: "World Map",
        primary: false,
        fontSize: 16,
        onClick: () => {
          sfxConfirm();
          this.cameras.main.fadeOut(450, 0, 0, 0);
          this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("OverworldScene"));
        }
      });

      void retryBtn; void mapBtn;
    }

    // Music + sfx sting
    if (isVictory) {
      sfxVictory();
      getMusic(this).play(MUSIC.adventureAnthros, { fadeMs: 1000 });
    } else {
      sfxDefeat();
      getMusic(this).play(MUSIC.danger, { fadeMs: 1000 });
    }

    this.cameras.main.fadeIn(500, 0, 0, 0);

    // Keyboard shortcut: Enter to advance.
    this.input.keyboard?.on("keydown-ENTER", () => {
      // Trigger the primary button by simulating its click target.
      // Simpler: re-route directly.
      if (isVictory) {
        const arc = this.resolvePostArc();
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () =>
          arc ? this.scene.start("StoryScene", { arcId: arc }) : this.scene.start("OverworldScene")
        );
      } else {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () =>
          this.scene.start("BattlePrepScene", { battleId: this.battleId })
        );
      }
    });

    new SettingsButton(this, GAME_WIDTH - 32, 32);
  }
}
