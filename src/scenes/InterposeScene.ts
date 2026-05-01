import Phaser from "phaser";
import { COLORS, FAMILY_BODY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { drawPanel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { sfxClick, sfxConfirm, sfxCancel } from "../audio/Sfx";
import { ensurePortraitTexture } from "../art/PortraitArt";
import { ENEMY_PALETTES, PLAYER_PALETTES } from "../art/palettes";

// InterposeScene — modal overlay launched from BattleScene when an enemy
// attack would deal lethal damage to a player unit AND at least one other
// player unit is adjacent to the defender. The player picks an
// interposer to take the killing blow, or declines to let the original
// hit land.
//
// Pause/resume contract mirrors BattleDialogueScene + SettingsScene: the
// launcher calls `this.scene.pause()` then `this.scene.run("InterposeScene", ...)`
// with a callback. This scene calls `this.scene.resume(resumeKey)` and
// `this.scene.stop()` on close, AFTER firing the callback so the
// resumed BattleScene immediately sees the chosen interposer (or null).
//
// The panel intentionally does NOT show damage previews against the
// interposer — narratively the killing blow lands at full force, the
// interposer absorbed the literal swing. Mechanically the same damage
// number that would have killed the defender is applied to the
// interposer; their armor doesn't reduce it. See docs/RAVAGE_DESIGN.md
// §3.11 for the rationale.

export interface InterposeCandidate {
  // Unit id; passed back to the callback so BattleScene can resolve.
  id: string;
  // Display name for the button label.
  name: string;
  // Portrait id used to look up the asset / fall back to procedural.
  portraitId: string;
  // Current HP / max HP shown next to the name so the player understands
  // the cost of asking this character to interpose ("this is at 4/22 HP,
  // they will fall.").
  hp: number;
  maxHp: number;
}

interface InterposeArgs {
  // Damage amount the original target would have taken (the killing blow).
  // Shown to the player in the panel headline.
  incomingDamage: number;
  // Display name + portrait of the original target — the unit that's
  // about to die without an intervention.
  defenderName: string;
  defenderPortraitId: string;
  // Display name of the attacker, for context.
  attackerName: string;
  // The candidates the player can pick from. Always >= 1 (BattleScene
  // doesn't fire the modal if the list is empty).
  candidates: InterposeCandidate[];
  // Callback fired with the chosen candidate id, or null if the player
  // declined. Called BEFORE scene.resume + scene.stop so the resumed
  // BattleScene reads the decision synchronously on next tick.
  onResolve: (interposerId: string | null) => void;
  // Scene to resume on close.
  resumeKey: string;
}

const PANEL_W = 720;
const PANEL_H = 360;
const PANEL_X = (GAME_WIDTH - PANEL_W) / 2;
const PANEL_Y = (GAME_HEIGHT - PANEL_H) / 2;

const PORTRAIT_TABLE: Record<string, { primary: number; secondary: number; accent: number; skin: number; hair: number; seed: number }> = {
  amar:    { ...PLAYER_PALETTES.amar,    seed: 1 },
  lucian:  { ...PLAYER_PALETTES.lucian,  seed: 2 },
  ning:    { ...PLAYER_PALETTES.ning,    seed: 3 },
  maya:    { ...PLAYER_PALETTES.maya,    seed: 4 },
  leo:     { ...PLAYER_PALETTES.leo,     seed: 5 },
  ranatoli:{ ...PLAYER_PALETTES.ranatoli,seed: 6 },
  selene:  { ...PLAYER_PALETTES.selene,  seed: 7 },
  kian:    { ...ENEMY_PALETTES.kian,     seed: 11 }
};

export class InterposeScene extends Phaser.Scene {
  private args!: InterposeArgs;
  private resolved = false;

  constructor() { super("InterposeScene"); }

  init(data: InterposeArgs): void {
    this.args = data;
    this.resolved = false;
  }

  create(): void {
    // Heavier dim than the dialogue scene — this is a decision point and
    // we want the field to recede so the player focuses on the modal.
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.72);
    dim.setInteractive();
    void dim;

    const pg = this.add.graphics();
    drawPanel(pg, PANEL_X, PANEL_Y, PANEL_W, PANEL_H);

    // Headline — frames the stakes in one line.
    this.add.text(PANEL_X + PANEL_W / 2, PANEL_Y + 24, "INTERPOSE?", {
      fontFamily: FAMILY_HEADING,
      fontSize: "30px",
      color: "#ff8a8a",
      stroke: "#1a0404",
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 3, color: "#000", blur: 10, fill: true }
    }).setOrigin(0.5, 0).setLetterSpacing(3);

    this.add.text(PANEL_X + PANEL_W / 2, PANEL_Y + 70, `${this.args.attackerName}'s blow will kill ${this.args.defenderName} (${this.args.incomingDamage} dmg).`, {
      fontFamily: FAMILY_BODY,
      fontSize: "16px",
      color: "#e6e0d0",
      stroke: "#000",
      strokeThickness: 2,
      align: "center",
      wordWrap: { width: PANEL_W - 80 }
    }).setOrigin(0.5, 0);

    this.add.text(PANEL_X + PANEL_W / 2, PANEL_Y + 100, "Send another to step in front of the swing?", {
      fontFamily: FAMILY_BODY,
      fontSize: "14px",
      color: "#c9b07a",
      fontStyle: "italic"
    }).setOrigin(0.5, 0);

    // Candidate buttons — one per interposer, laid out horizontally.
    // Up to 4 fit comfortably; in practice rarely more than 2.
    const candidates = this.args.candidates;
    const cardW = 140;
    const cardH = 160;
    const cardGap = 18;
    const totalW = candidates.length * cardW + (candidates.length - 1) * cardGap;
    const startX = PANEL_X + (PANEL_W - totalW) / 2;
    const cardY = PANEL_Y + 140;

    candidates.forEach((c, i) => {
      const x = startX + i * (cardW + cardGap);
      this.renderCandidateCard(c, x, cardY, cardW, cardH);
    });

    // Decline button — explicit "let it happen" rather than just an X. The
    // wording is intentional: this isn't a cancel, it's a choice.
    new Button(this, {
      x: PANEL_X + PANEL_W / 2 - 100,
      y: PANEL_Y + PANEL_H - 50,
      w: 200,
      h: 36,
      label: "Let the blow land",
      primary: false,
      fontSize: 13,
      onClick: () => this.resolve(null)
    });

    // Keyboard escape: ESC declines (treated the same as "Let it happen").
    this.input.keyboard?.on("keydown-ESC", () => this.resolve(null));

    this.cameras.main.fadeIn(180, 0, 0, 0);
  }

  private renderCandidateCard(c: InterposeCandidate, x: number, y: number, w: number, h: number): void {
    const cardG = this.add.graphics();
    drawPanel(cardG, x, y, w, h);

    // Portrait — sits in the top half of the card, masked by Phaser's
    // built-in rectangular clipping (we just place an Image and crop with
    // displaySize). Falls back to procedural via PORTRAIT_TABLE if no PNG.
    const key = this.resolvePortraitKey(c.portraitId);
    if (key) {
      const portrait = this.add.image(x + w / 2, y + 16, key).setOrigin(0.5, 0);
      const tex = this.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const srcW = tex.width || 600;
      const srcH = tex.height || 600;
      const targetW = w - 24;
      const targetH = 80;
      const scale = Math.max(targetW / srcW, targetH / srcH);
      portrait.setScale(scale);
      // Mask to a rectangular crop window — keeps portraits visually
      // contained within the card border.
      const maskGfx = this.add.graphics().setVisible(false);
      maskGfx.fillStyle(0xffffff);
      maskGfx.fillRect(x + 12, y + 16, targetW, targetH);
      portrait.setMask(maskGfx.createGeometryMask());
    }

    // Name
    this.add.text(x + w / 2, y + 104, c.name, {
      fontFamily: FAMILY_HEADING,
      fontSize: "16px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 3
    }).setOrigin(0.5);

    // HP — coloured red when the interposer would die from the blow,
    // amber when they'd survive but be left under 25%, otherwise gold.
    const wouldDie = c.hp <= this.args.incomingDamage;
    const wouldCripple = !wouldDie && (c.hp - this.args.incomingDamage) < c.maxHp * 0.25;
    const hpColor = wouldDie ? "#ff7a7a" : (wouldCripple ? "#f0b85a" : "#c9b07a");
    this.add.text(x + w / 2, y + 122, `HP ${c.hp} / ${c.maxHp}`, {
      fontFamily: FAMILY_BODY,
      fontSize: "12px",
      color: hpColor
    }).setOrigin(0.5);

    // Pick button — primary action of the card.
    new Button(this, {
      x: x + 12,
      y: y + h - 32,
      w: w - 24,
      h: 26,
      label: "Step in",
      primary: true,
      fontSize: 12,
      onClick: () => this.resolve(c.id)
    });
  }

  private resolvePortraitKey(id: string): string | null {
    const realKey = `portrait:${id}`;
    if (this.textures.exists(realKey)) return realKey;
    const meta = PORTRAIT_TABLE[id];
    if (meta) {
      return ensurePortraitTexture(this, { id, ...meta, artSeed: meta.seed });
    }
    return null;
  }

  // Single resolution path — guarded by `resolved` so a fast double-click
  // (e.g., player hits both ESC and a card before the camera fades out)
  // can't fire the callback twice and crash BattleScene's interpose
  // handler.
  private resolve(interposerId: string | null): void {
    if (this.resolved) return;
    this.resolved = true;
    if (interposerId) sfxConfirm();
    else sfxCancel();
    sfxClick();
    this.args.onResolve(interposerId);
    if (this.args.resumeKey) this.scene.resume(this.args.resumeKey);
    this.scene.stop();
  }
}

// Suppress "unused" lint for COLORS — kept on the import for future panel
// styling tweaks alongside the other modal scenes.
void COLORS;
