import Phaser from "phaser";
import { GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { ensureBackdropTexture, BACKDROPS } from "../art/BackdropArt";
import { getMusic } from "../audio/Music";
import { drawPanel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { battleById } from "../data/battles";
import type { ClassKind, UnitDef, WeaponKind } from "../combat/types";
import { ensureUnitTexture } from "../art/UnitArt";
import { createUnit } from "../combat/Unit";
import { sfxClick } from "../audio/Sfx";

interface PrepArgs { battleId: string; }

const classLabel = (k: ClassKind): string => {
  switch (k) {
    case "swordsman": return "Swordsman";
    case "spearton":  return "Spearton";
    case "archer":    return "Archer";
    case "knight":    return "Knight";
    case "shinobi":   return "Shinobi";
    case "sentinel":  return "Sentinel";
    case "wyvern_rider": return "Wyvern Rider";
    case "swordmaster":  return "Swordmaster";
    case "boss": return "Adversary";
  }
};

const weaponLabel = (w: WeaponKind): string => {
  switch (w) {
    case "sword": return "Sword";
    case "spear": return "Spear";
    case "shield": return "Shield";
    case "bow": return "Bow";
    case "wyvern": return "Wyvern";
  }
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

export class BattlePrepScene extends Phaser.Scene {
  private battleId!: string;
  constructor() { super("BattlePrepScene"); }
  init(data: PrepArgs): void { this.battleId = data.battleId; }

  create(): void {
    const node = battleById(this.battleId);
    if (!node) { this.scene.start("OverworldScene"); return; }

    const bdSpec = BACKDROPS[BACKDROP_LOOKUP[node.backdropKey] ?? "thuling"];
    const bgKey = ensureBackdropTexture(this, node.backdropKey, bdSpec);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    const v = this.add.graphics();
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0.85, 0.85);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Title block
    this.add.text(GAME_WIDTH / 2, 50, `${node.title} — ${node.subtitle}`, {
      fontFamily: "Cinzel, Trajan Pro, serif",
      fontSize: "30px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 4
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 88, node.difficultyLabel, {
      fontFamily: "Cinzel, Trajan Pro, serif",
      fontSize: "16px",
      color: "#c9b07a"
    }).setOrigin(0.5);

    // Intro panel
    const introX = 60;
    const introY = 130;
    const introW = GAME_WIDTH - 120;
    const introH = 130;
    const introG = this.add.graphics();
    drawPanel(introG, introX, introY, introW, introH);
    this.add.text(introX + 24, introY + 18, "Field Brief", {
      fontFamily: "Cinzel, Trajan Pro, serif",
      fontSize: "16px",
      color: "#f4d999"
    });
    this.add.text(introX + 24, introY + 44, node.intro, {
      fontFamily: "Georgia, serif",
      fontSize: "15px",
      color: "#dad3bd",
      wordWrap: { width: introW - 48 },
      lineSpacing: 4
    });

    // Combat primer
    const primerX = 60;
    const primerY = 280;
    const primerW = 380;
    const primerH = 320;
    const primerG = this.add.graphics();
    drawPanel(primerG, primerX, primerY, primerW, primerH);
    this.add.text(primerX + 24, primerY + 18, "Tactical Reminder", {
      fontFamily: "Cinzel, Trajan Pro, serif",
      fontSize: "16px",
      color: "#f4d999"
    });
    const primer = [
      "• Initiative is Speed-sorted, not phase-based.",
      "• Each unit has Action Points (AP). Spend them to act.",
      "• Move (1 AP) · Attack (1 AP) · Ready (1 AP) · Defend (1 AP).",
      "• Ready stance counters the first melee attacker. +25% damage, +5% crit.",
      "• Defensive stance halves incoming damage until your next turn.",
      "• Weapon triangle: Sword > Spear > Shield > Sword (×1.15 / ×0.85).",
      "• Terrain modifies damage and hit rate.",
      "• Tab key (in battle) toggles the debug overlay."
    ];
    this.add.text(primerX + 24, primerY + 50, primer.join("\n"), {
      fontFamily: "Georgia, serif",
      fontSize: "14px",
      color: "#dad3bd",
      lineSpacing: 6
    });

    // Roster panel
    const rosterX = 460;
    const rosterY = 280;
    const rosterW = GAME_WIDTH - rosterX - 60;
    const rosterH = 320;
    const rosterG = this.add.graphics();
    drawPanel(rosterG, rosterX, rosterY, rosterW, rosterH);
    this.add.text(rosterX + 24, rosterY + 18, "Your Vanguard", {
      fontFamily: "Cinzel, Trajan Pro, serif",
      fontSize: "16px",
      color: "#f4d999"
    });

    const players: UnitDef[] = node.buildPlayers ? node.buildPlayers() : [];
    let py = rosterY + 50;
    for (const def of players) {
      const u = createUnit(def, { x: 0, y: 0 });
      const tex = ensureUnitTexture(this, u);
      this.add.image(rosterX + 40, py + 26, tex).setDisplaySize(48, 60);
      this.add.text(rosterX + 80, py, def.name, {
        fontFamily: "Cinzel, Trajan Pro, serif",
        fontSize: "16px",
        color: "#f8f0d8"
      });
      this.add.text(rosterX + 80, py + 22, `${classLabel(def.classKind)} · ${weaponLabel(def.weapon)}`, {
        fontFamily: "Georgia, serif",
        fontSize: "12px",
        color: "#c9b07a"
      });
      this.add.text(rosterX + 80, py + 40, statLine(def), {
        fontFamily: "Consolas, Menlo, monospace",
        fontSize: "12px",
        color: "#9da7b8"
      });
      py += 80;
    }

    // Buttons
    new Button(this, {
      x: 60, y: GAME_HEIGHT - 56,
      w: 180, h: 40,
      label: "◂ Back to map",
      primary: false,
      fontSize: 14,
      onClick: () => this.scene.start("OverworldScene")
    });
    new Button(this, {
      x: GAME_WIDTH - 240, y: GAME_HEIGHT - 56,
      w: 200, h: 40,
      label: "March to Battle ▸",
      primary: true,
      fontSize: 16,
      onClick: () => {
        sfxClick();
        this.cameras.main.fadeOut(450, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("BattleScene", { battleId: node.id }));
      }
    });

    getMusic(this).play(node.prepMusic, { fadeMs: 800 });
    this.cameras.main.fadeIn(450, 0, 0, 0);
  }
}

const statLine = (u: UnitDef): string =>
  `HP ${u.stats.hp} · PWR ${u.stats.power} · ARM ${u.stats.armor} · SPD ${u.stats.speed} · MOV ${u.stats.movement} · AP ${u.stats.ap}`;
