import Phaser from "phaser";
import { COLORS, FAMILY_BODY, FAMILY_DISPLAY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { ARCS, type DialogBeat, type StoryArc } from "../story/beats";
import { ensureBackdropTexture, BACKDROPS } from "../art/BackdropArt";
import { getMusic, MUSIC, type MusicKey } from "../audio/Music";
import { ensurePortraitTexture, PORTRAIT_W, PORTRAIT_H } from "../art/PortraitArt";
import { drawPanel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { sfxClick, sfxPageTurn } from "../audio/Sfx";
import { ENEMY_PALETTES, PLAYER_PALETTES } from "../art/palettes";
import { battleById } from "../data/battles";
import type { ArcId, RouteRef } from "../data/contentIds";

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

// Typed against StoryArc["music"] so adding a new music slug to the union in
// beats.ts without adding a row here is a compile error — was Record<string,
// MusicKey>, which silently returned undefined and crashed at runtime.
const arcMusic: Record<StoryArc["music"], MusicKey> = {
  everydayAnthros: MUSIC.everydayAnthros,
  adventureAnthros: MUSIC.adventureAnthros,
  adventure1: MUSIC.adventure1,
  lifeInGrude: MUSIC.lifeInGrude,
  danger: MUSIC.danger,
  battlePrep: MUSIC.battlePrep,
  mainTheme: MUSIC.mainTheme,
  emotional: MUSIC.emotional,
  everydayLife: MUSIC.everydayLife,
  trailer: MUSIC.trailer,
  ravageDaredevil: MUSIC.ravageDaredevil
};

interface StoryArgs { arcId: ArcId; }

// Portrait display area — anchored above the dialog panel.
// Uses cover-fit (Math.max) + top-anchor so faces stay legible regardless of
// source aspect (square / 2:3 portrait / 3:2 landscape). A bottom gradient
// fade hides the crop seam where the portrait meets the dialog panel.
const PORTRAIT_AREA_W = 300;
const PORTRAIT_AREA_H = 360;
const PORTRAIT_MASK_KEY = "story_portrait_fade_mask";

// Dialog panel layout. Hoisted to module scope so create() and showBeat()
// don't drift apart when one is tweaked. Values were tightened in the
// pagination pass: the panel now sits 20px higher and is 20px taller than
// before (same bottom edge), and the body text top padding dropped from 56
// to 44 so 4–5 wrapped lines fit comfortably instead of clipping the
// border.
const PANEL_X = 120;
const PANEL_Y = GAME_HEIGHT - 260;
const PANEL_W = GAME_WIDTH - 240;
const PANEL_H = 200;
const SPEAKER_Y_OFFSET = 14;
const BODY_Y_OFFSET = 44;
// fontSize 21 + lineSpacing 10 = effective line height per Phaser's text
// wrapping. Used to compute LINES_PER_PAGE for auto-pagination.
const BODY_LINE_HEIGHT = 31;
const BODY_BOTTOM_PADDING = 16;
const LINES_PER_PAGE = Math.max(
  1,
  Math.floor((PANEL_H - BODY_Y_OFFSET - BODY_BOTTOM_PADDING) / BODY_LINE_HEIGHT)
);

export class StoryScene extends Phaser.Scene {
  private arcId!: ArcId;
  private idx = 0;
  private bodyText!: Phaser.GameObjects.Text;
  private speakerText!: Phaser.GameObjects.Text;
  private portrait?: Phaser.GameObjects.Image;
  private continueBtn!: Button;
  private skipBtn!: Button;
  private bgImage!: Phaser.GameObjects.Image;
  private revealing = false;
  private fullText = "";
  // Pagination state. A "beat" can span multiple "pages" if its body wraps to
  // more lines than fit in the panel. The portrait + speaker name stay fixed
  // across pages of the same beat; only the body text steps.
  private currentBeatPages: string[] = [];
  private currentPageIdx = 0;

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

    // Backdrop honors arc.backdrop when set; falls back to thuling. Real PNG
    // (loaded as `backdrop:<id>`) is preferred over the procedural fallback.
    const bdName = arc.backdrop ?? "thuling";
    const bdSpec = BACKDROPS[bdName];
    const bgKey = ensureBackdropTexture(this, `bg_${bdName}_story`, bdSpec, `backdrop:${bdName}`);
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
      fontFamily: FAMILY_DISPLAY,
      fontSize: "34px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 3, color: "#000", blur: 12, fill: true, stroke: true }
    }).setOrigin(0.5).setLetterSpacing(2);

    if (arc.subtitle) {
      this.add.text(GAME_WIDTH / 2, 100, arc.subtitle, {
        fontFamily: FAMILY_BODY,
        fontSize: "17px",
        color: "#c9b07a",
        fontStyle: "italic",
        shadow: { offsetX: 0, offsetY: 2, color: "#000", blur: 6, fill: true }
      }).setOrigin(0.5).setLetterSpacing(1);
    }

    // Dialog panel
    const pg = this.add.graphics();
    drawPanel(pg, PANEL_X, PANEL_Y, PANEL_W, PANEL_H);

    // Text is left-aligned inside the panel; the speaker portrait floats above
    // the panel on the RIGHT side. (Earlier layout reserved the LEFT for the
    // portrait, which pushed the dialogue ~340px in and made the text feel
    // shoved against the right edge.)
    const textLeft = PANEL_X + 24;

    this.speakerText = this.add.text(textLeft, PANEL_Y + SPEAKER_Y_OFFSET, "", {
      fontFamily: FAMILY_HEADING,
      fontSize: "22px",
      color: "#f4d999",
      stroke: "#000",
      strokeThickness: 3,
      shadow: { offsetX: 0, offsetY: 2, color: "#000", blur: 6, fill: true }
    }).setLetterSpacing(1);

    this.bodyText = this.add.text(textLeft, PANEL_Y + BODY_Y_OFFSET, "", {
      fontFamily: FAMILY_BODY,
      fontSize: "21px",
      color: "#f3ecd9",
      stroke: "#000",
      strokeThickness: 2,
      shadow: { offsetX: 0, offsetY: 2, color: "#000", blur: 6, fill: true },
      wordWrap: { width: PANEL_W - PORTRAIT_AREA_W - 80 },
      lineSpacing: 10
    }).setLetterSpacing(0.3);

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
    // Portrait + speaker change only between beats, not between pages of the
    // same beat. Keep this work outside showCurrentPage().
    if (this.portrait) { this.portrait.destroy(); this.portrait = undefined; }
    if (beat.portraitId && beat.portraitId !== "narrator") {
      const key = this.resolvePortraitKey(beat.portraitId, beat.expression);
      if (key) {
        // Portrait sits on the RIGHT side of the panel now (text on the left).
        // Top-center of the portrait region; the image extends downward and
        // overlaps the dialog panel by ~24px, hidden by the gradient mask.
        const areaCenterX = PANEL_X + PANEL_W - 24 - PORTRAIT_AREA_W / 2;
        const areaTopY = PANEL_Y - PORTRAIT_AREA_H + 24;
        this.portrait = this.add.image(areaCenterX, areaTopY, key).setOrigin(0.5, 0);
        const tex = this.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
        const srcW = tex.width || PORTRAIT_W;
        const srcH = tex.height || PORTRAIT_H;
        // Cover fit: fill the entire area, cropping overflow. Faces stay
        // large and consistent across square / portrait / landscape sources.
        const scale = Math.max(PORTRAIT_AREA_W / srcW, PORTRAIT_AREA_H / srcH);
        this.portrait.setScale(scale);
        // Mask the bottom edge with a vertical gradient so the cropped
        // boundary feathers into the dialog panel instead of cutting hard.
        this.portrait.setMask(this.ensurePortraitMask(areaCenterX, areaTopY).createBitmapMask());
      }
    }

    this.speakerText.setText(beat.speaker ?? (beat.portraitId === "narrator" ? "" : ""));

    // Compute the wrapped lines for this beat, then chunk into LINES_PER_PAGE.
    // Phaser's getWrappedText respects the wordWrap.width set on bodyText.
    // Empty beats (shouldn't happen) get a single empty page so the page
    // pointer stays valid.
    const wrapped = this.bodyText.getWrappedText(beat.body);
    this.currentBeatPages = [];
    if (wrapped.length === 0) {
      this.currentBeatPages.push(beat.body);
    } else {
      for (let i = 0; i < wrapped.length; i += LINES_PER_PAGE) {
        this.currentBeatPages.push(wrapped.slice(i, i + LINES_PER_PAGE).join("\n"));
      }
    }
    this.currentPageIdx = 0;
    this.showCurrentPage();
  }

  // Renders the current page's text with the typewriter reveal. Called by
  // showBeat (first page of a new beat) and by advance() (next page of the
  // same beat). Updates the Continue button's label so the player can tell
  // mid-beat pagination apart from beat-to-beat advance.
  private showCurrentPage(): void {
    sfxPageTurn();
    const page = this.currentBeatPages[this.currentPageIdx] ?? "";
    this.fullText = page;
    this.bodyText.setText("");
    this.revealing = true;
    const hasMore = this.currentPageIdx + 1 < this.currentBeatPages.length;
    this.continueBtn.setLabel(hasMore ? "More ▾" : "Continue ▸");
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

  // Returns a positioned Image whose alpha runs from 1.0 at the top to 0 at
  // the bottom 30% — used as a BitmapMask for the portrait so its bottom
  // crop fades into the dialog panel.
  private ensurePortraitMask(centerX: number, topY: number): Phaser.GameObjects.Image {
    if (!this.textures.exists(PORTRAIT_MASK_KEY)) {
      const tex = this.textures.createCanvas(PORTRAIT_MASK_KEY, PORTRAIT_AREA_W, PORTRAIT_AREA_H);
      if (tex) {
        const ctx = tex.getContext();
        const grad = ctx.createLinearGradient(0, 0, 0, PORTRAIT_AREA_H);
        grad.addColorStop(0, "rgba(255,255,255,1)");
        grad.addColorStop(0.70, "rgba(255,255,255,1)");
        grad.addColorStop(0.92, "rgba(255,255,255,0.35)");
        grad.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, PORTRAIT_AREA_W, PORTRAIT_AREA_H);
        tex.refresh();
      }
    }
    const mask = this.add.image(centerX, topY, PORTRAIT_MASK_KEY).setOrigin(0.5, 0);
    mask.setVisible(false);
    return mask;
  }

  private resolvePortraitKey(id: string, expression?: string): string | null {
    // 1) Expression variant from disk (e.g., portrait:amar:resolute).
    if (expression) {
      const exprKey = `portrait:${id}:${expression}`;
      if (this.textures.exists(exprKey)) return exprKey;
    }
    // 2) Default real portrait from disk (e.g., portrait:amar).
    const realKey = `portrait:${id}`;
    if (this.textures.exists(realKey)) return realKey;
    // 3) Procedural fallback for characters with palette metadata.
    const meta = PORTRAIT_TABLE[id];
    if (meta) {
      return ensurePortraitTexture(this, { id, ...meta, artSeed: meta.seed }, expression);
    }
    return null;
  }

  private advance(): void {
    // Mid-typewriter: complete the current page instantly instead of
    // advancing. Prevents accidentally skipping a page if the player clicks
    // before the reveal finishes.
    if (this.revealing) {
      this.revealing = false;
      this.bodyText.setText(this.fullText);
      // Re-evaluate the button label now that the page is fully shown.
      const hasMore = this.currentPageIdx + 1 < this.currentBeatPages.length;
      this.continueBtn.setLabel(hasMore ? "More ▾" : "Continue ▸");
      return;
    }
    // More pages of the current beat? Step within the beat instead of moving
    // to the next one. Portrait + speaker stay; only the body text changes.
    if (this.currentPageIdx + 1 < this.currentBeatPages.length) {
      this.currentPageIdx++;
      this.showCurrentPage();
      return;
    }
    // Otherwise advance to the next beat (or end the arc).
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

  // `next` is a discriminated union of "credits" | "overworld" |
  // `story:${ArcId}` | `prep:${BattleId}`. Because the prefixed variants are
  // template literal types, the slice'd suffix is provably an ArcId / BattleId
  // — no runtime check needed once the prefix matches. Anything outside the
  // union fails to type-check upstream in beats.ts.
  private routeNext(next: RouteRef): void {
    if (next === "credits") {
      this.scene.start("CreditsScene");
      return;
    }
    if (next === "overworld") {
      this.scene.start("OverworldScene");
      return;
    }
    if (next.startsWith("story:")) {
      const id = next.slice("story:".length) as ArcId;
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
