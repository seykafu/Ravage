import Phaser from "phaser";
import { FAMILY_BODY, FAMILY_HEADING, FAMILY_MONO, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { ensureBackdropForKey } from "../art/BackdropArt";
import { getMusic } from "../audio/Music";
import { drawPanel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { battleById } from "../data/battles";
import type { ClassKind, UnitDef, WeaponKind } from "../combat/types";
import { ensureUnitTexture } from "../art/UnitArt";
import { createUnit } from "../combat/Unit";
import { sfxClick } from "../audio/Sfx";
import { SettingsButton } from "../ui/SettingsButton";
import { createScrollableText } from "../ui/scrollableText";
import type { BattleId } from "../data/contentIds";

interface PrepArgs { battleId: BattleId; }

const classLabel = (k: ClassKind): string => {
  switch (k) {
    // Tier 1
    case "swordsman": return "Swordsman";
    case "spearton":  return "Spearton";
    case "archer":    return "Archer";
    case "knight":    return "Knight";
    case "shinobi":   return "Shinobi";
    case "sentinel":  return "Sentinel";
    case "dactyl_rider": return "Dactyl Rider";
    // Tier 2 — added when the promotion system landed.
    case "swordmaster":    return "Swordmaster";
    case "spearton_lord":  return "Spearton Lord";
    case "khan":           return "Khan";
    case "robinhelm":      return "Robinhelm";
    case "dactyl_king":    return "Dactyl King";
    case "shinobi_master": return "Shinobi Master";
    case "guardian":       return "Guardian";
    // Special
    case "boss": return "Adversary";
  }
};

const weaponLabel = (w: WeaponKind): string => {
  switch (w) {
    case "sword": return "Sword";
    case "spear": return "Spear";
    case "shield": return "Shield";
    case "bow": return "Bow";
    case "dactyl": return "Dactyl";
  }
};

export class BattlePrepScene extends Phaser.Scene {
  private battleId!: BattleId;
  constructor() { super("BattlePrepScene"); }
  init(data: PrepArgs): void { this.battleId = data.battleId; }

  create(): void {
    const node = battleById(this.battleId);
    if (!node) { this.scene.start("OverworldScene"); return; }

    const bgKey = ensureBackdropForKey(this, node.backdropKey);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    const v = this.add.graphics();
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.55, 0.55, 0.85, 0.85);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Title block
    this.add.text(GAME_WIDTH / 2, 50, `${node.title} — ${node.subtitle}`, {
      fontFamily: FAMILY_HEADING,
      fontSize: "30px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 4
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 88, node.difficultyLabel, {
      fontFamily: FAMILY_HEADING,
      fontSize: "16px",
      color: "#c9b07a"
    }).setOrigin(0.5);

    // Intro panel — body text is scrollable so paragraph-length intros
    // (b07's monastery briefing wraps to 6+ lines) don't bleed past the
    // panel's bottom border. The scrollable region starts at y+44 (below
    // the "Field Brief" header) and runs to y+H-12 (12px bottom padding).
    const introX = 60;
    const introY = 130;
    const introW = GAME_WIDTH - 120;
    const introH = 130;
    const introG = this.add.graphics();
    drawPanel(introG, introX, introY, introW, introH);
    this.add.text(introX + 24, introY + 18, "Field Brief", {
      fontFamily: FAMILY_HEADING,
      fontSize: "16px",
      color: "#f4d999"
    });
    createScrollableText(this, {
      x: introX + 24,
      y: introY + 44,
      w: introW - 48,
      h: introH - 44 - 12,
      text: node.intro,
      style: {
        fontFamily: FAMILY_BODY,
        fontSize: "15px",
        color: "#dad3bd",
        lineSpacing: 4
      }
    });

    // Combat primer
    const primerX = 60;
    const primerY = 280;
    const primerW = 380;
    const primerH = 360;
    const primerG = this.add.graphics();
    drawPanel(primerG, primerX, primerY, primerW, primerH);
    this.add.text(primerX + 24, primerY + 18, "Tactical Reminder", {
      fontFamily: FAMILY_HEADING,
      fontSize: "16px",
      color: "#f4d999"
    });
    const primer = [
      "• Phase-based: your units act first, then enemies.",
      "• Within a phase, units act in Speed order.",
      "• Each unit spends Action Points (AP).",
      "• Move · Attack · Ready · Defend · Potion (1 AP).",
      "• Weapon triangle: Sword > Spear > Shield > Sword.",
      "• Triangle advantage = passive 1.5× counter.",
      "• Mounted units (Knight, Dactyl) get +2 move.",
      "• Items: 5 max per character; assign from squad pool.",
      "• Abilities: Boss Fighter, Aide, Destruct, Roam.",
      "• Click a unit to inspect; click active to clear."
    ];
    this.add.text(primerX + 24, primerY + 50, primer.join("\n"), {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: "#dad3bd",
      lineSpacing: 6,
      wordWrap: { width: primerW - 48 }
    });

    // Roster panel
    const rosterX = 460;
    const rosterY = 280;
    const rosterW = GAME_WIDTH - rosterX - 60;
    const rosterH = 360;
    const rosterG = this.add.graphics();
    drawPanel(rosterG, rosterX, rosterY, rosterW, rosterH);
    this.add.text(rosterX + 24, rosterY + 18, "Your Vanguard", {
      fontFamily: FAMILY_HEADING,
      fontSize: "16px",
      color: "#f4d999"
    });

    const players: UnitDef[] = node.buildPlayers ? node.buildPlayers() : [];

    // Scrollable roster region — clip rows to the panel interior.
    const listTop = rosterY + 50;
    const listBottom = rosterY + rosterH - 16;
    const listH = listBottom - listTop;
    const listLeft = rosterX + 12;
    const listW = rosterW - 24;
    const rowH = 80;
    const contentH = players.length * rowH;
    const maxScroll = Math.max(0, contentH - listH);

    const rowsContainer = this.add.container(0, 0);
    let py = 0;
    for (const def of players) {
      const u = createUnit(def, { x: 0, y: 0 });
      const tex = ensureUnitTexture(this, u);
      const portrait = this.add.image(rosterX + 40, listTop + py + 26, tex).setDisplaySize(48, 60);
      const nameTxt = this.add.text(rosterX + 80, listTop + py, def.name, {
        fontFamily: FAMILY_HEADING,
        fontSize: "16px",
        color: "#f8f0d8"
      });
      const classTxt = this.add.text(rosterX + 80, listTop + py + 22, `${classLabel(def.classKind)} · ${weaponLabel(def.weapon)}`, {
        fontFamily: FAMILY_BODY,
        fontSize: "12px",
        color: "#c9b07a"
      });
      const statTxt = this.add.text(rosterX + 80, listTop + py + 40, statLine(def), {
        fontFamily: FAMILY_MONO,
        fontSize: "12px",
        color: "#9da7b8"
      });
      rowsContainer.add([portrait, nameTxt, classTxt, statTxt]);
      py += rowH;
    }

    const maskShape = this.make.graphics({ x: 0, y: 0 }, false);
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(listLeft, listTop, listW, listH);
    rowsContainer.setMask(maskShape.createGeometryMask());

    if (maxScroll > 0) {
      // Track scroll position via container y offset.
      let scroll = 0;
      const trackX = rosterX + rosterW - 12;
      const trackG = this.add.graphics();
      const drawTrack = (): void => {
        trackG.clear();
        trackG.fillStyle(0x1a0e04, 0.6);
        trackG.fillRect(trackX - 3, listTop, 6, listH);
        const thumbH = Math.max(24, (listH / contentH) * listH);
        const thumbY = listTop + (scroll / maxScroll) * (listH - thumbH);
        trackG.fillStyle(0xc9b07a, 0.85);
        trackG.fillRect(trackX - 3, thumbY, 6, thumbH);
      };
      drawTrack();

      const hitZone = this.add.zone(rosterX + rosterW / 2, listTop + listH / 2, rosterW, listH).setInteractive();
      hitZone.on("wheel", (_p: Phaser.Input.Pointer, _dx: number, dy: number) => {
        scroll = Phaser.Math.Clamp(scroll + dy * 0.5, 0, maxScroll);
        rowsContainer.y = -scroll;
        drawTrack();
      });
      this.input.on("wheel", (p: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number) => {
        if (p.x < rosterX || p.x > rosterX + rosterW) return;
        if (p.y < listTop || p.y > listBottom) return;
        scroll = Phaser.Math.Clamp(scroll + dy * 0.5, 0, maxScroll);
        rowsContainer.y = -scroll;
        drawTrack();
      });
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
    // Inventory — opens the squad pool / per-character bag distribution
    // / trading post modal as a paused overlay. Sits between the map
    // and march buttons so the player naturally reaches for it after
    // reading the brief and before committing to battle.
    new Button(this, {
      x: GAME_WIDTH - 460, y: GAME_HEIGHT - 56,
      w: 200, h: 40,
      label: "📦 Inventory + Trade",
      primary: false,
      fontSize: 14,
      onClick: () => {
        sfxClick();
        this.scene.pause();
        this.scene.run("InventoryScene", {
          battleId: node.id,
          resumeKey: this.scene.key
        });
      }
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

    new SettingsButton(this, GAME_WIDTH - 32, 32);
  }
}

const statLine = (u: UnitDef): string =>
  `HP ${u.stats.hp} · PWR ${u.stats.power} · ARM ${u.stats.armor} · SPD ${u.stats.speed} · MOV ${u.stats.movement} · AP ${u.stats.ap}`;
