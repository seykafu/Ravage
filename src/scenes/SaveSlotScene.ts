import Phaser from "phaser";
import { Button } from "../ui/Button";
import { drawPanel } from "../ui/Panel";
import { FAMILY_BODY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { ensureBackdropTexture, BACKDROPS } from "../art/BackdropArt";
import {
  activateSlot,
  deleteSlot,
  fetchSlotPreviews,
  resetActiveSave,
  type SlotIndex,
  type SlotPreview
} from "../util/save";
import { battleById } from "../data/battles";
import { isAuthEnabled, currentUser, signOut } from "../auth/session";
import { sfxClick, sfxConfirm, sfxCancel } from "../audio/Sfx";
import { trackNewGameStarted } from "../util/analytics";

export class SaveSlotScene extends Phaser.Scene {
  private previews: SlotPreview[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private accountText!: Phaser.GameObjects.Text;

  constructor() { super("SaveSlotScene"); }

  async create(): Promise<void> {
    const bgKey = ensureBackdropTexture(this, "bg_slot", BACKDROPS.thuling);
    const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    bg.setAlpha(0.55);

    const v = this.add.graphics();
    v.fillGradientStyle(0x000000, 0x000000, 0x000000, 0x000000, 0.7, 0.7, 0.92, 0.92);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    this.add.text(GAME_WIDTH / 2, 80, "Save Slots", {
      fontFamily: FAMILY_HEADING,
      fontSize: "44px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(GAME_WIDTH / 2, 124, "Choose a slot. Up to three concurrent stories.", {
      fontFamily: FAMILY_BODY,
      fontSize: "16px",
      color: "#c9b07a"
    }).setOrigin(0.5);

    this.statusText = this.add.text(GAME_WIDTH / 2, 160, "Loading…", {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: "#7a7165"
    }).setOrigin(0.5);

    this.accountText = this.add.text(GAME_WIDTH - 24, 24, "", {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: "#a89a78"
    }).setOrigin(1, 0);

    // Back to title
    new Button(this, {
      x: 24, y: GAME_HEIGHT - 56, w: 100, h: 36,
      label: "‹ Title", primary: false, fontSize: 13,
      onClick: () => {
        sfxCancel();
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("TitleScene"));
      }
    });

    // Sign-out button (only if authenticated)
    if (isAuthEnabled()) {
      const u = await currentUser();
      if (u) {
        this.accountText.setText(`Signed in: ${u.email ?? "(unknown)"}`);
        new Button(this, {
          x: GAME_WIDTH - 144,
          y: GAME_HEIGHT - 56,
          w: 120,
          h: 36,
          label: "Sign Out",
          primary: false,
          fontSize: 13,
          onClick: async () => {
            sfxClick();
            await signOut();
            this.scene.start("AuthScene");
          }
        });
      } else {
        this.accountText.setText("Offline — saves on this device only");
      }
    } else {
      this.accountText.setText("Offline — saves on this device only");
    }

    this.previews = await fetchSlotPreviews();
    this.statusText.setText("");
    this.renderSlots();
    this.cameras.main.fadeIn(400, 0, 0, 0);
  }

  private renderSlots(): void {
    // Three slot cards across the middle of the screen.
    const cardW = 360;
    const cardH = 320;
    const gap = 30;
    const totalW = cardW * 3 + gap * 2;
    const startX = (GAME_WIDTH - totalW) / 2;
    const cardY = 200;

    for (const p of this.previews) {
      const i = p.slot - 1;
      const x = startX + i * (cardW + gap);
      this.renderSlotCard(p, x, cardY, cardW, cardH);
    }
  }

  private renderSlotCard(p: SlotPreview, x: number, y: number, w: number, h: number): void {
    const g = this.add.graphics();
    drawPanel(g, x, y, w, h);

    this.add.text(x + w / 2, y + 24, `Slot ${p.slot}`, {
      fontFamily: FAMILY_HEADING,
      fontSize: "26px",
      color: "#f4d999"
    }).setOrigin(0.5);

    if (p.exists) {
      const node = p.lastBattleId ? battleById(p.lastBattleId) : null;
      const lastLabel = node ? `Last: Battle ${node.index} — ${node.subtitle}` : "In progress";
      this.add.text(x + 24, y + 76, lastLabel, {
        fontFamily: FAMILY_BODY,
        fontSize: "15px",
        color: "#e6e0d0",
        wordWrap: { width: w - 48 }
      });
      this.add.text(x + 24, y + 134, `Battles completed: ${p.completedCount}`, {
        fontFamily: FAMILY_BODY,
        fontSize: "14px",
        color: "#c9b07a"
      });
      if (p.updatedAt) {
        const when = formatRelative(p.updatedAt);
        this.add.text(x + 24, y + 158, `Saved ${when}`, {
          fontFamily: FAMILY_BODY,
          fontSize: "12px",
          color: "#7a7165"
        });
      }

      new Button(this, {
        x: x + 24, y: y + h - 100, w: w - 48, h: 40,
        label: "Continue", primary: true, fontSize: 16,
        onClick: () => this.continueSlot(p.slot)
      });
      new Button(this, {
        x: x + 24, y: y + h - 52, w: w - 48, h: 36,
        label: "Delete", primary: false, fontSize: 13,
        onClick: () => this.confirmDelete(p.slot)
      });
    } else {
      this.add.text(x + w / 2, y + h / 2 - 20, "Empty", {
        fontFamily: FAMILY_BODY, fontSize: "18px", color: "#7a7165",
        fontStyle: "italic"
      }).setOrigin(0.5);

      new Button(this, {
        x: x + 24, y: y + h - 76, w: w - 48, h: 44,
        label: "New Story", primary: true, fontSize: 16,
        onClick: () => this.startNew(p.slot)
      });
    }
  }

  private async continueSlot(slot: SlotIndex): Promise<void> {
    sfxConfirm();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    await activateSlot(slot);
    // Route into the camp instead of straight to the world map. The
    // camp is the new home base — the world map is one click away
    // via the "Where to Next?" hotspot. See CampScene.
    this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("CampScene"));
  }

  private async startNew(slot: SlotIndex): Promise<void> {
    sfxConfirm();
    this.cameras.main.fadeOut(300, 0, 0, 0);
    await activateSlot(slot);
    resetActiveSave();
    // Analytics — single event per New Game intent. Bookends the funnel
    // (vs. battle_completed for the final battle).
    trackNewGameStarted();
    this.cameras.main.once("camerafadeoutcomplete", () =>
      this.scene.start("StoryScene", { arcId: "cold_open_dawn" })
    );
  }

  private async confirmDelete(slot: SlotIndex): Promise<void> {
    sfxClick();
    // Cheap confirm via window.confirm — keeps this scene compact.
    const ok = window.confirm(`Permanently delete Slot ${slot}? This cannot be undone.`);
    if (!ok) return;
    await deleteSlot(slot);
    // Refresh the scene to show the empty slot.
    this.scene.restart();
  }
}

const formatRelative = (iso: string): string => {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "recently";
  const diff = Date.now() - t;
  const s = Math.round(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  if (d < 30) return `${d} day${d === 1 ? "" : "s"} ago`;
  return new Date(t).toLocaleDateString();
};
