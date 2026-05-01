import Phaser from "phaser";
import { COLORS, FAMILY_BODY, FAMILY_HEADING, FAMILY_MONO, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { Button } from "../ui/Button";
import { drawPanel } from "../ui/Panel";
import { sfxClick } from "../audio/Sfx";
import { PLAYERS } from "../data/units";
import { BATTLES } from "../data/battles";
import { createUnit } from "../combat/Unit";
import { ensureUnitTexture } from "../art/UnitArt";
import { hasAsset } from "../assets/manifest";
import { getCharacterRecord, loadSave } from "../util/save";
import { CLASS_DISPLAY_NAMES } from "../data/promotions";
import type { Ability, UnitDef } from "../combat/types";
import type { CharacterRecord } from "../util/save";

interface RosterArgs {
  // Scene to resume on close. Mirrors SettingsScene + PromotionScene.
  from?: string;
}

// Stable display order for the roster — matches the script's intro
// sequence so the cast appears in chronological-recruit order rather
// than alphabetical. amar_true (the pre-amnesia coup version) is
// excluded — it's a B1 narrative alias of amar; in the roster we
// always show the post-amnesia identity.
//
// Each entry maps a save-record id → the PLAYERS factory key. The
// factory call gives us name / class / palette / abilities / portrait
// id; the save record gives us level / xp / current stats / post-
// promotion class.
const ROSTER_ORDER: Array<{ recordId: string; factory: () => UnitDef }> = [
  { recordId: "amar",      factory: PLAYERS.amar      },
  { recordId: "lucian",    factory: PLAYERS.lucian    },
  { recordId: "ning",      factory: PLAYERS.ning      },
  { recordId: "maya",      factory: PLAYERS.maya      },
  { recordId: "kian",      factory: PLAYERS.kian      },
  { recordId: "leo",       factory: PLAYERS.leo       },
  { recordId: "ranatoli",  factory: PLAYERS.ranatoli  },
  { recordId: "selene",    factory: PLAYERS.selene    }
];

// Active squad after each battle's completion. Keyed by BattleId; the
// value is the list of PLAYERS factory ids that should appear in the
// roster after winning that battle. The roster is computed by finding
// the highest-indexed completed battle in this table and reading its
// squad list.
//
// Why this exists: B1 ends with the original 8 captured/dead — Amar
// wakes up alone in the hospital, so the roster MUST collapse to just
// him until B2 recruits begin. Without this filter the roster would
// keep showing Ranatoli + Selene + amar_true after B1 (since their
// CharacterRecords are still in the save) — confusing because those
// characters aren't actually with Amar anymore at that point in the
// story. From B2 onward the squad accumulates as new characters join.
//
// Selene's B7 reappearance is as an enemy boss (`selene_enemy`), not a
// player character; she stays out of the roster. Future battles where
// she's recruited can add her here.
const ACTIVE_ROSTER: Partial<Record<string, string[]>> = {
  b01_palace_coup:    ["amar"],                                                    // hospital, alone
  b02_farmland:       ["amar", "lucian", "ning"],                                  // squad starts forming
  b03_dawn_bandits:   ["amar", "lucian", "ning", "maya"],                          // Maya stays
  b04_swamp:          ["amar", "lucian", "ning", "maya", "kian"],                  // Kian rejoins
  b05_mountain_ndari: ["amar", "lucian", "ning", "maya", "kian", "leo"],           // Leo joins
  b06_caravan:        ["amar", "lucian", "ning", "maya", "kian", "leo"],
  b07_monastery:      ["amar", "lucian", "ning", "maya", "kian", "leo"],           // Selene escapes (not recruited)
  b08_orinhal:        ["amar", "lucian", "ning", "maya", "kian", "leo"],
  b09_ravine:         ["amar", "lucian", "ning", "maya", "kian", "leo"]
};

// Resolve the player's current active squad based on their save's
// completedBattles. Walks the BATTLES list backwards (highest index
// first) and returns the first ACTIVE_ROSTER entry that matches a
// completed battle. Empty array if no completed battles or no match.
const getActiveSquadIds = (completedBattles: string[]): string[] => {
  // Sort completed battle ids by their BATTLES index, descending.
  const completed = completedBattles
    .map((id) => BATTLES.find((b) => b.id === id))
    .filter((b): b is typeof BATTLES[number] => b !== undefined)
    .sort((a, b) => b.index - a.index);
  for (const b of completed) {
    const squad = ACTIVE_ROSTER[b.id];
    if (squad) return squad;
  }
  return [];
};

// RosterScene — modal overlay launched from OverworldScene's "Roster"
// button. Lists every player character that has a save record (the player
// has fought with them at least once) plus the original-8 veterans (in
// the save from B1 even before they rejoin). Each row shows the unit's
// current state from the save: level, XP-toward-next-level, full stat
// block, abilities, and post-promotion class if applicable.
//
// Pause/resume mirrors SettingsScene: the launching scene calls
// `scene.pause()` and `scene.run("RosterScene", { from: ... })`; this
// scene calls `scene.resume(fromKey)` + `scene.stop()` on close.
export class RosterScene extends Phaser.Scene {
  private fromKey?: string;

  constructor() { super("RosterScene"); }

  init(data: RosterArgs): void {
    this.fromKey = data?.from;
  }

  create(): void {
    // Full-screen dim — interactive so background clicks don't fall through.
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.65);
    dim.setInteractive();
    void dim;

    // Modal panel
    const panelW = 760;
    const panelH = 600;
    const panelX = GAME_WIDTH / 2 - panelW / 2;
    const panelY = GAME_HEIGHT / 2 - panelH / 2;
    const panelG = this.add.graphics();
    drawPanel(panelG, panelX, panelY, panelW, panelH);

    this.add.text(GAME_WIDTH / 2, panelY + 28, "Roster", {
      fontFamily: FAMILY_HEADING,
      fontSize: "28px",
      color: "#f4e4b0",
      stroke: "#000",
      strokeThickness: 2
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, panelY + 60, "Your active party — current stats from the save", {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: "#c9b07a",
      fontStyle: "italic"
    }).setOrigin(0.5);

    const save = loadSave();

    // Resolve roster: filter to the CURRENT ACTIVE SQUAD based on the
    // player's progress. ACTIVE_ROSTER maps "highest completed battle"
    // → list of character ids actually with Amar at that point in the
    // story. Without this filter the roster would still show Ranatoli
    // and Selene after B1 (their CharacterRecords are still in the
    // save) — but they were captured/lost in the failed coup, so the
    // post-amnesia squad doesn't include them.
    const activeSquadIds = getActiveSquadIds(save.completedBattles);
    const roster = ROSTER_ORDER
      .filter(({ recordId }) => activeSquadIds.includes(recordId))
      .map(({ recordId, factory }) => {
        const rec = getCharacterRecord(save, recordId);
        if (!rec) return null;
        return { rec, def: factory(), recordId };
      })
      .filter((x): x is { rec: CharacterRecord; def: UnitDef; recordId: string } => x !== null);

    // Special case: B1 saves a record under "amar_true" (pre-amnesia
    // statline). If the player has fought B1 but not yet B2, "amar" is
    // in the active squad but has no record yet — synthesize an entry
    // from "amar_true" so Amar still shows. The post-amnesia identity
    // is the canonical one going forward; the L10 statline from B1 is
    // what carries over until B2 starts overwriting it with post-
    // amnesia progression.
    if (activeSquadIds.includes("amar") && !roster.find((r) => r.recordId === "amar")) {
      const amarTrueRec = getCharacterRecord(save, "amar_true");
      if (amarTrueRec) {
        roster.unshift({
          rec: amarTrueRec,
          def: PLAYERS.amarHidden(),
          recordId: "amar_true"
        });
      }
    }

    // Empty state: no battles played yet (impossible from the overworld
    // since B1 is required to reach it, but defensive).
    if (roster.length === 0) {
      this.add.text(GAME_WIDTH / 2, panelY + panelH / 2, "No party members yet — fight your first battle to see them here.", {
        fontFamily: FAMILY_BODY,
        fontSize: "16px",
        color: "#9a9aa0",
        align: "center",
        wordWrap: { width: panelW - 80 }
      }).setOrigin(0.5);
    } else {
      this.renderRoster(roster, panelX, panelY, panelW, panelH);
    }

    // Close button + ESC + ENTER
    const closeW = 180;
    new Button(this, {
      x: GAME_WIDTH / 2 - closeW / 2,
      y: panelY + panelH - 64,
      w: closeW, h: 44,
      label: "Close",
      primary: true,
      fontSize: 16,
      onClick: () => { sfxClick(); this.close(); }
    });
    this.input.keyboard?.on("keydown-ESC", () => this.close());
    this.input.keyboard?.on("keydown-ENTER", () => this.close());
  }

  // Render the scrollable list of party members. Each row shows portrait
  // (or generated unit sprite as fallback), name, current class, level,
  // XP-to-next, full stat line, and ability list.
  private renderRoster(
    roster: Array<{ rec: CharacterRecord; def: UnitDef; recordId: string }>,
    panelX: number, panelY: number, panelW: number, panelH: number
  ): void {
    const listTop = panelY + 92;
    const listBottom = panelY + panelH - 92; // leave room for title above + Close button below
    const listH = listBottom - listTop;
    const listLeft = panelX + 24;
    const listW = panelW - 48;
    const rowH = 96;
    const contentH = roster.length * rowH;
    const maxScroll = Math.max(0, contentH - listH);

    const rowsContainer = this.add.container(0, 0);
    let py = 0;
    for (const { rec, def } of roster) {
      const rowY = listTop + py;
      const u = createUnit(def, { x: 0, y: 0 });
      // Apply the saved current state to the cloned unit so the avatar
      // generator + portrait id reflect any post-promotion overrides
      // (spriteClassOverride, classKind).
      if (rec.classKind) u.classKind = rec.classKind;
      if (rec.spriteClassOverride) u.spriteClassOverride = rec.spriteClassOverride;

      // Avatar — prefer the portrait PNG with a circular cover-fit crop
      // (preserves source aspect ratio, no stretch). Falls back to the
      // procedural unit sprite if no portrait shipped.
      //
      // Earlier version did `setDisplaySize(72, 72)` which forced any
      // portrait into a square regardless of source aspect — most of our
      // portraits are 2:3 paintings, so they squished horribly. The cover-
      // fit + circular mask treatment matches BattleScene.setSidePanelAvatar:
      // scale source to OVERFILL the avatar circle, anchor the face center
      // (~24% down from top of source), then mask to a circle. Faces stay
      // proportional, no stretch, no awkward chin crops.
      const portraitKey = `portrait:${u.portraitId ?? u.id}`;
      const hasPortrait = hasAsset(portraitKey) && this.textures.exists(portraitKey);
      const avatarSize = 72;            // diameter of the circular avatar
      const avatarCx = listLeft + 36;   // center x — same as old layout
      const avatarCy = rowY + 48;       // center y
      let avatar: Phaser.GameObjects.Image;
      if (hasPortrait) {
        const tex = this.textures.get(portraitKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
        const srcW = tex.width || 600;
        const srcH = tex.height || 600;
        // Cover-fit: scale so the avatar circle is fully covered, then
        // pull the image up so the face center lands on the circle's
        // vertical center. Painted portraits put the eye line at ~22%
        // and the face midline at ~24% down from the top.
        const scale = Math.max(avatarSize / srcW, avatarSize / srcH);
        const displayW = srcW * scale;
        const displayH = srcH * scale;
        const headCenterFromTop = displayH * 0.24;
        avatar = this.add.image(avatarCx, avatarCy - headCenterFromTop, portraitKey)
          .setOrigin(0.5, 0)
          .setDisplaySize(displayW, displayH);
        // Circular mask — drawn into a make.graphics, set as the avatar's
        // mask, then added INSIDE rowsContainer so it scrolls with the
        // row (otherwise it would stay at world position while the
        // avatar scrolls past, exposing the cover-fit overflow).
        const maskG = this.make.graphics({ x: 0, y: 0 }, false);
        maskG.fillStyle(0xffffff);
        maskG.fillCircle(avatarCx, avatarCy, avatarSize / 2);
        avatar.setMask(maskG.createGeometryMask());
        rowsContainer.add(maskG);
      } else {
        // No portrait — show the procedural unit sprite at native aspect.
        const tex = ensureUnitTexture(this, u);
        avatar = this.add.image(avatarCx, avatarCy, tex).setDisplaySize(56, 70);
        if (u.faction === "enemy") avatar.setFlipX(true);
      }

      // Name + LV header on the same row
      const nameTxt = this.add.text(listLeft + 88, rowY + 6, def.name, {
        fontFamily: FAMILY_HEADING,
        fontSize: "20px",
        color: "#f8f0d8",
        stroke: "#000",
        strokeThickness: 2
      });
      const lvTxt = this.add.text(listLeft + listW - 12, rowY + 8, `LV ${rec.level}${rec.level >= 20 ? " · MAX" : ` · ${rec.xp}/100 XP`}`, {
        fontFamily: FAMILY_HEADING,
        fontSize: "14px",
        color: "#fff7c4"
      }).setOrigin(1, 0);

      // Class line (post-promotion if applicable)
      const classKind = rec.classKind ?? def.classKind;
      const className = CLASS_DISPLAY_NAMES[classKind] ?? classKind;
      const classTxt = this.add.text(listLeft + 88, rowY + 32, `${className} · ${this.weaponLabel(def.weapon)}`, {
        fontFamily: FAMILY_BODY,
        fontSize: "13px",
        color: "#c9b07a"
      });

      // Stat line (current saved stats, not factory defaults)
      const stats = rec.stats;
      const statText = `HP ${stats.hp}  PWR ${stats.power}  ARM ${stats.armor}  SPD ${stats.speed}  MOV ${stats.movement}  AP ${stats.ap}`;
      const statTxt = this.add.text(listLeft + 88, rowY + 52, statText, {
        fontFamily: FAMILY_MONO,
        fontSize: "12px",
        color: "#9da7b8"
      });

      // Abilities (post-promotion if applicable)
      const abilities = (rec.abilities ?? def.abilities ?? []) as Ability[];
      const abilityText = abilities.length > 0 ? `Abilities: ${abilities.join(", ")}` : "";
      const ablTxt = this.add.text(listLeft + 88, rowY + 72, abilityText, {
        fontFamily: FAMILY_BODY,
        fontSize: "12px",
        color: "#a4c8a4",
        fontStyle: "italic"
      });

      // Subtle separator under each row except the last
      const sep = this.add.graphics();
      sep.lineStyle(1, COLORS.gold, 0.18);
      sep.beginPath();
      sep.moveTo(listLeft + 12, rowY + rowH - 4);
      sep.lineTo(listLeft + listW - 12, rowY + rowH - 4);
      sep.strokePath();

      rowsContainer.add([avatar, nameTxt, lvTxt, classTxt, statTxt, ablTxt, sep]);
      // Thin gold ring around the portrait, drawn LAST so it sits on top
      // of the cover-fit portrait edge. Skipped for sprite-based avatars
      // (procedural fallback) since they have no edge to clean up.
      if (hasPortrait) {
        const ring = this.add.graphics();
        ring.lineStyle(2, 0xc9b07a, 0.85);
        ring.strokeCircle(avatarCx, avatarCy, avatarSize / 2);
        rowsContainer.add(ring);
      }
      py += rowH;
    }

    // Geometry mask clips rows to the visible list region
    const maskShape = this.make.graphics({ x: 0, y: 0 }, false);
    maskShape.fillStyle(0xffffff);
    maskShape.fillRect(listLeft, listTop, listW, listH);
    rowsContainer.setMask(maskShape.createGeometryMask());

    // Wheel-scroll + scrollbar (only when content overflows)
    if (maxScroll > 0) {
      let scroll = 0;
      const sbX = listLeft + listW - 6;
      const sbG = this.add.graphics();
      const drawScrollbar = (): void => {
        sbG.clear();
        sbG.fillStyle(0x1a0e04, 0.6);
        sbG.fillRect(sbX, listTop, 6, listH);
        const thumbH = Math.max(24, (listH / contentH) * listH);
        const thumbY = listTop + (scroll / maxScroll) * (listH - thumbH);
        sbG.fillStyle(COLORS.gold, 0.85);
        sbG.fillRect(sbX, thumbY, 6, thumbH);
      };
      drawScrollbar();

      const hitZone = this.add.zone(panelX + panelW / 2, listTop + listH / 2, panelW, listH).setInteractive();
      hitZone.on("wheel", (_p: Phaser.Input.Pointer, _dx: number, dy: number) => {
        scroll = Phaser.Math.Clamp(scroll + dy * 0.5, 0, maxScroll);
        rowsContainer.y = -scroll;
        drawScrollbar();
      });
      this.input.on("wheel", (p: Phaser.Input.Pointer, _objs: unknown, _dx: number, dy: number) => {
        if (p.x < panelX || p.x > panelX + panelW) return;
        if (p.y < listTop || p.y > listBottom) return;
        scroll = Phaser.Math.Clamp(scroll + dy * 0.5, 0, maxScroll);
        rowsContainer.y = -scroll;
        drawScrollbar();
      });
    }
  }

  private weaponLabel(w: string): string {
    switch (w) {
      case "sword":  return "Sword";
      case "spear":  return "Spear";
      case "shield": return "Shield";
      case "bow":    return "Bow";
      case "dactyl": return "Dactyl";
      default:       return w;
    }
  }

  private close(): void {
    if (this.fromKey) {
      this.scene.resume(this.fromKey);
      this.scene.stop();
    } else {
      this.scene.stop();
    }
  }
}

