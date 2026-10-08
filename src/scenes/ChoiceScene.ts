import Phaser from "phaser";
import { FAMILY_BODY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { Button } from "../ui/Button";
import { drawPanel } from "../ui/Panel";
import { ensureBackdropForKey } from "../art/BackdropArt";
import { getMusic, MUSIC } from "../audio/Music";
import { sfxCineBoom, sfxCineChime, sfxClick, sfxConfirm, sfxHover } from "../audio/Sfx";
import { ensureDotTexture } from "./battle/Atmosphere";
import { ensureGlow } from "./story/figures";

/** Each road's colour (the same seven the B18 finale raises round Amar). */
const HUE: Record<SevenPath, number> = {
  vengeance: 0xe0584a, restoration: 0xe8c45a, revolution: 0xd8743c, duty: 0x8fb0d8,
  exile: 0xb8c8d8, mercy: 0xf0ece0, forgetting: 0x9ad0c4
};
import { SettingsButton } from "../ui/SettingsButton";
import { loadSave, writeSave, setSevenPath, unlockBattle } from "../util/save";
import type { SevenPath } from "../data/contentIds";

// ─────────────────────────────────────────────────────────────────────────
// ChoiceScene — the Seven Paths divergence ("Seven Names, One Choice").
//
// Reached from StoryScene when post_path_chosen ends with next: "choice"
// (i.e. after Battle 18). The player picks ONE of seven philosophies; the
// pick is persisted to save.flags["seven_paths.choice"] via setSevenPath and
// gates which B19 path opener (and later path climax/final) the campaign
// follows. The OverworldScene path-routing reads the same flag to decide
// which path battles are visible/playable.
//
// The choice is momentous and irreversible within a run, so the flow is two
// steps: select a path card (shows its full description + the character it
// honours), then a separate Commit button confirms. No accidental one-click
// fork.
//
// Each path is anchored to one of the seven names Amar holds at the end of
// B18 — the people (living and dead) whose answer to "what now?" each
// philosophy embodies. The copy is written to make every path feel like a
// real, defensible person rather than a menu option.
// ─────────────────────────────────────────────────────────────────────────

interface PathCard {
  path: SevenPath;
  name: string;        // the philosophy
  honors: string;      // the character whose answer this is
  blurb: string;       // short line on the card
  full: string;        // the detail shown when this card is selected
  openerBattle: string; // the B19 opener this choice points the campaign at
}

// Order mirrors the SevenPath union in contentIds.ts. The honors/blurb copy
// is grounded in who's alive and what they've argued for across B1–B17.
const PATHS: PathCard[] = [
  {
    path: "vengeance",
    name: "Vengeance",
    honors: "for Selene",
    blurb: "Amar kills Archbold himself. No throne and no deals.",
    full: "Selene's answer. Amar doesn't take a crown or rebuild a country. He hunts down Archbold and kills him personally, along with everyone who protects him on the way. It won't bring Lucian back or undo the burning of Thuling, and it isn't meant to. It's the one choice in this war that is only about what was taken from Amar.",
    openerBattle: "b19_path_opener_vengeance"
  },
  {
    path: "restoration",
    name: "Restoration",
    honors: "for Lucian",
    blurb: "Rebuild Anthros as a free state, slowly, one village at a time.",
    full: "Lucian's answer. Instead of revenge or revolution, Amar sets out to repair the damage. He rides for the Anthros border and starts rebuilding the colony, securing one road and feeding one village at a time, under whatever flag the people choose to raise for him. It's the slowest path and the least heroic, and it's the one Lucian would have chosen with him.",
    openerBattle: "b19_path_opener_restoration"
  },
  {
    path: "revolution",
    name: "Revolution",
    honors: "for Maya",
    blurb: "Bring down every throne, in Anthros and Grude. No kings anywhere.",
    full: "Maya's answer. Dawn was right that the system has to fall, but she was willing to sacrifice Anthros to do it. Maya wants to do it honestly: burn the granaries, bring down both crowns, and trust the people to build whatever comes next. It's the most dangerous path and the one that could change the most. Maya has been planning it since before she met Amar.",
    openerBattle: "b19_path_opener_revolution"
  },
  {
    path: "duty",
    name: "Duty",
    honors: "for Khonu",
    blurb: "Take the captaincy. Serve the cause from inside the army.",
    full: "Khonu's answer. Khonu was Amar's father's old sergeant, who taught him that a soldier serves something bigger than himself. Amar puts on a uniform again and accepts a command in Dawn's army, despite what he knows, and tries to be an officer who reads the orders before he signs them. He works to change the system from the inside, and hopes he changes it more than it changes him.",
    openerBattle: "b19_path_opener_duty"
  },
  {
    path: "exile",
    name: "Exile",
    honors: "for Tev",
    blurb: "Ride north alone, leave the war behind, and become nobody.",
    full: "Tev's answer. Tev was the deserter who told Amar, one cold night long ago, that sometimes the bravest thing is to refuse. Amar leaves the squad, the crown and his name behind on the Grude road and rides north alone. The empire will send killers after him. He will bury them and keep going, slowly forgetting the names he carried, until he is just a man on a horse with nobody waiting for him.",
    openerBattle: "b19_path_opener_exile"
  },
  {
    path: "mercy",
    name: "Mercy",
    honors: "for Yul",
    blurb: "Accept every surrender, spare everyone possible, heal the wounded.",
    full: "Yul's answer. Yul was the field surgeon who treated both sides and never asked which side a wounded man fought for. Amar rides under his own banner, offers terms to every garrison that will accept them, turns armouries into hospitals, and refuses to add to the war's dead. It's the hardest path: having power and choosing, again and again, not to use it to kill.",
    openerBattle: "b19_path_opener_mercy"
  },
  {
    path: "forgetting",
    name: "Forgetting",
    honors: "for Sera",
    blurb: "Stop being Amar. Live by the sea under a name no one is hunting.",
    full: "Sera's answer. Sera was the woman at the hospital who told Amar the kindest thing his head wound did was let him leave his old life behind. He rides for the southern coast and stops trying to be anyone. He lives in a fisherman's cottage with a boat, under a name that isn't Amar. The squad will find him, leave a sword by the door, and go. He will spend a long evening looking at it, and decide again to leave it there.",
    openerBattle: "b19_path_opener_forgetting"
  }
];

export class ChoiceScene extends Phaser.Scene {
  private selected: PathCard | null = null;
  private cardHighlights = new Map<SevenPath, Phaser.GameObjects.Graphics>();
  private detailText!: Phaser.GameObjects.Text;
  private commitBtn?: Button;
  // Everything on screen but the sea, for the commit moment to clear.
  private chrome: Phaser.GameObjects.GameObject[] = [];

  constructor() { super("ChoiceScene"); }

  create(): void {
    // Phaser REUSES scene instances, so every field below outlives a
    // scene.start(). `committed` in particular is a one-way latch that
    // guards against double-commits — and it survived into the next
    // visit, making commit() return instantly. A player who reached this
    // screen a second time in one session (a replay, or Another Road
    // after finishing a campaign) could select a path, press Commit, and
    // watch nothing happen, forever. Reset the whole selection state on
    // entry so each visit starts clean.
    this.selected = null;
    this.committed = false;
    this.cardHighlights.clear();
    this.commitBtn = undefined;
    // Open-water backdrop — the squad is on Khione's ship after the B17
    // escape. bg_grude reads as the harbour they're leaving behind.
    // The open water at dusk, the coast that belongs to nobody somewhere
    // past it: a slow drift, motes rising off the sea.
    const sea = this.textures.exists("backdrop:open_sea");
    const bgKey = sea ? "backdrop:open_sea" : ensureBackdropForKey(this, "bg_grude");
    const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setDisplaySize(GAME_WIDTH * 1.06, GAME_HEIGHT * 1.06);
    bg.setAlpha(sea ? 0.5 : 0.32);
    this.tweens.add({ targets: bg, x: GAME_WIDTH / 2 - 24, duration: 18000, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    const v = this.add.graphics();
    v.fillStyle(0x05060a, 0.55);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.add.particles(0, 0, ensureDotTexture(this), {
      x: { min: 0, max: GAME_WIDTH }, y: { min: GAME_HEIGHT * 0.5, max: GAME_HEIGHT },
      speedY: { min: -26, max: -8 }, speedX: { min: -6, max: 6 }, lifespan: { min: 3000, max: 5200 },
      scale: { start: 0.24, end: 0 }, alpha: { start: 0.7, end: 0 }, tint: [0xfff0c0, 0xffd890],
      blendMode: Phaser.BlendModes.ADD, frequency: 140
    });
    const firstChrome = this.children.list.length;

    // Title + framing line.
    this.add.text(GAME_WIDTH / 2, 46, "SEVEN NAMES, ONE CHOICE", {
      fontFamily: FAMILY_HEADING,
      fontSize: "40px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 6,
      shadow: { offsetX: 0, offsetY: 4, color: "#000", blur: 14, fill: true }
    }).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 84,
      "For the first time in his life, nobody is giving Amar orders. Choose the path he takes.",
      { fontFamily: FAMILY_BODY, fontSize: "16px", color: "#c9b07a" }
    ).setOrigin(0.5);

    // ---- Left column: the seven path cards ----
    const colX = 40;
    const colW = 360;
    const cardH = 70;
    const cardGap = 8;
    const firstY = 116;

    PATHS.forEach((p, i) => {
      const y = firstY + i * (cardH + cardGap);
      const cardStart = this.children.list.length;

      // Selection highlight frame (hidden until selected).
      const hl = this.add.graphics();
      hl.lineStyle(2, 0xf2d997, 1);
      hl.strokeRoundedRect(colX - 2, y - 2, colW + 4, cardH + 4, 6);
      hl.setVisible(false);
      this.cardHighlights.set(p.path, hl);

      // Card background panel.
      const pg = this.add.graphics();
      drawPanel(pg, colX, y, colW, cardH);

      // Card text — name + honored character on the first line, blurb under.
      this.add.text(colX + 14, y + 10, `${p.name}`, {
        fontFamily: FAMILY_HEADING, fontSize: "20px", color: "#f4e4b0"
      });
      this.add.text(colX + colW - 14, y + 14, p.honors, {
        fontFamily: FAMILY_BODY, fontSize: "13px", color: "#9aa6b8", fontStyle: "italic"
      }).setOrigin(1, 0);
      this.add.text(colX + 14, y + 38, p.blurb, {
        fontFamily: FAMILY_BODY, fontSize: "13px", color: "#d8cfb6",
        wordWrap: { width: colW - 28 }
      });

      // Transparent interactive zone over the whole card owns hover + click.
      // (A bare Rectangle uses Phaser's rock-solid native hit-test — the same
      // pattern Button uses internally — without drawing a competing steel bg
      // over the panel + text we've already painted.)
      const zone = this.add.rectangle(colX, y, colW, cardH, 0x000000, 0)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone.on("pointerover", () => {
        if (this.selected?.path !== p.path) hl.setVisible(true);
        sfxHover();
      });
      zone.on("pointerout", () => {
        // Keep the frame lit only for the committed selection.
        hl.setVisible(this.selected?.path === p.path);
      });
      // Both events: pointerdown so the pick registers immediately, and
      // pointerup so a press that began off-card still lands. selectPath
      // is idempotent, so the pair never double-applies.
      zone.on("pointerdown", () => this.selectPath(p));
      zone.on("pointerup", () => this.selectPath(p));
      // The road's colour down the card's edge.
      this.add.rectangle(colX, y, 4, cardH, HUE[p.path], 0.95).setOrigin(0, 0);
      // The cards come in one at a time, a chime each.
      for (const o of this.children.list.slice(cardStart)) {
        const g = o as unknown as Phaser.GameObjects.Components.Transform & Phaser.GameObjects.Components.Alpha;
        const hl0 = o === hl;
        const x = g.x;
        g.x = x - 420;
        if (!hl0) g.setAlpha(0);
        this.tweens.add({ targets: o, ...(hl0 ? { x } : { x, alpha: 1 }), duration: 420, delay: 250 + i * 110, ease: "Cubic.easeOut" });
      }
      this.time.delayedCall(250 + i * 110, () => sfxCineChime(0.9 + i * 0.1));
    });

    // ---- Right column: detail panel for the selected path ----
    const detX = 430;
    const detW = GAME_WIDTH - detX - 40;
    const detY = 116;
    const detH = 420;
    const dpg = this.add.graphics();
    drawPanel(dpg, detX, detY, detW, detH);

    this.detailText = this.add.text(detX + 24, detY + 24,
      "Select a path on the left.\n\nEach path belongs to one of the seven people Amar remembers. It is the answer that person would give to the question he has asked since he woke in a hospital bed in Thuling: what now?\n\nThe choice is final.",
      {
        fontFamily: FAMILY_BODY, fontSize: "17px", color: "#e6e0d0",
        wordWrap: { width: detW - 48 }, lineSpacing: 7
      }
    );

    // ---- Commit button (disabled until a path is selected) ----
    // Wide enough for the longest label, "Commit to Restoration ▸".
    this.commitBtn = new Button(this, {
      x: detX + detW - 320, y: GAME_HEIGHT - 64, w: 320, h: 46,
      label: "Select a path first", primary: true, fontSize: 18,
      enabled: false,
      onClick: () => this.commit()
    });

    this.chrome = this.children.list.slice(firstChrome);
    getMusic(this).play(MUSIC.emotional, { fadeMs: 1000 });
    this.cameras.main.fadeIn(600, 0, 0, 0);
    new SettingsButton(this, GAME_WIDTH - 32, 32);
  }

  private selectPath(p: PathCard): void {
    sfxHover();
    this.selected = p;
    // Update highlight frames.
    for (const [path, hl] of this.cardHighlights) hl.setVisible(path === p.path);
    // Fill the detail panel.
    this.detailText.setText(
      `${p.name.toUpperCase()}  —  ${p.honors}\n\n${p.full}\n\nCommit to this path?`
    );
    this.commitBtn?.setLabel(`Commit to ${p.name} ▸`);
    this.commitBtn?.setEnabled(true);
  }

  // Guards against committing twice (double-click on the Commit button) and
  // against the fade-complete event + fallback timer both firing the route.
  private committed = false;

  private commit(): void {
    if (!this.selected || this.committed) return;
    this.committed = true;
    const choice = this.selected;
    sfxConfirm();
    sfxClick();

    // Persist the choice + unlock the chosen path's opener so the campaign
    // routing (OverworldScene) can surface it. One writeSave captures both.
    let save = loadSave();
    save = setSevenPath(save, choice.path);
    save = unlockBattle(save, choice.openerBattle);
    writeSave({ ...save, nextChapter: choice.openerBattle });

    // Route onward — back to camp with the chosen path's opener as the next
    // chapter ("Start Next Chapter" opens its prep), as every chapter now
    // begins between story and battle. The pick has been persisted and the
    // opener unlocked above, so the campaign fork happens the moment the
    // fade lands.
    //
    // Idempotent transition: this is an IRREVERSIBLE choice, so getting the
    // player off this screen is non-negotiable. We fire on whichever happens
    // first — the fade-complete event OR a fallback timer slightly longer
    // than the fade — and a `routed` latch makes the second one a no-op. The
    // fallback exists because a camera fade can, in rare states, fail to emit
    // camerafadeoutcomplete; without it a stuck fade would strand the player
    // on the choice screen forever with no way forward.
    let routed = false;
    const go = (): void => {
      if (routed) return;
      routed = true;
      this.scene.start("CampScene", { nextChapter: choice.openerBattle });
    };
    const leave = (): void => {
      this.cameras.main.fadeOut(600, 0, 0, 0);
      this.cameras.main.once("camerafadeoutcomplete", go);
      this.time.delayedCall(750, go);
    };
    // The chosen name has its moment first; the latch and this last timer
    // still guarantee the player leaves even if the moment never ends.
    this.choiceMoment(choice, leave);
    this.time.delayedCall(4500, go);
  }

  /** Everything else goes; the chosen road's name blooms in its colour. */
  private choiceMoment(choice: PathCard, then: () => void): void {
    const hue = HUE[choice.path];
    const css = `#${hue.toString(16).padStart(6, "0")}`;
    this.tweens.add({ targets: this.chrome, alpha: 0, duration: 450 });
    const cx = GAME_WIDTH / 2, cy = GAME_HEIGHT / 2 - 10;
    const glow = this.add.image(cx, cy, ensureGlow(this)).setTint(hue).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2).setAlpha(0);
    const ring = this.add.circle(cx, cy, 60).setStrokeStyle(3, hue, 0.9).setAlpha(0);
    const name = this.add.text(cx, cy, choice.name.toUpperCase(), {
      fontFamily: FAMILY_HEADING, fontSize: "76px", color: css, stroke: "#05040a", strokeThickness: 8,
      shadow: { offsetX: 0, offsetY: 0, color: css, blur: 24, fill: true }
    }).setOrigin(0.5).setAlpha(0).setScale(0.6).setLetterSpacing(10);
    const honors = this.add.text(cx, cy + 66, choice.honors, {
      fontFamily: FAMILY_BODY, fontSize: "22px", color: "#e6dcc4", fontStyle: "italic"
    }).setOrigin(0.5).setAlpha(0);
    this.time.delayedCall(350, () => {
      sfxCineBoom();
      sfxCineChime(1 + PATHS.indexOf(choice) * 0.1);
      this.tweens.add({ targets: glow, alpha: 0.85, scale: 3.2, duration: 900, ease: "Cubic.easeOut" });
      this.tweens.add({ targets: ring, alpha: 1, duration: 120 });
      this.tweens.add({ targets: ring, scale: 9, alpha: 0, duration: 1300, delay: 120, ease: "Sine.easeOut" });
      this.tweens.add({ targets: name, alpha: 1, scale: 1, duration: 700, ease: "Back.easeOut" });
      this.tweens.add({ targets: honors, alpha: 1, duration: 600, delay: 400 });
    });
    this.time.delayedCall(2300, then);
  }
}
