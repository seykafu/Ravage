import Phaser from "phaser";
import { COLORS, FAMILY_BODY, FAMILY_DISPLAY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { ensureBackdropTexture, BACKDROPS } from "../art/BackdropArt";
import { getMusic, MUSIC } from "../audio/Music";
import { drawPanel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { BATTLES } from "../data/battles";
import { loadSave } from "../util/save";
import { sfxClick } from "../audio/Sfx";
import { SettingsButton } from "../ui/SettingsButton";

// CampScene — the squad's home base between battles.
//
// Sits between the save-slot picker and the World Map (formerly the
// only between-battle scene). The flow is now:
//
//   Title → SaveSlot → CampScene → [signpost] → OverworldScene → BattlePrep → Battle → CampScene
//
// Replaces OverworldScene's role as the between-battle landing pad.
// OverworldScene still exists and renders the battle grid; the player
// reaches it via the camp's signpost ("Where to Next?").
//
// COMMIT 1 SCOPE — shell + routing only.
//   - Painted backdrop placeholder (reuses thuling backdrop for now)
//   - Title + brief subtitle
//   - Four primary hotspots as buttons:
//       * Wagon → Inventory + Trade
//       * Where to Next? → World Map (OverworldScene)
//       * Roster → existing RosterScene as paused overlay
//       * Memories Wall → stub button, opens placeholder modal
//   - Title return + Settings gear
//
// Future commits add: painted character sprites at anchored spots,
// click-character → CampTalkScene idle dialogues, fallen-character
// memorial markers, wounded-character indicators, multiple camp
// locations (Para harbor, Dawn's compound), the real Memories
// system. See docs/RAVAGE_DESIGN.md camp section (TBD) for the full
// scope plan.
export class CampScene extends Phaser.Scene {
  constructor() { super("CampScene"); }

  create(): void {
    // Backdrop. Placeholder reuses the thuling backdrop until the
    // commit-2 painted camp tableau ships. Vignette darker than the
    // overworld's so the camp reads as INTERIOR (sundown camp around
    // a fire) rather than EXTERIOR (open road).
    const bgKey = ensureBackdropTexture(this, "bg_camp", BACKDROPS.thuling);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    const v = this.add.graphics();
    v.fillGradientStyle(0x0a0604, 0x0a0604, 0x05060a, 0x05060a, 0.65, 0.65, 0.92, 0.92);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Title. Uses the display font for the camp's name to give it the
    // weight of a place rather than a menu — players should feel like
    // they've ARRIVED somewhere, not opened a screen.
    this.add.text(GAME_WIDTH / 2, 60, "The Camp", {
      fontFamily: FAMILY_DISPLAY,
      fontSize: "56px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 4, color: "#000", blur: 14, fill: true }
    }).setOrigin(0.5).setLetterSpacing(4);

    // Subtitle reflects current chapter context. Reads the most recent
    // completed battle and shows where the squad is camped narratively.
    const save = loadSave();
    const subtitle = this.resolveCampSubtitle(save.completedBattles);
    this.add.text(GAME_WIDTH / 2, 110, subtitle, {
      fontFamily: FAMILY_BODY,
      fontSize: "16px",
      color: "#c9b07a",
      fontStyle: "italic"
    }).setOrigin(0.5);

    // Squad summary — small status line so the player feels the camp's
    // population at a glance. Full roster is one click away.
    const squadCount = this.activeSquadIds(save.completedBattles).length;
    this.add.text(GAME_WIDTH / 2, 138, `${squadCount} ${squadCount === 1 ? "soul" : "souls"} at the fire tonight`, {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: "#7a7165"
    }).setOrigin(0.5);

    // ---- Primary hotspots (commit-1 placeholder buttons) ------------------
    // Future commit replaces these with painted props you click on
    // (wagon, signpost, fire, memorial). For commit 1 they're just
    // labelled buttons in a 2×2 grid so the routing is testable.
    const colW = 320;
    const rowH = 110;
    const gridW = colW * 2 + 40;          // 40px gap
    const gridX = (GAME_WIDTH - gridW) / 2;
    const gridY = 220;

    this.renderHotspot(
      gridX, gridY, colW, rowH,
      "📦 The Wagon",
      "Manage inventory and trade with the squad's quartermaster.",
      () => this.openWagon(save.completedBattles)
    );
    this.renderHotspot(
      gridX + colW + 40, gridY, colW, rowH,
      "🗺 Where to Next?",
      "Open the map and pick the next battle.",
      () => {
        sfxClick();
        this.cameras.main.fadeOut(350, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("OverworldScene"));
      }
    );
    this.renderHotspot(
      gridX, gridY + rowH + 30, colW, rowH,
      "📋 The Roster",
      "Review every soul in the squad — levels, stats, abilities.",
      () => {
        sfxClick();
        this.scene.pause();
        this.scene.run("RosterScene", { from: this.scene.key });
      }
    );
    this.renderHotspot(
      gridX + colW + 40, gridY + rowH + 30, colW, rowH,
      "📜 Memories Wall",
      "(no memories forged yet — bonds will surface here in a future update)",
      () => {
        sfxClick();
        this.showMemoriesPlaceholder();
      },
      /* enabled */ false
    );

    // ---- Footer: title return + settings -------------------------------
    new Button(this, {
      x: 40,
      y: GAME_HEIGHT - 56,
      w: 140,
      h: 40,
      label: "◂ Title",
      primary: false,
      fontSize: 14,
      onClick: () => {
        sfxClick();
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("TitleScene"));
      }
    });

    new SettingsButton(this, GAME_WIDTH - 32, 32);

    // Music — quiet camp track. Spine of the World - Everyday is the
    // closest fit; final track choice flexes when more between-battle
    // music ships.
    getMusic(this).play(MUSIC.everydayLife, { fadeMs: 1000 });

    this.cameras.main.fadeIn(450, 0, 0, 0);
  }

  // ---- Hotspot rendering ----------------------------------------------------

  private renderHotspot(
    x: number, y: number, w: number, h: number,
    label: string, desc: string,
    onClick: () => void,
    enabled = true
  ): void {
    const g = this.add.graphics();
    drawPanel(g, x, y, w, h);
    if (!enabled) {
      // Greyed overlay so the disabled state reads at a glance without
      // shrinking the panel or hiding it entirely.
      const grey = this.add.graphics();
      grey.fillStyle(0x000000, 0.45);
      grey.fillRect(x, y, w, h);
    }
    this.add.text(x + 18, y + 14, label, {
      fontFamily: FAMILY_HEADING,
      fontSize: "20px",
      color: enabled ? "#f4d999" : "#7a7165",
      stroke: "#1a0e04",
      strokeThickness: 3
    });
    this.add.text(x + 18, y + 48, desc, {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: enabled ? "#dad3bd" : "#5a5a62",
      wordWrap: { width: w - 36 },
      lineSpacing: 4
    });
    if (enabled) {
      const zone = this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on("pointerdown", onClick);
      // Soft highlight on hover so the player knows the panel itself
      // is the click target, not just a button-within-the-panel.
      const ring = this.add.graphics();
      zone.on("pointerover", () => {
        ring.clear();
        ring.lineStyle(2, 0xffd97a, 0.9);
        ring.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      });
      zone.on("pointerout", () => ring.clear());
    }
  }

  // ---- Wagon: inventory entry-point -----------------------------------------
  // The wagon launches the existing InventoryScene, which expects a
  // battleId so it can resolve the deploying squad and stage per-
  // character assignments. From the camp there's no "next" battle
  // committed, so we resolve it to the next-unlocked-not-completed
  // playable battle. That's almost always the chapter the player is
  // about to do anyway, so pre-distributing here flows naturally
  // into BattlePrepScene's confirm step.
  //
  // If no playable+unlocked+uncompleted battle exists (player has
  // cleared the slice), the wagon shows a small "nothing to prep"
  // floater rather than launching an empty inventory screen.
  private openWagon(completedBattles: string[]): void {
    const next = this.resolveNextBattle(completedBattles);
    if (!next) {
      const t = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 90, "Nothing to prep — the squad's caught up to the road's end.", {
        fontFamily: FAMILY_BODY,
        fontSize: "14px",
        color: "#c9b07a"
      }).setOrigin(0.5);
      this.tweens.add({ targets: t, alpha: 0, duration: 1800, onComplete: () => t.destroy() });
      return;
    }
    sfxClick();
    this.scene.pause();
    this.scene.run("InventoryScene", {
      battleId: next,
      resumeKey: this.scene.key
    });
  }

  // Find the next playable + unlocked + uncompleted battle. Used by
  // the wagon so the player's inventory distribution targets whatever
  // they're about to fight. Walks BATTLES in index order so post-
  // branch battles aren't picked over earlier required ones.
  private resolveNextBattle(completedBattles: string[]): string | null {
    const save = loadSave();
    for (const b of BATTLES) {
      if (!b.playable) continue;
      if (completedBattles.includes(b.id)) continue;
      if (!save.unlockedBattles.includes(b.id)) continue;
      return b.id;
    }
    return null;
  }

  // ---- Subtitle resolver ---------------------------------------------------
  // One line per chapter chunk reflecting where the squad is camped
  // narratively. Cheap state-aware UI that makes the camp feel like
  // it MOVES with the campaign rather than being a static lobby.
  // Future commit makes this drive the backdrop variant too (Thuling
  // field → Para harbor → ship's deck → Grude tavern).
  private resolveCampSubtitle(completedBattles: string[]): string {
    const last = completedBattles[completedBattles.length - 1];
    if (!last) return "Outside the palace gates, before everything begins";
    if (last === "b01_palace_coup") return "A hospital ward outside Para — Amar wakes alone";
    if (last === "b02_farmland" || last === "b03_dawn_bandits" || last === "b04_swamp") {
      return "Lucian's forge yard, Thuling — the squad takes shape";
    }
    if (last === "b05_mountain_ndari" || last === "b06_caravan" || last === "b07_monastery") {
      return "Field camp east of Thuling — Fergus's contracts pile up";
    }
    if (last === "b08_orinhal" || last === "b09_ravine") {
      return "Clearing south of the ford — the squad knows the truth about Fergus now";
    }
    if (last === "b10_leaving_thuling") return "The Para harbor road, an hour before sundown";
    if (last === "b11_cliffs") return "Below decks, Madame Dawn's ship — the long crossing has begun";
    return "Somewhere in the long crossing — destination Grude";
  }

  // ---- Active squad resolver -----------------------------------------------
  // Lifted from RosterScene — same ACTIVE_ROSTER logic, returns the
  // unit ids of who's currently in the squad. Used here only for the
  // "N souls at the fire" status line; future commit uses it to
  // place sprite anchors for each character on the painted camp.
  private activeSquadIds(completedBattles: string[]): string[] {
    const ROSTER: Partial<Record<string, string[]>> = {
      b01_palace_coup:    ["amar"],
      b02_farmland:       ["amar", "lucian", "ning"],
      b03_dawn_bandits:   ["amar", "lucian", "ning", "maya"],
      b04_swamp:          ["amar", "lucian", "ning", "maya", "kian"],
      b05_mountain_ndari: ["amar", "lucian", "ning", "maya", "kian", "leo"],
      b06_caravan:        ["amar", "lucian", "ning", "maya", "kian", "leo"],
      b07_monastery:      ["amar", "lucian", "ning", "maya", "kian", "leo"],
      b08_orinhal:        ["amar", "lucian", "ning", "maya", "kian", "leo"],
      b09_ravine:         ["amar", "lucian", "ning", "maya", "kian", "leo"],
      b10_leaving_thuling: ["amar", "lucian", "ning", "maya", "leo"],
      b11_cliffs:          ["amar", "ning", "maya", "leo"]
    };
    const completed = completedBattles
      .map((id) => BATTLES.find((b) => b.id === id))
      .filter((b): b is typeof BATTLES[number] => b !== undefined)
      .sort((a, b) => b.index - a.index);
    for (const b of completed) {
      const squad = ROSTER[b.id];
      if (squad) return squad;
    }
    return [];
  }

  // ---- Memories Wall placeholder -------------------------------------------
  // Stub modal explaining what the wall will become in a later commit.
  // Visible-but-disabled state on the hotspot tells the player the
  // feature exists and is coming; clicking it surfaces the design
  // intent so playtesters know what it'll do.
  private showMemoriesPlaceholder(): void {
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7)
      .setInteractive();
    const panelW = 540;
    const panelH = 240;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = (GAME_HEIGHT - panelH) / 2;
    const pg = this.add.graphics();
    drawPanel(pg, panelX, panelY, panelW, panelH);
    const title = this.add.text(panelX + panelW / 2, panelY + 24, "Memories Wall", {
      fontFamily: FAMILY_HEADING,
      fontSize: "22px",
      color: "#f4d999"
    }).setOrigin(0.5, 0);
    const body = this.add.text(panelX + 24, panelY + 64,
      "Bonds between characters get forged at specific story beats — saving someone's life, sharing a Ravaged turn, standing back-to-back at a moment that mattered. Each forged bond will live on this wall as a named memory ('The South Ford', 'The Practice Yard') and unlock a combined technique when both characters are adjacent in battle.\n\nNo memories forged yet. Coming in a future update.",
      {
        fontFamily: FAMILY_BODY,
        fontSize: "13px",
        color: "#dad3bd",
        wordWrap: { width: panelW - 48 },
        lineSpacing: 5
      }
    );
    const closeBtn = new Button(this, {
      x: panelX + panelW / 2 - 70,
      y: panelY + panelH - 50,
      w: 140,
      h: 36,
      label: "Close",
      primary: false,
      fontSize: 13,
      onClick: () => {
        dim.destroy();
        pg.destroy();
        title.destroy();
        body.destroy();
        closeBtn.destroy();
      }
    });
  }
}

// Suppress unused-lint for COLORS — kept for future panel styling.
void COLORS;
