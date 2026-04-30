import Phaser from "phaser";
import { COLORS, FAMILY_BODY, FAMILY_DISPLAY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { Button } from "../ui/Button";
import { sfxClick, sfxVictory } from "../audio/Sfx";
import { ABILITY_DISPLAY, CLASS_DISPLAY_NAMES, PROMOTIONS } from "../data/promotions";
import { promoteCharacter } from "../combat/Progression";
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
    }

    this.renderPanel(this.characterId, before, after, promotion.toClass, promotion.newAbility);
    sfxVictory();
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
    const panelH = 260;
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
    this.add.text(panelX + 24, panelY + 44, statDeltas, {
      fontFamily: FAMILY_BODY,
      fontSize: "16px",
      color: "#dde6ef",
      lineSpacing: 6
    });

    // New ability section — always shown even if there's only one ability,
    // so the player understands the second slot just got filled.
    const abilityInfo = ABILITY_DISPLAY[newAbility];
    const abilityName = abilityInfo?.name ?? newAbility;
    const abilityBlurb = abilityInfo?.blurb ?? "";
    this.add.text(panelX + 24, panelY + 160, "New Ability", {
      fontFamily: FAMILY_HEADING,
      fontSize: "13px",
      color: "#c9b07a"
    }).setLetterSpacing(2);
    this.add.text(panelX + 24, panelY + 184, abilityName, {
      fontFamily: FAMILY_HEADING,
      fontSize: "20px",
      color: "#fff7c4"
    });
    this.add.text(panelX + 24, panelY + 212, abilityBlurb, {
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
      guardian: "sentinel"
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
