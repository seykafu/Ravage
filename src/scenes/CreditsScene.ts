import Phaser from "phaser";
import { FAMILY_BODY, FAMILY_DISPLAY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { Button } from "../ui/Button";
import { getMusic, MUSIC } from "../audio/Music";
import { sfxConfirm } from "../audio/Sfx";
import { ensureBackdropTexture, BACKDROPS } from "../art/BackdropArt";
import { defaultSave, loadSave, writeSave } from "../util/save";
import { BATTLES } from "../data/battles";

interface CreditLine {
  kind: "title" | "header" | "name" | "spacer" | "quote";
  text: string;
}

const CREDITS: CreditLine[] = [
  { kind: "title", text: "RAVAGE" },
  { kind: "spacer", text: "" },
  { kind: "quote", text: "A tactical story of Anthros" },
  { kind: "spacer", text: "" },

  { kind: "header", text: "Published by" },
  { kind: "name", text: "Pencat Games · pencatgames.com" },
  { kind: "spacer", text: "" },
  { kind: "spacer", text: "" },

  { kind: "header", text: "Story" },
  { kind: "name", text: "Amar · the man who tried to take a country" },
  { kind: "name", text: "Selene · vanguard of the night that almost was" },
  { kind: "name", text: "Lucian · foreman, soldier, the friend who knew" },
  { kind: "name", text: "Ning · bowyer's apprentice" },
  { kind: "name", text: "Maya · of Revat" },
  { kind: "name", text: "Leo · Dactyl Rider, Ash his mount" },
  { kind: "name", text: "Ranatoli · exile, scholar, blade" },
  { kind: "name", text: "Veya · the Prismarch, who aimed the other way" },
  { kind: "name", text: "Corin · the last of the Eseldras" },
  { kind: "name", text: "Rose · who took all four" },
  { kind: "name", text: "Kian · the Counsellor who watches" },
  { kind: "name", text: "Ndara · first to ask the question that mattered" },
  { kind: "name", text: "Ndari · her brother, who held the gate" },
  { kind: "name", text: "Khione · captain of the one ship that mattered" },
  { kind: "name", text: "King Nebu · the harvest he could not see" },
  { kind: "name", text: "King Archbold · the word he never got to say" },
  { kind: "name", text: "Madame Dawn · Seren Vashti, by an older name" },
  { kind: "spacer", text: "" },

  { kind: "header", text: "Design & Programming" },
  { kind: "name", text: "Kasey · director, writer, engineer" },
  { kind: "name", text: "Claude · co-engineer, scribe, second pair of hands" },
  { kind: "spacer", text: "" },

  { kind: "header", text: "Music" },
  { kind: "name", text: "Spine of the World suite · the leitmotif, in six movements" },
  { kind: "name", text: "Entering the Stronghold · the palace, both times" },
  { kind: "name", text: "Stronghold of Memories · the first boss" },
  { kind: "name", text: "Grude Battle · the empire's capital" },
  { kind: "name", text: "Intense Battle V2 & V3 · the semi-boss run" },
  { kind: "name", text: "Final Battle, Sad & Attack · the last duel, by path" },
  { kind: "name", text: "Final Boss · the Kian battles" },
  { kind: "name", text: "Sadness · Death · Emotional Life · the costs" },
  { kind: "name", text: "Danger · Battle Preparation · Ravage Daredevil · Life in Grude" },
  { kind: "spacer", text: "" },

  { kind: "header", text: "Engine & Tools" },
  { kind: "name", text: "Phaser 3 · TypeScript · Vite · WebAudio" },
  { kind: "spacer", text: "" },
  { kind: "spacer", text: "" },

  { kind: "header", text: "The Battles" },
  ...BATTLES.filter(b => b.playable).map((b): CreditLine => ({
    kind: "name",
    // Subtitles may carry their own em dashes (B5's boss pairing) — the
    // credits render everything with the page's middot separator.
    text: `Battle ${b.index} · ${b.subtitle.replace(/\s*—\s*/g, " · ")}`
  })),
  { kind: "spacer", text: "" },
  { kind: "spacer", text: "" },

  { kind: "quote", text: "Seven answers. One name. Every road walked to its end." },
  { kind: "spacer", text: "" },
  { kind: "quote", text: "Thank you for playing." },
  { kind: "spacer", text: "" },
  { kind: "spacer", text: "" },
  { kind: "title", text: "FIN" }
];

export class CreditsScene extends Phaser.Scene {
  private scroll!: Phaser.GameObjects.Container;
  private finished = false;
  private speed = 28; // px/sec
  private endY = 0;

  constructor() { super("CreditsScene"); }

  create(): void {
    // Backdrop — final-boss style if available, otherwise grude.
    const bdKey = "bg_credits";
    const bdSpec = BACKDROPS.grude;
    const bgKey = ensureBackdropTexture(this, bdKey, bdSpec);
    const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    bg.setAlpha(0.55);

    // Heavy vignette
    const v = this.add.graphics();
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.7, 0.7, 0.95, 0.95);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Build the scrolling content as a container starting just below the screen.
    this.scroll = this.add.container(GAME_WIDTH / 2, GAME_HEIGHT + 40);

    let y = 0;
    for (const line of CREDITS) {
      let style: Phaser.Types.GameObjects.Text.TextStyle;
      let lineHeight: number;
      switch (line.kind) {
        case "title":
          style = {
            fontFamily: FAMILY_DISPLAY,
            fontSize: "78px",
            color: "#f4d999",
            stroke: "#1a0e04",
            strokeThickness: 7,
            shadow: { offsetX: 0, offsetY: 4, color: "#000", blur: 16, fill: true, stroke: true }
          };
          lineHeight = 102;
          break;
        case "header":
          style = {
            fontFamily: FAMILY_HEADING,
            fontSize: "28px",
            color: "#e8c97c",
            stroke: "#1a0e04",
            strokeThickness: 3,
            shadow: { offsetX: 0, offsetY: 2, color: "#000", blur: 8, fill: true }
          };
          lineHeight = 50;
          break;
        case "name":
          style = {
            fontFamily: FAMILY_BODY,
            fontSize: "20px",
            color: "#f3ecd9",
            stroke: "#000",
            strokeThickness: 2,
            shadow: { offsetX: 0, offsetY: 1, color: "#000", blur: 4, fill: true }
          };
          lineHeight = 32;
          break;
        case "quote":
          style = {
            fontFamily: FAMILY_BODY,
            fontSize: "17px",
            color: "#c0b290",
            fontStyle: "italic",
            stroke: "#000",
            strokeThickness: 1,
            shadow: { offsetX: 0, offsetY: 1, color: "#000", blur: 4, fill: true }
          };
          lineHeight = 30;
          break;
        case "spacer":
        default:
          style = { fontSize: "10px" };
          lineHeight = 18;
          break;
      }

      if (line.kind === "spacer") {
        y += lineHeight;
        continue;
      }

      const t = this.add.text(0, y, line.text, style).setOrigin(0.5, 0);
      this.scroll.add(t);
      y += lineHeight;
    }

    this.endY = y;

    // Skip / Return-to-title button — always visible in lower-right.
    const titleBtn = new Button(this, {
      x: GAME_WIDTH - 200,
      y: GAME_HEIGHT - 56,
      w: 180,
      h: 40,
      label: "Return to Title",
      primary: false,
      fontSize: 14,
      onClick: () => this.exit()
    });
    void titleBtn;

    // Speed-up by holding Space or clicking anywhere on the scroll area.
    this.input.keyboard?.on("keydown-SPACE", () => { this.speed = 120; });
    this.input.keyboard?.on("keyup-SPACE", () => { this.speed = 28; });
    this.input.keyboard?.on("keydown-ENTER", () => this.exit());
    this.input.keyboard?.on("keydown-ESC", () => this.exit());

    getMusic(this).play(MUSIC.trailer, { fadeMs: 1400 });
    this.cameras.main.fadeIn(800, 0, 0, 0);

    // Mark the final-boss music as "credits sting" — quick fade-in near the end.
    // We'll handle that in update().
  }

  update(_time: number, deltaMs: number): void {
    if (this.finished) return;
    const dt = deltaMs / 1000;
    this.scroll.y -= this.speed * dt;

    // Once the entire credits have scrolled off the top, auto-return to title.
    // The container origin is at (GAME_WIDTH/2, GAME_HEIGHT+40 - traveled).
    // Content runs from y=0 to y=this.endY. So content fully off-screen when
    // container.y + this.endY < 0.
    if (this.scroll.y + this.endY < -40) {
      this.exit();
    }
  }

  private exit(): void {
    if (this.finished) return;
    this.finished = true;
    sfxConfirm();
    // Fresh save: completing the slice is its own reward; allow replay from title.
    // (We don't wipe progress automatically — leave it alone.)
    void loadSave; void writeSave; void defaultSave;
    this.cameras.main.fadeOut(700, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("TitleScene"));
  }
}
