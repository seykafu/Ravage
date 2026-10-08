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
    blurb: "Archbold dies by your hand. No throne, no terms. A debt.",
    full: "Selene's answer. You do not take a crown or rebuild a country. You take a life: Archbold's, personally, and everyone who shielded him on the way to it. It will not bring Lucian back or unburn Thuling. It is not supposed to. It is the one thing in this whole war that is honestly, only about what was taken from you.",
    openerBattle: "b19_path_opener_vengeance"
  },
  {
    path: "restoration",
    name: "Restoration",
    honors: "for Lucian",
    blurb: "Rebuild Anthros as a free state. The slow, unglamorous work.",
    full: "Lucian's answer. Not revenge and not revolution. Repair. You ride for the Anthros border and start putting the colony back together one held road, one fed village at a time, under no flag but the one people raise for you. It is the longest road and the least heroic, and it is the only one Lucian would have walked beside you.",
    openerBattle: "b19_path_opener_restoration"
  },
  {
    path: "revolution",
    name: "Revolution",
    honors: "for Maya",
    blurb: "Burn every throne. Anthros, Grude, no kings at all, anywhere.",
    full: "Maya's answer. Dawn was right that the system has to fall. She just wanted to spend Anthros to do it. Maya wants to do it without the lie: burn the granaries, break the crowns, both of them, and trust the people to build what comes after. It is the most dangerous path and the one with the widest horizon. Maya has been planning it since before she met you.",
    openerBattle: "b19_path_opener_revolution"
  },
  {
    path: "duty",
    name: "Duty",
    honors: "for Khonu",
    blurb: "Take the captaincy. Serve the cause from inside the army.",
    full: "Khonu's answer: your father's old sergeant, the one who taught you a soldier serves something larger than himself. You put on the colours again, accept a command in Dawn's army despite what you know, and try to be the officer who reads the list before he signs it. Working the system from the inside, paying its costs honestly, hoping you can bend it more than it bends you.",
    openerBattle: "b19_path_opener_duty"
  },
  {
    path: "exile",
    name: "Exile",
    honors: "for Tev",
    blurb: "Ride north alone. Let the war have its heir back as nobody.",
    full: "Tev's answer: the deserter who told you, on a cold night long ago, that the bravest thing is sometimes to simply refuse. You leave the squad, the crown, and the name on the Grude road and ride for the cold country alone. They will send killers after you. You will bury them and ride on, and the names you carried will lose their syllables one by one, until you are just a man on a horse going somewhere no one is waiting.",
    openerBattle: "b19_path_opener_exile"
  },
  {
    path: "mercy",
    name: "Mercy",
    honors: "for Yul",
    blurb: "Refuse no surrender. Spare what can be spared. Heal, don't hunt.",
    full: "Yul's answer: the field-surgeon who patched both sides and never once asked which a wounded man fought for. You ride under your own banner and offer terms to every garrison that will take them, build hospitals out of armouries, and refuse to add one more body to a war already drowning in them. The hardest discipline of all: to hold power and keep choosing not to spend it in blood.",
    openerBattle: "b19_path_opener_mercy"
  },
  {
    path: "forgetting",
    name: "Forgetting",
    honors: "for Sera",
    blurb: "Stop being Amar. A cottage, a boat, a name no one is hunting.",
    full: "Sera's answer: the woman from the hospital who told you that the kindest thing the head wound did was let you put a life down. You ride for the southern coast and stop pretending to be anyone at all. A fisherman's cottage. A boat. A name that is not Amar. The squad will find you, and leave a sword by the door, and not stay. And you will spend a long evening looking at it, and choosing, again, to let it lie.",
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
      "The open water gives you the first quiet of your life. Pick the name you can still answer to.",
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
      "Select a path on the left.\n\nEach is one of the seven names you hold at once: the answer a different person would give to the question you've carried since a hospital bed in Thuling: what now?\n\nThe choice is final. Choose the one you can live as.",
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
