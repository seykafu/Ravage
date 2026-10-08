import Phaser from "phaser";
import { COLORS, FAMILY_BODY, FAMILY_DISPLAY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { Button } from "../ui/Button";
import { sfxCineBell, sfxCineRise, sfxClick, sfxVictory } from "../audio/Sfx";
import { animKey, hasUnitAnimation } from "../assets/animations";
import { ensureDotTexture } from "./battle/Atmosphere";
import { ABILITY_DISPLAY, CLASS_DISPLAY_NAMES, PROMOTIONS } from "../data/promotions";
import { promoteCharacter } from "../combat/Progression";
import { trackCharacterPromoted } from "../util/analytics";
import {
  getCharacterRecord,
  setCharacterRecord,
  loadSave,
  writeSave,
  type CharacterRecord
} from "../util/save";
import type { PortraitId } from "../story/beats";
import type { ClassKind, UnitStats } from "../combat/types";

interface PromotionArgs {
  characterId: PortraitId;
  // Scene to resume on close. The launching scene is paused; closing here
  // unpauses it and stops PromotionScene. Mirrors the SettingsScene
  // overlay flow.
  resumeKey: string;
}

// PromotionScene — modal overlay launched from StoryScene when a beat's
// `promote` field fires. Performs the actual save mutation (idempotent),
// shows the player the upgrade, and routes back to the source scene on
// close. Visually styled like the EndScene victory screen so the
// promotion lands as a moment, not a tooltip.
//
// The mutation is wrapped in a "before snapshot" / "after snapshot" pair
// so the panel can show the actual stat deltas (e.g., "HP 36 → 41 (+5)")
// rather than the abstract "+5 HP" from the promotion definition. If the
// character was already promoted (record.classKind matches), the scene
// still shows the panel (read as "this is what you got at promotion") but
// no save mutation occurs.
export class PromotionScene extends Phaser.Scene {
  private characterId!: PortraitId;
  private resumeKey!: string;

  constructor() { super("PromotionScene"); }

  init(data: PromotionArgs): void {
    this.characterId = data.characterId;
    this.resumeKey = data.resumeKey;
  }

  create(): void {
    const promotion = PROMOTIONS[this.characterId];
    const save = loadSave();
    const before = getCharacterRecord(save, this.characterId);

    if (!promotion || !before) {
      // No promotion data for this character (e.g., Selene who's already
      // a Tier 2, or Kian who never promotes), or no save record (the
      // character has never been in a battle yet). Bail gracefully —
      // close immediately without showing the panel so a misconfigured
      // beat doesn't strand the player on a blank modal.
      this.close();
      return;
    }

    // Apply the promotion (or detect that it's already been applied).
    const after = promoteCharacter(before, promotion);
    if (after !== before) {
      writeSave(setCharacterRecord(save, this.characterId, after));
      // Analytics — only fire on actual promotion (not on idempotent
      // re-runs from DevJump replays).
      trackCharacterPromoted(this.characterId, promotion.toClass);
    }

    // The transformation first — the class sprite they wore, light, and
    // the one they wear now — then the panel of what changed.
    const fromClass = this.spriteClass(before.classKind ?? this.guessTier1(promotion.toClass), before.spriteClassOverride);
    const toClass = this.spriteClass(promotion.toClass, after.spriteClassOverride);
    void this.transform(fromClass, toClass, promotion.toClass).then(() => {
      this.renderPanel(this.characterId, before, after, promotion.toClass, promotion.newAbility);
      sfxVictory();
    });
  }

  /** The sheet a class is drawn with: its own once shipped, else its stand-in. */
  private spriteClass(cls: ClassKind, override?: ClassKind): ClassKind | null {
    if (this.textures.exists(`unit:${cls}:idle`)) return cls;
    if (override && this.textures.exists(`unit:${override}:idle`)) return override;
    return null;
  }

  /**
   * The promotion itself: the old class sprite in a pillar of light, a
   * white flash, the new sprite standing where it stood, its class name
   * slammed in. Ends with the new sprite stepped aside to the panel's left,
   * where it stays. A click jumps to the end.
   */
  private transform(from: ClassKind | null, to: ClassKind | null, toClass: ClassKind): Promise<void> {
    if (!to) return Promise.resolve();
    const W = GAME_WIDTH, H = GAME_HEIGHT;
    const cx = W / 2, feet = H * 0.66;
    return new Promise((done) => {
      let finished = false;
      const made: Phaser.GameObjects.GameObject[] = [];
      const dim = this.add.rectangle(cx, H / 2, W, H, 0x000000, 0.86).setAlpha(0).setDepth(4);
      made.push(dim);
      this.tweens.add({ targets: dim, alpha: 1, duration: 300 });
      // Above the panel's own dim, which is drawn after it.
      const sprite = this.add.sprite(cx, feet, `unit:${from ?? to}:idle`).setOrigin(0.5, 0.9).setScale(5).setDepth(5);
      if (from && hasUnitAnimation(from, "idle")) sprite.play(animKey(from, "idle"));
      const pillar = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDepth(4.5);
      pillar.fillGradientStyle(0xfff4d0, 0xfff4d0, 0xffe6a0, 0xffe6a0, 0, 0, 0.55, 0.55);
      pillar.fillRect(cx - 70, 0, 140, feet + 10);
      pillar.fillStyle(0xfff0c0, 0.35);
      pillar.fillEllipse(cx, feet + 4, 220, 50);
      made.push(pillar);
      const motes = this.add.particles(cx, feet, ensureDotTexture(this), {
        x: { min: -60, max: 60 }, speedY: { min: -160, max: -60 }, speedX: { min: -20, max: 20 },
        lifespan: { min: 700, max: 1300 }, scale: { start: 0.45, end: 0 }, alpha: { start: 1, end: 0 },
        tint: [0xfff4c0, 0xffd870, 0xffffff], blendMode: Phaser.BlendModes.ADD, frequency: 30, emitting: false
      }).setDepth(6);
      made.push(motes);
      const name = this.add.text(cx, 150, (CLASS_DISPLAY_NAMES[toClass] ?? toClass).toUpperCase(), {
        fontFamily: FAMILY_DISPLAY, fontSize: "64px", color: "#f4d999", stroke: "#1a0e04", strokeThickness: 7,
        shadow: { offsetX: 0, offsetY: 4, color: "#000", blur: 18, fill: true }
      }).setOrigin(0.5).setAlpha(0).setScale(1.5).setLetterSpacing(6).setDepth(6);
      made.push(name);

      const finish = (): void => {
        if (finished) return;
        finished = true;
        this.input.off("pointerdown", finish);
        this.tweens.killTweensOf([sprite, ...made]);
        motes.stop();
        sprite.clearTint().setAlpha(1).setTexture(`unit:${to}:idle`);
        if (hasUnitAnimation(to, "idle")) sprite.play(animKey(to, "idle"));
        for (const o of made) o.destroy();
        // Aside, to the panel's left, where it stays with the numbers.
        this.tweens.add({ targets: sprite, x: W / 2 - 400, y: 470, scale: 4, duration: 420, ease: "Cubic.easeInOut" });
        done();
      };
      this.time.delayedCall(250, () => this.input.once("pointerdown", finish));

      // The light comes down; the old self brightens into it.
      this.time.delayedCall(500, () => {
        if (finished) return;
        sfxCineRise();
        this.tweens.add({ targets: pillar, alpha: 1, duration: 700 });
        motes.start();
        this.tweens.add({ targets: sprite, y: feet - 10, duration: 900, ease: "Sine.easeInOut" });
        // Burning white in the light, shimmering.
        sprite.setTintFill(0xfffaf0);
        this.tweens.add({ targets: sprite, alpha: 0.8, duration: 150, yoyo: true, repeat: 2, ease: "Sine.easeInOut" });
      });
      // The flash; the new self.
      this.time.delayedCall(1500, () => {
        if (finished) return;
        sfxCineBell(1.2);
        const flash = this.add.rectangle(cx, H / 2, W, H, 0xffffff, 1).setBlendMode(Phaser.BlendModes.ADD).setDepth(7);
        made.push(flash);
        this.tweens.add({ targets: flash, alpha: 0, duration: 700, ease: "Cubic.easeOut" });
        this.cameras.main.shake(260, 0.006);
        sprite.setTexture(`unit:${to}:idle`).setTintFill(0xffffff).setAlpha(1).setY(feet);
        if (hasUnitAnimation(to, "idle")) sprite.play(animKey(to, "idle"));
        this.time.delayedCall(260, () => { if (!finished) sprite.clearTint(); });
        this.tweens.add({ targets: pillar, alpha: 0, duration: 900, delay: 300 });
        motes.stop();
        this.tweens.add({ targets: name, alpha: 1, scale: 1, duration: 260, ease: "Cubic.easeIn" });
      });
      this.time.delayedCall(3000, finish);
    });
  }

  private renderPanel(
    characterId: string,
    before: CharacterRecord,
    after: CharacterRecord,
    toClass: ClassKind,
    newAbility: import("../combat/types").Ability
  ): void {
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78);
    dim.setInteractive(); // swallow clicks to scenes below

    // Banner word at the top — same spirit as the VICTORY/DEFEAT screens.
    const banner = this.add.text(GAME_WIDTH / 2, 110, "PROMOTION", {
      fontFamily: FAMILY_DISPLAY,
      fontSize: "64px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 4, color: "#000", blur: 18, fill: true, stroke: true }
    }).setOrigin(0.5).setLetterSpacing(3);
    banner.setAlpha(0);
    this.tweens.add({ targets: banner, alpha: 1, y: 130, duration: 700, ease: "Sine.easeOut" });

    // Character name + class change line.
    const characterName = this.titleCase(characterId);
    const classBefore = CLASS_DISPLAY_NAMES[before.classKind ?? this.guessTier1(toClass)] ?? "—";
    const classAfter = CLASS_DISPLAY_NAMES[toClass] ?? toClass;
    this.add.text(GAME_WIDTH / 2, 200, `${characterName}: ${classBefore}  →  ${classAfter}`, {
      fontFamily: FAMILY_HEADING,
      fontSize: "24px",
      color: "#fff7c4",
      stroke: "#000",
      strokeThickness: 3
    }).setOrigin(0.5).setLetterSpacing(1);

    // Stat-delta panel: shows before/after for every stat that changed.
    const panelW = 540;
    // 300 (was 260): a three-line ability blurb at panelY+212 needs ~51px
    // and was overhanging the old panel border by a hair. The Continue
    // button lives at GAME_HEIGHT-100, far below — no overlap either way.
    const panelH = 300;
    const panelX = GAME_WIDTH / 2 - panelW / 2;
    const panelY = 240;
    const panel = this.add.graphics();
    panel.fillStyle(0x0d111c, 0.96);
    panel.fillRect(panelX, panelY, panelW, panelH);
    panel.lineStyle(1, COLORS.gold, 0.85);
    panel.strokeRect(panelX + 0.5, panelY + 0.5, panelW - 1, panelH - 1);

    this.add.text(panelX + 24, panelY + 20, "Stats", {
      fontFamily: FAMILY_HEADING,
      fontSize: "13px",
      color: "#c9b07a"
    }).setLetterSpacing(2);

    const statDeltas = this.formatStatDeltas(before.stats, after.stats);
    const statBlock = this.add.text(panelX + 24, panelY + 44, statDeltas, {
      fontFamily: FAMILY_BODY,
      fontSize: "16px",
      color: "#dde6ef",
      lineSpacing: 6
    });

    // New ability section — always shown even if there's only one ability,
    // so the player understands the second slot just got filled. Anchored
    // BELOW the measured stat block rather than at a fixed offset: the
    // standard boost prints five delta rows, which under real font metrics
    // ran within a few px of (and could overlap) a fixed-y header.
    const abilityTop = panelY + 44 + Math.ceil(statBlock.height) + 22;
    const abilityInfo = ABILITY_DISPLAY[newAbility];
    const abilityName = abilityInfo?.name ?? newAbility;
    const abilityBlurb = abilityInfo?.blurb ?? "";
    this.add.text(panelX + 24, abilityTop, "New Ability", {
      fontFamily: FAMILY_HEADING,
      fontSize: "13px",
      color: "#c9b07a"
    }).setLetterSpacing(2);
    this.add.text(panelX + 24, abilityTop + 24, abilityName, {
      fontFamily: FAMILY_HEADING,
      fontSize: "20px",
      color: "#fff7c4"
    });
    this.add.text(panelX + 24, abilityTop + 52, abilityBlurb, {
      fontFamily: FAMILY_BODY,
      fontSize: "14px",
      color: "#a9b3c4",
      wordWrap: { width: panelW - 48 },
      lineSpacing: 3
    });

    // Continue button — primary, bottom-center. Enter or click closes.
    const btnW = 200;
    const btnH = 48;
    new Button(this, {
      x: GAME_WIDTH / 2 - btnW / 2,
      y: GAME_HEIGHT - 100,
      w: btnW, h: btnH,
      label: "Continue ▸",
      primary: true,
      fontSize: 18,
      onClick: () => { sfxClick(); this.close(); }
    });

    this.input.keyboard?.on("keydown-ENTER", () => this.close());
    this.input.keyboard?.on("keydown-SPACE", () => this.close());
  }

  // Render before/after stat lines, but only for stats that actually
  // changed. The standard promotion boost touches HP/PWR/ARM/SPD/MOV;
  // skipping unchanged stats keeps the panel compact and focuses
  // attention on the deltas.
  private formatStatDeltas(before: UnitStats, after: UnitStats): string {
    const lines: string[] = [];
    const row = (label: string, b: number, a: number): void => {
      if (a === b) return;
      const delta = a - b;
      const sign = delta > 0 ? "+" : "";
      lines.push(`${label.padEnd(4)}  ${b}  →  ${a}    (${sign}${delta})`);
    };
    row("HP",  before.hp,       after.hp);
    row("PWR", before.power,    after.power);
    row("ARM", before.armor,    after.armor);
    row("SPD", before.speed,    after.speed);
    row("MOV", before.movement, after.movement);
    row("AP",  before.ap,       after.ap);
    return lines.join("\n");
  }

  // Display heuristic — when a unit hasn't been promoted yet, before.classKind
  // is undefined (the factory's classKind is not in the save record). Fall
  // back to the obvious Tier 1 for the promotion target.
  private guessTier1(toClass: ClassKind): ClassKind {
    const tier1Of: Partial<Record<ClassKind, ClassKind>> = {
      swordmaster: "swordsman",
      spearton_lord: "spearton",
      khan: "knight",
      robinhelm: "archer",
      dactyl_king: "dactyl_rider",
      shinobi_master: "shinobi",
      guardian: "sentinel",
      // Veya's — missing, it read "Prismarch → Prismarch", and the
      // transformation started from the new sprite.
      prismarch: "lenscaster"
    };
    return tier1Of[toClass] ?? toClass;
  }

  private titleCase(s: string): string {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  private close(): void {
    if (this.resumeKey) {
      this.scene.resume(this.resumeKey);
    }
    this.scene.stop();
  }
}
