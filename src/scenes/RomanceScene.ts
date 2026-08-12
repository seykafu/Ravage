import Phaser from "phaser";
import { FAMILY_BODY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { Button } from "../ui/Button";
import { drawPanel } from "../ui/Panel";
import { ensureBackdropForKey } from "../art/BackdropArt";
import { sfxClick, sfxConfirm } from "../audio/Sfx";
import { loadSave, writeSave, getSevenPath } from "../util/save";
import { PATH_ROMANCES, ROMANCE_FLAG, weddingArcFor, type RomanceOption } from "../data/romance";

// ─────────────────────────────────────────────────────────────────────────
// RomanceScene — the marriage question.
//
// Reached from StoryScene when a war path's ending coda (post_ending_*)
// ends with next: "romance". Each war path offers exactly two partners —
// one woman, one man, chosen for resonance with what the path was about
// (see src/data/romance.ts) — plus walking on alone. Mirrors ChoiceScene's
// two-step select-then-commit flow: a wedding is at least as irreversible
// as a war.
//
// The pick persists to save.flags["romance.partner"] and routes into the
// partner's wed_* coda arc (or end_alone), which rolls credits. The music
// is deliberately untouched here: the ending codas play "emotionalLife"
// and the wed arcs use the same key, so the MusicManager's same-track
// continuity carries one unbroken piece across the whole question.
// ─────────────────────────────────────────────────────────────────────────

type Selection = RomanceOption | "alone";

export class RomanceScene extends Phaser.Scene {
  private selected: Selection | null = null;
  private highlights = new Map<string, Phaser.GameObjects.Graphics>();
  private detailText!: Phaser.GameObjects.Text;
  private commitBtn?: Button;

  constructor() { super("RomanceScene"); }

  create(): void {
    const save = loadSave();
    const path = getSevenPath(save);
    const pair = path ? PATH_ROMANCES[path] : undefined;
    if (!pair) {
      // Exile/forgetting never route here; defensive fall-through.
      this.scene.start("CreditsScene");
      return;
    }

    const bgKey = ensureBackdropForKey(this, "bg_thuling");
    const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    bg.setAlpha(0.30);
    const v = this.add.graphics();
    v.fillStyle(0x05060a, 0.66);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.text(GAME_WIDTH / 2, 64, "One More Question", {
      fontFamily: FAMILY_HEADING,
      fontSize: "34px",
      color: "#f4e4b0",
      stroke: "#1a0e04",
      strokeThickness: 4
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 104, "The war is over. The rest of your life is listening.", {
      fontFamily: FAMILY_BODY,
      fontSize: "16px",
      color: "#c9b07a",
      fontStyle: "italic"
    }).setOrigin(0.5);

    // Two partner cards, side by side.
    const cardW = 320;
    const cardH = 380;
    const cardY = 140;
    const gap = 60;
    const leftX = GAME_WIDTH / 2 - cardW - gap / 2;
    const rightX = GAME_WIDTH / 2 + gap / 2;
    this.buildCard(pair.woman, leftX, cardY, cardW, cardH);
    this.buildCard(pair.man, rightX, cardY, cardW, cardH);

    // The third answer — smaller, beneath, never hidden.
    const aloneY = cardY + cardH + 26;
    const aloneW = 420;
    const aloneG = this.add.graphics();
    drawPanel(aloneG, GAME_WIDTH / 2 - aloneW / 2, aloneY, aloneW, 52);
    this.highlights.set("alone", this.addHighlight(GAME_WIDTH / 2 - aloneW / 2, aloneY, aloneW, 52));
    this.add.text(GAME_WIDTH / 2, aloneY + 26, "Walk on alone — the squad was enough", {
      fontFamily: FAMILY_HEADING,
      fontSize: "15px",
      color: "#c9b07a"
    }).setOrigin(0.5);
    this.add.zone(GAME_WIDTH / 2 - aloneW / 2, aloneY, aloneW, 52)
      .setOrigin(0, 0).setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.select("alone"));

    // Detail line + commit row.
    this.detailText = this.add.text(GAME_WIDTH / 2, aloneY + 78, "", {
      fontFamily: FAMILY_BODY,
      fontSize: "15px",
      color: "#e8eaf2",
      align: "center",
      wordWrap: { width: 720 },
      fontStyle: "italic"
    }).setOrigin(0.5, 0);
  }

  private buildCard(opt: RomanceOption, x: number, y: number, w: number, h: number): void {
    const g = this.add.graphics();
    drawPanel(g, x, y, w, h);

    // Portrait — the real painted art, cover-fit, top-anchored so the
    // face leads. Streamed portraits are loaded long before anyone
    // reaches an ending; if one is somehow absent the card still works
    // as name + blurb.
    const key = `portrait:${opt.portraitId}`;
    if (this.textures.exists(key)) {
      const areaW = w - 24;
      const areaH = h - 118;
      const img = this.add.image(x + w / 2, y + 14, key).setOrigin(0.5, 0);
      const src = this.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const scale = Math.max(areaW / (src.width || 1024), areaH / (src.height || 1536));
      img.setScale(scale);
      // Crop to the card's portrait window (in texture pixels).
      const cropH = Math.min(src.height, areaH / scale);
      img.setCrop(0, 0, src.width, cropH);
    }

    this.add.text(x + w / 2, y + h - 92, opt.name, {
      fontFamily: FAMILY_HEADING,
      fontSize: "22px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 3
    }).setOrigin(0.5, 0);
    this.add.text(x + w / 2, y + h - 60, opt.blurb, {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: "#b6bccd",
      align: "center",
      wordWrap: { width: w - 40 }
    }).setOrigin(0.5, 0);

    this.highlights.set(opt.id, this.addHighlight(x, y, w, h));
    this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true })
      .on("pointerup", () => this.select(opt));
  }

  private addHighlight(x: number, y: number, w: number, h: number): Phaser.GameObjects.Graphics {
    const hl = this.add.graphics();
    hl.lineStyle(2, 0xf2d997, 1);
    hl.strokeRect(x - 3, y - 3, w + 6, h + 6);
    hl.setVisible(false);
    return hl;
  }

  private select(sel: Selection): void {
    sfxClick();
    this.selected = sel;
    for (const [id, hl] of this.highlights) {
      hl.setVisible(id === (sel === "alone" ? "alone" : sel.id));
    }
    this.detailText.setText(
      sel === "alone"
        ? "No ring. A long table, and every chair at it filled. It is not a lesser ending."
        : `Ask ${sel.name}. Some questions end wars twice.`
    );
    if (!this.commitBtn) {
      this.commitBtn = new Button(this, {
        x: GAME_WIDTH / 2 - 110,
        y: GAME_HEIGHT - 56,
        w: 220,
        h: 44,
        label: "This is my answer",
        primary: true,
        fontSize: 15,
        onClick: () => this.commit()
      });
    }
  }

  private commit(): void {
    if (!this.selected) return;
    sfxConfirm();
    const save = loadSave();
    const partner = this.selected === "alone" ? "none" : this.selected.id;
    writeSave({ ...save, flags: { ...save.flags, [ROMANCE_FLAG]: partner } });
    const arcId = this.selected === "alone" ? "end_alone" : weddingArcFor(this.selected.id);
    this.cameras.main.fadeOut(500, 0, 0, 0);
    this.cameras.main.once("camerafadeoutcomplete", () => {
      this.scene.start("StoryScene", { arcId });
    });
  }
}
