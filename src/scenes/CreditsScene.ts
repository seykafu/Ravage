import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
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
  { kind: "quote", text: "A tactical story of Anthros — vertical slice" },
  { kind: "spacer", text: "" },
  { kind: "spacer", text: "" },

  { kind: "header", text: "Story" },
  { kind: "name", text: "Amar — the man who tried to take a country" },
  { kind: "name", text: "Selene — vanguard of the night that almost was" },
  { kind: "name", text: "Lucian — foreman, soldier, the friend who knew" },
  { kind: "name", text: "Ning — bowyer's apprentice" },
  { kind: "name", text: "Maya — of Revat" },
  { kind: "name", text: "Leo — Wyvern Rider, Talon his mount" },
  { kind: "name", text: "Ranatoli — exile, scholar, blade" },
  { kind: "name", text: "Kian — the Counsellor who watches" },
  { kind: "name", text: "Ndari — first to ask the question that mattered" },
  { kind: "name", text: "King Nebu — and the harvest he could not see" },
  { kind: "name", text: "Madame Dawn — Seren Vashti, by an older name" },
  { kind: "spacer", text: "" },

  { kind: "header", text: "Design & Programming" },
  { kind: "name", text: "Kasey — director, writer, engineer" },
  { kind: "name", text: "Claude — co-engineer, scribe, second pair of hands" },
  { kind: "spacer", text: "" },

  { kind: "header", text: "Music" },
  { kind: "name", text: "Entering the Stronghold — Battle 1" },
  { kind: "name", text: "Stronghold of Memories — Battle 5 (Ndari)" },
  { kind: "name", text: "Adventure 1 — Title screen" },
  { kind: "name", text: "Danger — Battles 2 and beyond" },
  { kind: "name", text: "Battle Prep — between battles" },
  { kind: "name", text: "Adventure on Anthros — victories" },
  { kind: "name", text: "Everyday Anthros — interludes" },
  { kind: "name", text: "Life in Gruge — the road ahead" },
  { kind: "name", text: "Final Boss Battle — Battle 21 (yet to come)" },
  { kind: "spacer", text: "" },

  { kind: "header", text: "Engine & Tools" },
  { kind: "name", text: "Phaser 3 · TypeScript · Vite · WebAudio" },
  { kind: "name", text: "All sprites, portraits, and backdrops generated procedurally" },
  { kind: "spacer", text: "" },
  { kind: "spacer", text: "" },

  { kind: "header", text: "Vertical Slice — Three Battles" },
  ...BATTLES.filter(b => b.playable).map((b): CreditLine => ({
    kind: "name",
    text: `Battle ${b.index} — ${b.subtitle}`
  })),
  { kind: "spacer", text: "" },
  { kind: "spacer", text: "" },

  { kind: "quote", text: "Twenty-one battles are planned. You have walked three of them." },
  { kind: "quote", text: "The strategic layer, the bond conversations, the Trust Meter," },
  { kind: "quote", text: "the Dawn route and the non-Dawn route, the Final Battle —" },
  { kind: "quote", text: "all of it is yet to be built." },
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
    // Backdrop — final-boss style if available, otherwise gruge.
    const bdKey = "bg_credits";
    const bdSpec = BACKDROPS.gruge;
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
            fontFamily: "Cinzel, Trajan Pro, serif",
            fontSize: "72px",
            color: "#f4d999",
            stroke: "#1a0e04",
            strokeThickness: 6
          };
          lineHeight = 96;
          break;
        case "header":
          style = {
            fontFamily: "Cinzel, Trajan Pro, serif",
            fontSize: "26px",
            color: "#c9b07a"
          };
          lineHeight = 46;
          break;
        case "name":
          style = {
            fontFamily: "Georgia, serif",
            fontSize: "18px",
            color: "#e6e0d0"
          };
          lineHeight = 30;
          break;
        case "quote":
          style = {
            fontFamily: "Georgia, serif",
            fontSize: "16px",
            color: "#a89a78",
            fontStyle: "italic"
          };
          lineHeight = 28;
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
