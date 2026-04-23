import Phaser from "phaser";
import { COLORS, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { ARCS, type DialogBeat } from "../story/beats";
import { ensureBackdropTexture, BACKDROPS } from "../art/BackdropArt";
import { getMusic, MUSIC, type MusicKey } from "../audio/Music";
import { ensurePortraitTexture, PORTRAIT_W, PORTRAIT_H } from "../art/PortraitArt";
import { drawPanel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { sfxClick, sfxPageTurn } from "../audio/Sfx";
import { ENEMY_PALETTES, PLAYER_PALETTES } from "../art/palettes";
import { battleById } from "../data/battles";

interface PortraitMeta {
  primary: number; secondary: number; accent: number; skin: number; hair: number;
  hairStyle?: "short" | "long" | "tied" | "bald" | "hooded";
  beard?: boolean; scar?: boolean; seed: number;
}

const PORTRAIT_TABLE: Record<string, PortraitMeta> = {
  amar:    { ...PLAYER_PALETTES.amar,    hairStyle: "short", seed: 1 },
  lucian:  { ...PLAYER_PALETTES.lucian,  hairStyle: "short", beard: true, seed: 2 },
  ning:    { ...PLAYER_PALETTES.ning,    hairStyle: "tied",  seed: 3 },
  maya:    { ...PLAYER_PALETTES.maya,    hairStyle: "long",  seed: 4 },
  leo:     { ...PLAYER_PALETTES.leo,     hairStyle: "short", seed: 5 },
  ranatoli:{ ...PLAYER_PALETTES.ranatoli,hairStyle: "short", beard: true, seed: 6 },
  selene:  { ...PLAYER_PALETTES.selene,  hairStyle: "long",  scar: true, seed: 7 },
  kian:    { ...ENEMY_PALETTES.kian,     hairStyle: "short", seed: 11 },
  ndari:   { ...ENEMY_PALETTES.ndari,    hairStyle: "long",  seed: 12 },
  nebu:    { ...ENEMY_PALETTES.archbold, hairStyle: "short", beard: true, seed: 13 }
};

const arcMusic: Record<string, MusicKey> = {
  everydayAnthros: MUSIC.everydayAnthros,
  adventureAnthros: MUSIC.adventureAnthros,
  adventure1: MUSIC.adventure1,
  lifeInGrude: MUSIC.lifeInGrude,
  danger: MUSIC.danger,
  battlePrep: MUSIC.battlePrep
};

interface StoryArgs { arcId: string; }

// Portrait display area — anchored above the dialog panel, sized per image.
const PORTRAIT_AREA_W = 220;
const PORTRAIT_AREA_H = 280;

export class StoryScene extends Phaser.Scene {
  private arcId!: string;
  private idx = 0;
  private bodyText!: Phaser.GameObjects.Text;
  private speakerText!: Phaser.GameObjects.Text;
  private portrait?: Phaser.GameObjects.Image;
  private continueBtn!: Button;
  private skipBtn!: Button;
  private bgImage!: Phaser.GameObjects.Image;
  private revealing = false;
  private fullText = "";

  constructor() { super("StoryScene"); }

  init(data: StoryArgs): void {
    this.arcId = data.arcId;
    this.idx = 0;
  }

  create(): void {
    const arc = ARCS[this.arcId];
    if (!arc) {
      this.scene.start("OverworldScene");
      return;
    }

    // Backdrop chosen from arc's first beat ambient or a default thuling sky.
    // For story arcs we re-use any cached backdrop appropriate to the location.
    const bgKey = ensureBackdropTexture(this, "bg_thuling_story", BACKDROPS.thuling);
    this.bgImage = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    this.bgImage.setAlpha(0.85);
    // Slow Ken-Burns drift
    this.tweens.add({ targets: this.bgImage, x: GAME_WIDTH / 2 + 20, y: GAME_HEIGHT / 2 - 6, duration: 8000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    // Vignette
    const v = this.add.graphics();
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.45, 0.45, 0.85, 0.85);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Title banner
    this.add.text(GAME_WIDTH / 2, 60, arc.title, {
      fontFamily: "Cinzel, Trajan Pro, serif",
      fontSize: "30px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 4
    }).setOrigin(0.5);

    if (arc.subtitle) {
      this.add.text(GAME_WIDTH / 2, 96, arc.subtitle, {
        fontFamily: "Georgia, serif",
        fontSize: "16px",
        color: "#c9b07a"
      }).setOrigin(0.5);
    }

    // Dialog panel
    const panelX = 120;
    const panelY = GAME_HEIGHT - 240;
    const panelW = GAME_WIDTH - 240;
    const panelH = 180;
    const pg = this.add.graphics();
    drawPanel(pg, panelX, panelY, panelW, panelH);

    // Reserve a region to the left of the dialog text for the speaker portrait.
    // Portrait floats above the dialog panel, no frame — sized per image (see showBeat).
    const textLeft = panelX + 24 + PORTRAIT_AREA_W + 16;

    this.speakerText = this.add.text(textLeft, panelY + 20, "", {
      fontFamily: "Cinzel, Trajan Pro, serif",
      fontSize: "20px",
      color: "#f4d999"
    });

    this.bodyText = this.add.text(textLeft, panelY + 52, "", {
      fontFamily: "Georgia, serif",
      fontSize: "18px",
      color: "#e6e0d0",
      wordWrap: { width: panelW - PORTRAIT_AREA_W - 64 },
      lineSpacing: 6
    });

    this.continueBtn = new Button(this, {
      x: GAME_WIDTH - 200,
      y: GAME_HEIGHT - 56,
      w: 160, h: 40,
      label: "Continue ▸",
      primary: true,
      fontSize: 16,
      onClick: () => this.advance()
    });

    this.skipBtn = new Button(this, {
      x: 40,
      y: GAME_HEIGHT - 56,
      w: 120, h: 40,
      label: "Skip ⏭",
      primary: false,
      fontSize: 14,
      onClick: () => {
        sfxClick();
        this.finishArc();
      }
    });

    this.input.keyboard?.on("keydown-SPACE", () => this.advance());
    this.input.keyboard?.on("keydown-ENTER", () => this.advance());
    this.input.on("pointerdown", () => this.advance());

    getMusic(this).play(arcMusic[arc.music], { fadeMs: 800 });
    this.cameras.main.fadeIn(450, 0, 0, 0);
    this.showBeat(arc.beats[0]!);
  }

  private showBeat(beat: DialogBeat): void {
    sfxPageTurn();
    // Portrait
    if (this.portrait) { this.portrait.destroy(); this.portrait = undefined; }
    if (beat.portraitId && beat.portraitId !== "narrator") {
      const meta = PORTRAIT_TABLE[beat.portraitId];
      if (meta) {
        const key = ensurePortraitTexture(this, {
          id: beat.portraitId,
          ...meta,
          artSeed: meta.seed
        });
        const panelX = 120;
        const panelY = GAME_HEIGHT - 240;
        // Bottom-center of the portrait region sits just above the dialog panel.
        const areaCenterX = panelX + 24 + PORTRAIT_AREA_W / 2;
        const areaBottomY = panelY - 8;
        this.portrait = this.add.image(areaCenterX, areaBottomY, key).setOrigin(0.5, 1);
        const tex = this.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
        const srcW = tex.width || PORTRAIT_W;
        const srcH = tex.height || PORTRAIT_H;
        const scale = Math.min(PORTRAIT_AREA_W / srcW, PORTRAIT_AREA_H / srcH);
        this.portrait.setScale(scale);
      }
    }

    this.speakerText.setText(beat.speaker ?? (beat.portraitId === "narrator" ? "" : ""));
    this.fullText = beat.body;
    this.bodyText.setText("");
    this.revealing = true;
    let i = 0;
    const reveal = () => {
      if (!this.revealing) {
        this.bodyText.setText(this.fullText);
        return;
      }
      i++;
      this.bodyText.setText(this.fullText.slice(0, i));
      if (i < this.fullText.length) {
        this.time.delayedCall(14, reveal);
      } else {
        this.revealing = false;
      }
    };
    reveal();
  }

  private advance(): void {
    if (this.revealing) {
      this.revealing = false;
      this.bodyText.setText(this.fullText);
      return;
    }
    const arc = ARCS[this.arcId];
    if (!arc) return;
    this.idx++;
    if (this.idx >= arc.beats.length) {
      this.finishArc();
      return;
    }
    this.showBeat(arc.beats[this.idx]!);
  }

  private finishArc(): void {
    const arc = ARCS[this.arcId];
    if (!arc) { this.scene.start("OverworldScene"); return; }
    this.cameras.main.fadeOut(450, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => this.routeNext(arc.next));
  }

  private routeNext(next: string): void {
    if (next === "credits") {
      this.scene.start("CreditsScene");
      return;
    }
    if (next === "overworld") {
      this.scene.start("OverworldScene");
      return;
    }
    if (next.startsWith("story:")) {
      const id = next.slice("story:".length);
      this.scene.start("StoryScene", { arcId: id });
      return;
    }
    if (next.startsWith("prep:")) {
      const id = next.slice("prep:".length);
      const node = battleById(id);
      if (node) {
        this.scene.start("BattlePrepScene", { battleId: node.id });
        return;
      }
    }
    this.scene.start("OverworldScene");
  }
}

void COLORS;
