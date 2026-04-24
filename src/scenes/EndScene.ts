import Phaser from "phaser";
import { FAMILY_BODY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { Button } from "../ui/Button";
import { drawPanel } from "../ui/Panel";
import { battleById, BATTLES } from "../data/battles";
import { getMusic, MUSIC } from "../audio/Music";
import { sfxConfirm, sfxDefeat, sfxVictory } from "../audio/Sfx";
import { ensureBackdropTexture, BACKDROPS } from "../art/BackdropArt";
import { loadSave } from "../util/save";
import { SettingsButton } from "../ui/SettingsButton";

interface EndArgs {
  battleId: string;
  outcome: "player" | "enemy";
}

// Map a completed battle to the post-battle story arc that follows it.
// If a battle has no scripted post arc, route Continue back to the overworld.
const POST_ARC: Record<string, string> = {
  b01_palace_coup: "post_palace",
  b02_farmland: "post_farmland",
  b05_mountain_ndari: "post_mountain"
};

const BACKDROP_LOOKUP: Record<string, keyof typeof BACKDROPS> = {
  bg_palace_coup: "palaceCoup",
  bg_thuling: "thuling",
  bg_farmland: "farmland",
  bg_mountain: "mountain",
  bg_swamp: "swamp",
  bg_caravan: "caravan",
  bg_monastery: "monastery",
  bg_orinhal: "orinhal",
  bg_cliffs: "cliffs",
  bg_gruge: "gruge",
  bg_finalBoss: "finalBoss"
};

export class EndScene extends Phaser.Scene {
  private battleId!: string;
  private outcome!: "player" | "enemy";

  constructor() { super("EndScene"); }

  init(data: EndArgs): void {
    this.battleId = data.battleId;
    this.outcome = data.outcome;
  }

  create(): void {
    const node = battleById(this.battleId);
    const isVictory = this.outcome === "player";

    const bdKey = node?.backdropKey ?? "bg_thuling";
    const bdSpec = BACKDROPS[BACKDROP_LOOKUP[bdKey] ?? "thuling"];
    const bgKey = ensureBackdropTexture(this, bdKey, bdSpec);
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

    // Outro panel
    const panelW = 880;
    const panelH = 200;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = 330;
    const pg = this.add.graphics();
    drawPanel(pg, panelX, panelY, panelW, panelH);

    const outroText = isVictory
      ? (node?.outro ?? "The field is yours.")
      : "The line broke. You wake to the smell of damp stone and someone else's bandages. Try again — the harvest will not wait.";

    this.add.text(panelX + 28, panelY + 22, outroText, {
      fontFamily: FAMILY_BODY,
      fontSize: "18px",
      color: "#e6e0d0",
      wordWrap: { width: panelW - 56 },
      lineSpacing: 6
    });

    // Stats line
    const save = loadSave();
    const completedCount = save.completedBattles.length;
    const totalPlayable = BATTLES.filter(b => b.playable).length;
    this.add.text(GAME_WIDTH / 2, panelY + panelH + 24, `Battles completed: ${completedCount} / ${totalPlayable} playable`, {
      fontFamily: FAMILY_BODY,
      fontSize: "14px",
      color: "#7a7165"
    }).setOrigin(0.5);

    // Buttons row
    const btnY = GAME_HEIGHT - 90;
    const btnH = 48;
    const btnW = 220;
    const gap = 24;

    if (isVictory) {
      const isFinalPlayable = this.battleId === "b05_mountain_ndari"; // last in the slice
      const continueLabel = isFinalPlayable ? "Continue ▸" : "Continue ▸";
      const onContinue = () => {
        sfxConfirm();
        this.cameras.main.fadeOut(450, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => {
          const arc = POST_ARC[this.battleId];
          if (arc) {
            this.scene.start("StoryScene", { arcId: arc });
          } else {
            this.scene.start("OverworldScene");
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
        const arc = POST_ARC[this.battleId];
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
