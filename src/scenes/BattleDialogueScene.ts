import Phaser from "phaser";
import { COLORS, FAMILY_BODY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { drawPanel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { sfxClick, sfxPageTurn } from "../audio/Sfx";
import { getMusic, type MusicKey } from "../audio/Music";
import { ensurePortraitTexture, PORTRAIT_W, PORTRAIT_H } from "../art/PortraitArt";
import { ENEMY_PALETTES, PLAYER_PALETTES } from "../art/palettes";
import type { DialogBeat, PortraitId } from "../story/beats";

// BattleDialogueScene — modal overlay launched mid-battle when a
// BattleDialogue trigger fires. Pauses BattleScene and shows the same
// bottom-anchored dialog panel + portrait + Continue button + pagination
// that StoryScene uses, but without a backdrop or music takeover (the
// battle music keeps playing; the battle is visible through a slight dim
// behind the panel).
//
// Pause/resume flow mirrors SettingsScene + PromotionScene: the launching
// scene calls `this.scene.pause()` and `this.scene.run("BattleDialogueScene", ...)`,
// then this scene calls `this.scene.resume(resumeKey)` + `this.scene.stop()`
// on close.

interface BattleDialogueArgs {
  beats: DialogBeat[];
  resumeKey: string;
  // Optional music override. When set, the dialogue scene fades into
  // this track on open and fades back to the previous (battle) track
  // on close. Used by grief beats that need a different texture from
  // the battle theme — see BattleDialogue.music in src/data/battles.ts.
  music?: MusicKey;
  // The track to restore on close — passed in by BattleScene since
  // the music manager doesn't track a stack. Falls back silently if
  // omitted (some beats may legitimately not want a restore, e.g.
  // before_victory dialogues that hand off to EndScene's own music).
  restoreMusic?: MusicKey;
}

// Dialog panel layout constants — mirror StoryScene's so the visual
// language matches when a dialogue fires mid-battle.
const PANEL_X = 120;
const PANEL_Y = GAME_HEIGHT - 260;
const PANEL_W = GAME_WIDTH - 240;
const PANEL_H = 200;
const SPEAKER_Y_OFFSET = 14;
const BODY_Y_OFFSET = 44;
const BODY_LINE_HEIGHT = 31;
const BODY_BOTTOM_PADDING = 16;
const LINES_PER_PAGE = Math.max(
  1,
  Math.floor((PANEL_H - BODY_Y_OFFSET - BODY_BOTTOM_PADDING) / BODY_LINE_HEIGHT)
);

// Portrait area to the right of the dialog text.
const PORTRAIT_AREA_W = 300;
const PORTRAIT_AREA_H = 360;
const PORTRAIT_MASK_KEY = "battle_dialogue_portrait_fade_mask";

// Procedural-portrait fallback metadata (same shape StoryScene uses).
// Keeps the file-portrait flow primary and the procedural painter as a
// last-resort safety net for any character without a PNG on disk.
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

export class BattleDialogueScene extends Phaser.Scene {
  private resumeKey!: string;
  private beats: DialogBeat[] = [];
  private idx = 0;
  private bodyText!: Phaser.GameObjects.Text;
  private speakerText!: Phaser.GameObjects.Text;
  private portrait?: Phaser.GameObjects.Image;
  private continueBtn!: Button;
  private revealing = false;
  private fullText = "";
  private currentBeatPages: string[] = [];
  private currentPageIdx = 0;
  // Music takeover: when the dialogue specifies a `music` override, we
  // fade into it on open and fade back to `restoreMusic` on close.
  // Tracked across init/close so close() can restore even if create()
  // bailed early on an empty beats array.
  private restoreMusic?: MusicKey;

  constructor() { super("BattleDialogueScene"); }

  init(data: BattleDialogueArgs): void {
    this.resumeKey = data.resumeKey;
    this.beats = data.beats;
    this.idx = 0;
    this.restoreMusic = data.restoreMusic;
    // Apply the music override immediately at init() — earlier than
    // create() so the new track is already fading in by the time the
    // dialogue panel renders. fadeMs slightly longer than the default
    // so the prior battle theme exits gracefully under the dim flash.
    if (data.music) {
      getMusic(this).play(data.music, { fadeMs: 900 });
    }
  }

  create(): void {
    if (this.beats.length === 0) {
      this.close();
      return;
    }

    // Light dim covers the battle so the dialog panel reads as foreground.
    // Lighter than SettingsScene's 0.65 (we want the battle to stay legible
    // behind the conversation) and interactive so stray clicks during the
    // dialogue don't fall through to battle units.
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.40);
    dim.setInteractive();
    void dim;

    // Dialog panel — same dimensions and treatment as StoryScene.
    const pg = this.add.graphics();
    drawPanel(pg, PANEL_X, PANEL_Y, PANEL_W, PANEL_H);

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

    this.input.keyboard?.on("keydown-SPACE", () => this.advance());
    this.input.keyboard?.on("keydown-ENTER", () => this.advance());
    // pointerdown on the dim rectangle also advances — players reach for
    // mouse before keyboard during a fight.
    dim.on("pointerdown", () => this.advance());

    this.cameras.main.fadeIn(220, 0, 0, 0);
    this.showBeat(this.beats[0]!);
  }

  private showBeat(beat: DialogBeat): void {
    // Portrait — render only when the beat names a character (skip
    // narrator and beats with only a speaker label). Silent failure to
    // resolve a portrait is by design: the dialog still shows.
    if (this.portrait) { this.portrait.destroy(); this.portrait = undefined; }
    if (beat.portraitId && beat.portraitId !== "narrator") {
      const key = this.resolvePortraitKey(beat.portraitId, beat.expression);
      if (key) {
        const areaCenterX = PANEL_X + PANEL_W - 24 - PORTRAIT_AREA_W / 2;
        const areaTopY = PANEL_Y - PORTRAIT_AREA_H + 24;
        this.portrait = this.add.image(areaCenterX, areaTopY, key).setOrigin(0.5, 0);
        const tex = this.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
        const srcW = tex.width || PORTRAIT_W;
        const srcH = tex.height || PORTRAIT_H;
        const scale = Math.max(PORTRAIT_AREA_W / srcW, PORTRAIT_AREA_H / srcH);
        this.portrait.setScale(scale);
        this.portrait.setMask(this.ensurePortraitMask(areaCenterX, areaTopY).createBitmapMask());
      }
    }

    this.speakerText.setText(beat.speaker ?? (beat.portraitId === "narrator" ? "" : ""));

    // Pagination — same logic as StoryScene. Long bodies (rare in mid-
    // battle dialogues but possible) get split into pages of LINES_PER_PAGE
    // wrapped lines each.
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

  private showCurrentPage(): void {
    sfxPageTurn();
    const page = this.currentBeatPages[this.currentPageIdx] ?? "";
    this.fullText = page;
    this.bodyText.setText("");
    this.revealing = true;
    const hasMore = this.currentPageIdx + 1 < this.currentBeatPages.length;
    this.continueBtn.setLabel(hasMore ? "More ▾" : "Continue ▸");
    let i = 0;
    const reveal = (): void => {
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
      const hasMore = this.currentPageIdx + 1 < this.currentBeatPages.length;
      this.continueBtn.setLabel(hasMore ? "More ▾" : "Continue ▸");
      return;
    }
    if (this.currentPageIdx + 1 < this.currentBeatPages.length) {
      this.currentPageIdx++;
      this.showCurrentPage();
      return;
    }
    this.idx++;
    if (this.idx >= this.beats.length) {
      sfxClick();
      this.close();
      return;
    }
    this.showBeat(this.beats[this.idx]!);
  }

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

  private resolvePortraitKey(id: PortraitId, expression?: string): string | null {
    if (expression) {
      const exprKey = `portrait:${id}:${expression}`;
      if (this.textures.exists(exprKey)) return exprKey;
    }
    const realKey = `portrait:${id}`;
    if (this.textures.exists(realKey)) return realKey;
    const meta = PORTRAIT_TABLE[id];
    if (meta) {
      return ensurePortraitTexture(this, { id, ...meta, artSeed: meta.seed }, expression);
    }
    return null;
  }

  private close(): void {
    // Restore the prior music if the dialogue took it over. Skipped for
    // before_victory dialogues that hand off to EndScene (which plays
    // its own victory/defeat sting); BattleScene declines to pass
    // `restoreMusic` for those so we silently no-op here.
    if (this.restoreMusic) {
      getMusic(this).play(this.restoreMusic, { fadeMs: 700 });
    }
    if (this.resumeKey) this.scene.resume(this.resumeKey);
    this.scene.stop();
  }
}

// Suppress an "unused" lint without leaving COLORS off the import (kept
// for future panel-styling tweaks).
void COLORS;
