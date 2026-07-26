// Top-of-screen initiative bar + its overflow dropdown.
//
// Extracted from BattleScene as part of the file split — behaviour is
// identical to the pre-split refreshInitiativeBar / buildInitiativeCell /
// buildInitiativeExpander / openInitiativeDropdown / closeInitiativeDropdown
// methods; this module just owns them together with the container +
// dropdown lifecycle they manage.
//
// The bar shows the upcoming turn order as compact portrait cells. When
// there are more upcoming turns than fit inline, the last slot becomes a
// "+N more" expander that toggles a dropdown grid of the overflow.
//
// BattleScene constructs one InitiativeBar in create() and calls
// refresh() on every turn transition. The bar container is created in
// the constructor, so BattleScene's end-of-create() pin sweep catches it
// automatically (it's added to the scene display list during create()).
// The dropdown is created on demand and pinned explicitly via the pin
// callback passed in.

import Phaser from "phaser";
import type { Initiative } from "../../combat/Initiative";
import type { Unit } from "../../combat/types";
import { ensureUnitTexture } from "../../art/UnitArt";
import { COLORS, FAMILY_BODY, FAMILY_HEADING } from "../../util/constants";

// Layout — used only by the bar, so it lives here rather than in
// BattleScene's constant block.
export const INITIATIVE_BAR_X = 320;     // px from left; clears the goal label
export const INITIATIVE_BAR_Y = 14;      // matches the top-bar furniture
const INITIATIVE_BOX_W = 64;
const INITIATIVE_BOX_H = 64;
const INITIATIVE_SLOT_PITCH = 70;        // box width + 6px gap
const INITIATIVE_BAR_MAX_BOXES = 10;

// pin() is BattleScene's screen-pinning helper. The dropdown needs it so
// it stays put when the world camera scrolls; threaded in as a callback
// to avoid a circular import on BattleScene.
type PinFn = <T extends Phaser.GameObjects.GameObject>(o: T) => T;

export class InitiativeBar {
  private bar: Phaser.GameObjects.Container;
  private dropdown?: Phaser.GameObjects.Container;
  private dropdownOpen = false;

  constructor(
    private scene: Phaser.Scene,
    private initiative: Initiative,
    private getUnits: () => Unit[],
    private roundText: Phaser.GameObjects.Text,
    private pin: PinFn
  ) {
    this.bar = scene.add.container(INITIATIVE_BAR_X, INITIATIVE_BAR_Y);
  }

  // The bar container — exposed so callers that need to reason about the
  // display list (the pin sweep) can reach it if necessary.
  get container(): Phaser.GameObjects.Container {
    return this.bar;
  }

  refresh(): void {
    this.bar.removeAll(true);
    // Always close the dropdown on a refresh — initiative state has just
    // changed, so a stale snapshot would mislead.
    this.closeDropdown();

    // Pull enough upcoming turns to cover every alive unit, then dedupe by
    // unit id. Initiative.upcoming() cycles virtually into the NEXT round
    // when asked for more turns than there are alive units, which surfaces
    // the same character twice (once for end-of-this-round and once for
    // start-of-next). The bar/dropdown should only ever show distinct
    // characters — no one wants to see "Lucian, Lucian" in the lineup.
    const raw = this.initiative.upcoming(this.getUnits(), 32);
    const seen = new Set<string>();
    const distinct: Unit[] = [];
    for (const u of raw) {
      if (seen.has(u.id)) continue;
      seen.add(u.id);
      distinct.push(u);
    }

    const willOverflow = distinct.length > INITIATIVE_BAR_MAX_BOXES;
    // Reserve the last slot for the expander when overflow exists.
    const visibleCount = willOverflow
      ? INITIATIVE_BAR_MAX_BOXES - 1
      : Math.min(distinct.length, INITIATIVE_BAR_MAX_BOXES);
    const visible = distinct.slice(0, visibleCount);
    // Dropdown shows ONLY what the bar can't fit.
    const overflow = willOverflow ? distinct.slice(visibleCount) : [];

    visible.forEach((u, i) => {
      const x = i * INITIATIVE_SLOT_PITCH;
      const isActive = i === 0;
      const cell = this.buildCell(x, 0, u, isActive);
      this.bar.add(cell);
    });

    if (willOverflow) {
      const x = visibleCount * INITIATIVE_SLOT_PITCH;
      const expander = this.buildExpander(x, 0, overflow.length, overflow);
      this.bar.add(expander);
    }

    this.roundText.setText(`Round ${this.initiative.round}`);
  }

  // Builds a single compact initiative cell: tinted background, faction-
  // mirrored portrait centered on top, and a centered name underneath. No
  // stat line — speed/HP/etc. live in the side panel for the active unit.
  // The active cell (first in the upcoming list) gets a brighter border and
  // text color so the player can spot whose turn is next at a glance.
  private buildCell(
    offsetX: number,
    offsetY: number,
    u: Unit,
    isActive: boolean
  ): Phaser.GameObjects.GameObject[] {
    const bg = this.scene.add.graphics();
    const fill = u.faction === "player" ? 0x1a3554 : 0x4a1a1a;
    bg.fillStyle(fill, 0.85);
    bg.fillRect(offsetX, offsetY, INITIATIVE_BOX_W, INITIATIVE_BOX_H);
    bg.lineStyle(1, isActive ? COLORS.goldBright : COLORS.gold, isActive ? 1 : 0.5);
    bg.strokeRect(offsetX + 0.5, offsetY + 0.5, INITIATIVE_BOX_W - 1, INITIATIVE_BOX_H - 1);

    const tex = ensureUnitTexture(this.scene, u);
    // Portrait stacked on top, centered horizontally. 28×30 leaves room for
    // the name below within the 52px box height.
    const portrait = this.scene.add.image(offsetX + INITIATIVE_BOX_W / 2, offsetY + 4, tex)
      .setOrigin(0.5, 0)
      .setDisplaySize(28, 30);
    if (u.faction === "enemy") portrait.setFlipX(true);

    // Name centered under the portrait. wordWrap to box width minus 4px
    // padding so long names wrap to a 2nd line instead of bleeding past the
    // border. useAdvancedWrap allows mid-word breaks for hypothetical
    // single-token names that exceed the line width.
    //
    // Names longer than 14 chars ("Quartermaster Coyne", "Imperial
    // Captain") wrap to THREE lines at this width, bleeding out of the
    // 64px cell and past the top bar onto the map — show the last word
    // (the surname/role) instead, which always fits in 1-2 lines.
    const displayName = u.name.length > 14
      ? (u.name.split(" ").pop() ?? u.name)
      : u.name;
    const name = this.scene.add.text(offsetX + INITIATIVE_BOX_W / 2, offsetY + 36, displayName, {
      fontFamily: FAMILY_HEADING,
      fontSize: "10px",
      color: isActive ? "#fff7c4" : "#dccfa8",
      align: "center",
      wordWrap: { width: INITIATIVE_BOX_W - 4, useAdvancedWrap: true }
    }).setOrigin(0.5, 0);

    return [bg, portrait, name];
  }

  // Builds the expander cell at the right end of the bar. Visually styled
  // like a regular cell but neutral (gold border, black fill) and labeled
  // "▾ +N" where N is the count of units not shown inline. Clicking opens
  // the dropdown that lists all upcoming units.
  private buildExpander(
    offsetX: number,
    offsetY: number,
    overflowCount: number,
    fullUpcoming: Unit[]
  ): Phaser.GameObjects.GameObject[] {
    const bg = this.scene.add.graphics();
    bg.fillStyle(0x000000, 0.7);
    bg.fillRect(offsetX, offsetY, INITIATIVE_BOX_W, INITIATIVE_BOX_H);
    bg.lineStyle(1, COLORS.gold, 0.6);
    bg.strokeRect(offsetX + 0.5, offsetY + 0.5, INITIATIVE_BOX_W - 1, INITIATIVE_BOX_H - 1);

    const arrow = this.scene.add.text(offsetX + INITIATIVE_BOX_W / 2, offsetY + 8, "▾", {
      fontFamily: FAMILY_HEADING,
      fontSize: "20px",
      color: "#f4d999"
    }).setOrigin(0.5, 0);

    const label = this.scene.add.text(offsetX + INITIATIVE_BOX_W / 2, offsetY + 32, `+${overflowCount} more`, {
      fontFamily: FAMILY_BODY,
      fontSize: "10px",
      color: "#dccfa8",
      align: "center"
    }).setOrigin(0.5, 0);

    // Hit zone covers the full cell. Created as a child of the bar
    // container so its hit testing uses the bar's world position.
    const hit = this.scene.add.zone(offsetX, offsetY, INITIATIVE_BOX_W, INITIATIVE_BOX_H)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on("pointerover", () => bg.clear()
      .fillStyle(0x1a1a1a, 0.85).fillRect(offsetX, offsetY, INITIATIVE_BOX_W, INITIATIVE_BOX_H)
      .lineStyle(1, COLORS.goldBright, 1).strokeRect(offsetX + 0.5, offsetY + 0.5, INITIATIVE_BOX_W - 1, INITIATIVE_BOX_H - 1));
    hit.on("pointerout", () => bg.clear()
      .fillStyle(0x000000, 0.7).fillRect(offsetX, offsetY, INITIATIVE_BOX_W, INITIATIVE_BOX_H)
      .lineStyle(1, COLORS.gold, 0.6).strokeRect(offsetX + 0.5, offsetY + 0.5, INITIATIVE_BOX_W - 1, INITIATIVE_BOX_H - 1));
    hit.on("pointerdown", () => this.toggleDropdown(fullUpcoming));

    return [bg, arrow, label, hit];
  }

  // Toggle / open / close the initiative dropdown panel. The panel is a
  // grid of compact cells (same style as the bar) showing the full upcoming
  // turn order. Lives at depth 30 so it overlays the action button block
  // underneath. Auto-closes whenever refresh() runs.
  private toggleDropdown(upcoming: Unit[]): void {
    if (this.dropdownOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown(upcoming);
    }
  }

  private openDropdown(upcoming: Unit[]): void {
    this.closeDropdown();
    const cols = INITIATIVE_BAR_MAX_BOXES; // grid width matches the bar
    const rows = Math.ceil(upcoming.length / cols);
    const panelPad = 10;
    const panelW = cols * INITIATIVE_SLOT_PITCH - (INITIATIVE_SLOT_PITCH - INITIATIVE_BOX_W) + panelPad * 2;
    const panelH = rows * (INITIATIVE_BOX_H + 8) + panelPad * 2;
    const panelX = INITIATIVE_BAR_X - panelPad;
    const panelY = INITIATIVE_BAR_Y + INITIATIVE_BOX_H + 8;

    this.dropdown = this.pin(this.scene.add.container(panelX, panelY).setDepth(30));

    const bg = this.scene.add.graphics();
    bg.fillStyle(0x05060a, 0.96);
    bg.fillRect(0, 0, panelW, panelH);
    bg.lineStyle(1, COLORS.gold, 0.8);
    bg.strokeRect(0.5, 0.5, panelW - 1, panelH - 1);
    this.dropdown.add(bg);

    upcoming.forEach((u, i) => {
      const r = Math.floor(i / cols);
      const c = i % cols;
      const x = panelPad + c * INITIATIVE_SLOT_PITCH;
      const y = panelPad + r * (INITIATIVE_BOX_H + 8);
      // The dropdown shows OVERFLOW only — the active turn is always in
      // the bar, never here. So no cell in the dropdown gets active styling.
      const cell = this.buildCell(x, y, u, false);
      this.dropdown!.add(cell);
    });

    this.dropdownOpen = true;
  }

  closeDropdown(): void {
    if (this.dropdown) {
      this.dropdown.destroy();
      this.dropdown = undefined;
    }
    this.dropdownOpen = false;
  }
}
