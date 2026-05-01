import Phaser from "phaser";
import { COLORS, FAMILY_BODY, FAMILY_HEADING, FAMILY_MONO, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { drawPanel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { sfxClick, sfxConfirm, sfxCancel } from "../audio/Sfx";
import { battleById } from "../data/battles";
import { ITEM_CATALOG, createItem } from "../combat/items";
import type { Item, ItemKind, UnitDef } from "../combat/types";
import { MAX_INVENTORY } from "../combat/types";
import { TRADE_RECIPES } from "../data/trades";
import {
  clearAssignedInventory,
  getAssignedInventory,
  getSquadInventory,
  loadSave,
  setAssignedInventory,
  setSquadInventory,
  squadInventoryCounts,
  writeSave
} from "../util/save";
import type { BattleId } from "../data/contentIds";

// InventoryScene — modal overlay launched from BattlePrepScene's
// "Inventory" button. Three-panel layout: squad pool on the left,
// per-character bags in the middle, trading post on the right.
//
// Interaction model:
//   * Click a character row to "select" them (gold ring around row).
//   * Click an item in the squad pool → adds one to the selected
//     character's bag (if they have a slot free).
//   * Click an item in a character's bag → removes it back to the pool.
//   * Click a trade row → executes the trade if the cost is available
//     in the squad pool.
//
// The scene pauses BattlePrepScene; closes via Done / ESC and resumes
// it. All inventory mutations go through the save layer so the current
// distribution survives a browser refresh between BattlePrep and
// BattleScene.

interface InventoryArgs {
  battleId: BattleId;
  resumeKey: string;
}

const PANEL_PAD = 16;
const POOL_X = 24;
const POOL_W = 320;
const BAGS_X = POOL_X + POOL_W + 16;
const BAGS_W = 540;
const TRADE_X = BAGS_X + BAGS_W + 16;
const TRADE_W = GAME_WIDTH - TRADE_X - 24;
const TOP_Y = 80;
const PANEL_H = GAME_HEIGHT - TOP_Y - 90;

export class InventoryScene extends Phaser.Scene {
  private battleId!: BattleId;
  private resumeKey!: string;
  private players: UnitDef[] = [];
  private selectedCharacter = 0;
  // Containers we tear down + rebuild after every mutation. Cheap enough
  // for 6-character squads and 6 item kinds — no need for fine-grained
  // diffing.
  private poolContainer!: Phaser.GameObjects.Container;
  private bagsContainer!: Phaser.GameObjects.Container;
  private tradesContainer!: Phaser.GameObjects.Container;

  constructor() { super("InventoryScene"); }

  init(data: InventoryArgs): void {
    this.battleId = data.battleId;
    this.resumeKey = data.resumeKey;
    this.selectedCharacter = 0;
  }

  create(): void {
    // Heavy dim so the underlying BattlePrepScene reads as background.
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.78);
    dim.setInteractive();
    void dim;

    // Title bar
    this.add.text(GAME_WIDTH / 2, 30, "Squad Inventory", {
      fontFamily: FAMILY_HEADING,
      fontSize: "26px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 4
    }).setOrigin(0.5, 0);
    this.add.text(GAME_WIDTH / 2, 60, "Distribute items to your squad. Trade what you don't need.", {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: "#c9b07a",
      fontStyle: "italic"
    }).setOrigin(0.5, 0);

    // Resolve the deploying squad from the battle node — the same list
    // BattlePrepScene shows in its roster panel, used here so the player
    // assigns to characters they're actually about to deploy.
    const node = battleById(this.battleId);
    this.players = node?.buildPlayers ? node.buildPlayers() : [];

    // Three panels — drawn once, contents rebuilt per mutation.
    this.drawPanelChrome();
    this.poolContainer = this.add.container(0, 0);
    this.bagsContainer = this.add.container(0, 0);
    this.tradesContainer = this.add.container(0, 0);

    // Footer buttons
    new Button(this, {
      x: GAME_WIDTH / 2 - 100,
      y: GAME_HEIGHT - 56,
      w: 200,
      h: 40,
      label: "Done ▸",
      primary: true,
      fontSize: 16,
      onClick: () => this.close()
    });
    this.input.keyboard?.on("keydown-ESC", () => this.close());

    this.rebuild();
    this.cameras.main.fadeIn(220, 0, 0, 0);
  }

  // ---- Layout chrome (fixed) ------------------------------------------------

  private drawPanelChrome(): void {
    const g = this.add.graphics();
    drawPanel(g, POOL_X, TOP_Y, POOL_W, PANEL_H);
    drawPanel(g, BAGS_X, TOP_Y, BAGS_W, PANEL_H);
    drawPanel(g, TRADE_X, TOP_Y, TRADE_W, PANEL_H);

    this.add.text(POOL_X + PANEL_PAD, TOP_Y + 14, "Squad Pool", {
      fontFamily: FAMILY_HEADING, fontSize: "16px", color: "#f4d999"
    });
    this.add.text(BAGS_X + PANEL_PAD, TOP_Y + 14, "Distribute to Squad", {
      fontFamily: FAMILY_HEADING, fontSize: "16px", color: "#f4d999"
    });
    this.add.text(TRADE_X + PANEL_PAD, TOP_Y + 14, "Trading Post", {
      fontFamily: FAMILY_HEADING, fontSize: "16px", color: "#f4d999"
    });
  }

  // ---- Rebuild on every mutation -------------------------------------------

  private rebuild(): void {
    this.poolContainer.removeAll(true);
    this.bagsContainer.removeAll(true);
    this.tradesContainer.removeAll(true);
    this.renderPool();
    this.renderBags();
    this.renderTrades();
  }

  // Squad pool — one row per item kind that has a non-zero count, plus
  // a quick legend at the bottom for kinds the squad doesn't currently
  // hold (so the player knows they exist and can be traded for).
  private renderPool(): void {
    const save = loadSave();
    const counts = squadInventoryCounts(save);
    const kinds = Object.keys(ITEM_CATALOG) as ItemKind[];
    const present = kinds.filter((k) => (counts[k] ?? 0) > 0);

    let py = TOP_Y + 48;
    if (present.length === 0) {
      const empty = this.add.text(POOL_X + PANEL_PAD, py, "Pool is empty.\nVisit the Trading Post or finish a battle to gain items.", {
        fontFamily: FAMILY_BODY, fontSize: "13px", color: "#7a7165",
        wordWrap: { width: POOL_W - PANEL_PAD * 2 }
      });
      this.poolContainer.add(empty);
    } else {
      for (const k of present) {
        const meta = ITEM_CATALOG[k];
        const count = counts[k]!;
        const row = this.add.container(POOL_X + PANEL_PAD, py);
        const bg = this.add.rectangle(0, 0, POOL_W - PANEL_PAD * 2, 44, 0x000000, 0.0)
          .setOrigin(0, 0)
          .setInteractive();
        const glyph = this.add.text(8, 22, meta.glyph, {
          fontFamily: FAMILY_BODY, fontSize: "20px", color: "#f4d999"
        }).setOrigin(0, 0.5);
        const name = this.add.text(40, 8, meta.name, {
          fontFamily: FAMILY_HEADING, fontSize: "14px", color: "#f8f0d8"
        });
        const desc = this.add.text(40, 25, meta.description, {
          fontFamily: FAMILY_BODY, fontSize: "11px", color: "#9da7b8",
          wordWrap: { width: POOL_W - PANEL_PAD * 2 - 60 }
        });
        const cnt = this.add.text(POOL_W - PANEL_PAD * 2 - 8, 22, `×${count}`, {
          fontFamily: FAMILY_MONO, fontSize: "16px", color: "#c9b07a"
        }).setOrigin(1, 0.5);
        bg.on("pointerover", () => bg.setFillStyle(0xc9b07a, 0.1));
        bg.on("pointerout", () => bg.setFillStyle(0x000000, 0.0));
        bg.on("pointerdown", () => this.assignToSelected(k));
        row.add([bg, glyph, name, desc, cnt]);
        this.poolContainer.add(row);
        py += 50;
      }
    }

    // Helper hint at the bottom of the pool panel
    const hint = this.add.text(POOL_X + PANEL_PAD, TOP_Y + PANEL_H - 36,
      "Click an item to assign it to the selected character.", {
        fontFamily: FAMILY_BODY, fontSize: "11px", color: "#7a7165",
        fontStyle: "italic",
        wordWrap: { width: POOL_W - PANEL_PAD * 2 }
      });
    this.poolContainer.add(hint);
  }

  // Per-character bags — one row per deploying character with their
  // assigned slots laid out horizontally. Click a slot to remove the
  // item back to the pool. The selected character has a gold-ring
  // background to indicate "pool clicks land here."
  private renderBags(): void {
    const save = loadSave();
    let py = TOP_Y + 48;
    const rowH = 64;
    const bagX0 = BAGS_X + PANEL_PAD;
    const bagW = BAGS_W - PANEL_PAD * 2;

    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i]!;
      const isSelected = i === this.selectedCharacter;
      const assigned = getAssignedInventory(save, p.id);

      const row = this.add.container(bagX0, py);
      // Row background — added FIRST so the slot rectangles below sit
      // on top of it. Without this, the row bg's pointerdown listener
      // intercepts clicks meant for the slots, breaking the
      // click-slot-to-unassign affordance.
      const bg = this.add.rectangle(0, 0, bagW, rowH - 4, isSelected ? 0xc9b07a : 0x000000, isSelected ? 0.18 : 0.0)
        .setOrigin(0, 0)
        .setStrokeStyle(isSelected ? 2 : 0, 0xf4d999, isSelected ? 0.9 : 0)
        .setInteractive();
      bg.on("pointerdown", () => {
        sfxClick();
        this.selectedCharacter = i;
        this.rebuild();
      });
      row.add(bg);

      // Name + class label — drawn over the row bg.
      const name = this.add.text(12, 8, p.name, {
        fontFamily: FAMILY_HEADING, fontSize: "14px", color: "#f8f0d8"
      });
      const slotsCount = `${assigned.length}/${MAX_INVENTORY}`;
      const slotInfo = this.add.text(12, 28, `${slotsCount} carried`, {
        fontFamily: FAMILY_MONO, fontSize: "11px", color: "#9da7b8"
      });
      // Hint that filled slots are clickable — sits between the name
      // block and the slots, only shown when the row has at least one
      // assigned item the player could remove.
      if (assigned.length > 0) {
        const hint = this.add.text(12, 44, "(click an item to return it to the pool)", {
          fontFamily: FAMILY_BODY, fontSize: "10px", color: "#7a7165",
          fontStyle: "italic"
        });
        row.add(hint);
      }
      row.add([name, slotInfo]);

      // Item slots — fixed grid of 5, populated left-to-right with
      // assigned items, dotted-empty for unfilled slots. Filled slots
      // have a pointerdown handler that unassigns the item back to
      // the pool. Slot input is registered AFTER the row bg, so
      // Phaser's input pipeline routes clicks on a slot to the slot
      // handler (topmost interactive object wins).
      const slotW = 36;
      const slotGap = 6;
      const slotsX0 = bagW - (MAX_INVENTORY * (slotW + slotGap)) - 4;
      for (let s = 0; s < MAX_INVENTORY; s++) {
        const sx = slotsX0 + s * (slotW + slotGap);
        const sy = (rowH - 4 - slotW) / 2;
        const item = assigned[s];
        if (item) {
          const slotBg = this.add.rectangle(sx, sy, slotW, slotW, 0x1a0e04, 0.85)
            .setOrigin(0, 0)
            .setStrokeStyle(1, 0xc9b07a, 0.7)
            .setInteractive();
          const meta = ITEM_CATALOG[item.kind];
          const glyph = this.add.text(sx + slotW / 2, sy + slotW / 2, meta.glyph, {
            fontFamily: FAMILY_BODY, fontSize: "20px", color: "#f4d999"
          }).setOrigin(0.5);
          // stopPropagation prevents the click from also firing the
          // row bg's character-select handler — without this, clicking
          // a slot to unassign would also reselect the character (a
          // no-op visually but flicker-prone, and confusing if a
          // future enhancement gives the row click a side effect).
          slotBg.on("pointerdown", (_p: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
            event.stopPropagation();
            this.unassignItem(p.id, item.id);
          });
          slotBg.on("pointerover", () => slotBg.setStrokeStyle(2, 0xff8a8a, 0.9));
          slotBg.on("pointerout", () => slotBg.setStrokeStyle(1, 0xc9b07a, 0.7));
          row.add([slotBg, glyph]);
        } else {
          const slotBg = this.add.rectangle(sx, sy, slotW, slotW, 0x000000, 0.4)
            .setOrigin(0, 0)
            .setStrokeStyle(1, 0x7a7165, 0.4);
          row.add(slotBg);
        }
      }

      this.bagsContainer.add(row);
      py += rowH;
    }
  }

  // Trading Post — list every recipe whose cost the squad currently
  // has, plus a greyed list of recipes the squad CAN'T afford so the
  // player can plan ahead. Clicking an affordable trade executes it.
  private renderTrades(): void {
    const save = loadSave();
    const counts = squadInventoryCounts(save);
    const tradeX0 = TRADE_X + PANEL_PAD;
    const tradeW = TRADE_W - PANEL_PAD * 2;
    let py = TOP_Y + 48;

    const canAfford = (recipe: typeof TRADE_RECIPES[number]): boolean => {
      for (const c of recipe.costs) {
        if ((counts[c.kind] ?? 0) < c.count) return false;
      }
      return true;
    };

    for (const recipe of TRADE_RECIPES) {
      const ok = canAfford(recipe);
      const row = this.add.container(tradeX0, py);
      const bg = this.add.rectangle(0, 0, tradeW, 38, ok ? 0xc9b07a : 0x000000, ok ? 0.08 : 0.0)
        .setOrigin(0, 0)
        .setStrokeStyle(1, ok ? 0xc9b07a : 0x7a7165, ok ? 0.5 : 0.25);
      const label = this.add.text(8, 19, recipe.label, {
        fontFamily: FAMILY_BODY, fontSize: "12px",
        color: ok ? "#f8f0d8" : "#7a7165"
      }).setOrigin(0, 0.5);
      if (ok) {
        bg.setInteractive();
        bg.on("pointerover", () => bg.setFillStyle(0xc9b07a, 0.18));
        bg.on("pointerout", () => bg.setFillStyle(0xc9b07a, 0.08));
        bg.on("pointerdown", () => this.executeTrade(recipe.id));
      }
      row.add([bg, label]);
      this.tradesContainer.add(row);
      py += 44;
    }

    const hint = this.add.text(tradeX0, TOP_Y + PANEL_H - 36,
      "Trades operate on the squad pool. Greyed = can't afford.", {
        fontFamily: FAMILY_BODY, fontSize: "11px", color: "#7a7165",
        fontStyle: "italic", wordWrap: { width: tradeW }
      });
    this.tradesContainer.add(hint);
  }

  // ---- Mutations ------------------------------------------------------------

  private assignToSelected(kind: ItemKind): void {
    const save = loadSave();
    const player = this.players[this.selectedCharacter];
    if (!player) return;
    const assigned = getAssignedInventory(save, player.id);
    if (assigned.length >= MAX_INVENTORY) {
      sfxCancel();
      return;
    }
    const pool = getSquadInventory(save);
    const idx = pool.findIndex((it) => it.kind === kind);
    if (idx < 0) {
      sfxCancel();
      return;
    }
    const [picked] = pool.splice(idx, 1);
    if (!picked) return;
    sfxClick();
    let next = setSquadInventory(save, pool);
    next = setAssignedInventory(next, player.id, [...assigned, picked]);
    writeSave(next);
    this.rebuild();
  }

  private unassignItem(characterId: string, itemId: string): void {
    const save = loadSave();
    const assigned = getAssignedInventory(save, characterId);
    const idx = assigned.findIndex((it) => it.id === itemId);
    if (idx < 0) return;
    const [picked] = assigned.splice(idx, 1);
    if (!picked) return;
    sfxClick();
    let next = setAssignedInventory(save, characterId, assigned);
    const pool = getSquadInventory(next);
    pool.push(picked);
    next = setSquadInventory(next, pool);
    writeSave(next);
    this.rebuild();
  }

  private executeTrade(recipeId: string): void {
    const recipe = TRADE_RECIPES.find((r) => r.id === recipeId);
    if (!recipe) return;
    const save = loadSave();
    const pool = getSquadInventory(save);
    // Burn down the cost first — collect indices to remove, then splice
    // in reverse to keep earlier indices valid.
    const toRemove: number[] = [];
    for (const c of recipe.costs) {
      let need = c.count;
      for (let i = 0; i < pool.length && need > 0; i++) {
        if (toRemove.includes(i)) continue;
        if (pool[i]!.kind === c.kind) {
          toRemove.push(i);
          need--;
        }
      }
      if (need > 0) {
        sfxCancel();
        return; // not enough — UI shouldn't have offered the trade, but bail safely
      }
    }
    toRemove.sort((a, b) => b - a).forEach((i) => pool.splice(i, 1));
    // Mint the yields
    for (const y of recipe.yields) {
      for (let i = 0; i < y.count; i++) pool.push(createItem(y.kind));
    }
    sfxConfirm();
    const next = setSquadInventory(save, pool);
    writeSave(next);
    this.rebuild();
  }

  // ---- Close ----------------------------------------------------------------

  private close(): void {
    sfxClick();
    if (this.resumeKey) this.scene.resume(this.resumeKey);
    this.scene.stop();
  }
}

// ---- Post-battle reconciliation -------------------------------------------
//
// Called from BattleScene.checkEnd after the player's outcome resolves
// (and after writeSave for character progression). Walks every player
// unit's CURRENT in-battle inventory and folds it back into the squad
// pool — items consumed during battle are simply absent from the live
// inventory so they don't return; surviving items rejoin the pool. Then
// clears the per-character assignedInventory slot so the next battle
// starts from a clean distribution slate.
//
// We keep this here so the inventory ownership story stays in one
// module: BattleScene only knows "call returnInventoriesToPool(units)"
// and the save layer handles the rest.

export const returnInventoriesToPool = (units: { id: string; faction: string; state: { inventory: Item[] } }[]): void => {
  let save = loadSave();
  const pool = getSquadInventory(save);
  for (const u of units) {
    if (u.faction !== "player") continue;
    for (const it of u.state.inventory) {
      pool.push(it);
    }
  }
  save = setSquadInventory(save, pool);
  save = clearAssignedInventory(save);
  writeSave(save);
};

// Suppress unused-lint COLORS — kept for future panel styling.
void COLORS;
