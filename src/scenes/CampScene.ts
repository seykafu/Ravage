import Phaser from "phaser";
import { COLORS, FAMILY_BODY, FAMILY_DISPLAY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../util/constants";
import { ensureBackdropTexture, BACKDROPS } from "../art/BackdropArt";
import { getMusic, MUSIC } from "../audio/Music";
import { drawPanel } from "../ui/Panel";
import { Button } from "../ui/Button";
import { BATTLES } from "../data/battles";
import { PLAYERS } from "../data/units";
import { loadSave } from "../util/save";
import { sfxClick } from "../audio/Sfx";
import { SettingsButton } from "../ui/SettingsButton";
import { ensureUnitTexture } from "../art/UnitArt";
import { createUnit } from "../combat/Unit";
import type { UnitDef } from "../combat/types";
import { resolveCampBeat } from "../data/campTalk";
import { hasAsset } from "../assets/manifest";

// CampScene — the squad's home base between battles.
//
// COMMIT 2 — replaces the placeholder 2×2 button grid with a painted
// camp tableau: warm sundown backdrop, painted props (wagon, fire,
// signpost, memorial) with click hotspots, and character sprites
// anchored around the fire. Each prop AND each character is
// clickable. Character clicks open a stub modal in this commit; a
// proper CampTalkScene with portraits + paginated dialogue ships
// in commit 3.
//
// Layout (all y values from screen top, GAME_HEIGHT = 720):
//   y 0-160     header (camp name + subtitle + status)
//   y 160-560   camp tableau (wagon / fire / signpost / chars)
//   y 560-680   memories + roster strip
//   y 680-720   footer (Title button + settings)
export class CampScene extends Phaser.Scene {
  // Pulsing fire glow — kept as a member so the tween can be cleaned
  // up if the scene shuts down before the tween completes.
  private fireGlowTween?: Phaser.Tweens.Tween;

  constructor() { super("CampScene"); }

  create(): void {
    // ---- Backdrop ----------------------------------------------------------
    // Warm sundown camp — the campHome backdrop spec gives us amber sky +
    // warm hills + a baked-in fire glow at the bottom. The campfire
    // sprite we paint on top sits over that glow so the whole bottom
    // half of the screen reads as "around the fire."
    const bgKey = ensureBackdropTexture(this, "bg_camp_home", BACKDROPS.campHome);
    this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, bgKey).setDisplaySize(GAME_WIDTH, GAME_HEIGHT);
    // Light vignette — softer than the world map's so the painted
    // props don't lose their warmth.
    const v = this.add.graphics();
    v.fillGradientStyle(0x0a0604, 0x0a0604, 0x05060a, 0x05060a, 0.35, 0.35, 0.6, 0.6);
    v.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // ---- Header (title + subtitle + status) -------------------------------
    this.add.text(GAME_WIDTH / 2, 50, "The Camp", {
      fontFamily: FAMILY_DISPLAY,
      fontSize: "48px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 5,
      shadow: { offsetX: 0, offsetY: 4, color: "#000", blur: 14, fill: true }
    }).setOrigin(0.5).setLetterSpacing(4);

    const save = loadSave();
    const subtitle = this.resolveCampSubtitle(save.completedBattles);
    this.add.text(GAME_WIDTH / 2, 96, subtitle, {
      fontFamily: FAMILY_BODY,
      fontSize: "15px",
      color: "#c9b07a",
      fontStyle: "italic"
    }).setOrigin(0.5);

    const squadIds = this.activeSquadIds(save.completedBattles);
    this.add.text(GAME_WIDTH / 2, 122, `${squadIds.length} ${squadIds.length === 1 ? "soul" : "souls"} at the fire tonight`, {
      fontFamily: FAMILY_BODY,
      fontSize: "12px",
      color: "#7a7165"
    }).setOrigin(0.5);

    // ---- Camp tableau (props + characters) --------------------------------
    // Anchored coordinates picked to leave the fire as the visual
    // center of gravity. Characters cluster around the fire; the
    // wagon and signpost frame the clearing left + right; the
    // memorial spot anchors the bottom-left when fallen exist.
    this.renderCampfire(640, 380);
    this.renderWagon(280, 290, () => this.openWagon(save.completedBattles));
    // Signpost prop removed — replaced with the top-right "Go to Map"
    // button below. Frees up the right half of the camp's middle band
    // for character sprites when the squad expands past 6.
    // Memorial spot only renders when at least one character has
    // fallen (post-cliffs in the current slice; future commits will
    // surface scripted character deaths from later chapters too).
    const fallen = this.fallenCharacters(save.completedBattles);
    if (fallen.length > 0) {
      this.renderMemorial(180, 510, fallen);
    }

    // Character sprites around the fire. Positions arranged so each
    // character has breathing room and the click hotspots don't
    // overlap. Defaults to a clockwise layout starting from Amar at
    // the fire's south side. Each sprite stagger-fades in 100ms
    // after the previous so the camp "populates" rather than
    // slamming the squad into view all at once.
    const positions = this.characterPositions(squadIds.length);
    squadIds.forEach((id, i) => {
      const pos = positions[i];
      if (!pos) return;
      const fadeDelay = 250 + i * 120;
      this.renderCharacter(id, pos.x, pos.y, fadeDelay);
    });

    // ---- Bottom strip: Roster + Memories Wall -----------------------------
    // Two compact panels for the lighter actions that don't deserve
    // a full painted prop. Bumped from y=580 to y=548 so the strip
    // doesn't crowd the Title button at GAME_HEIGHT-56 (664). Sits
    // ~26px below the character labels (which end ~y=522) and
    // leaves ~36px of breath above the Title button.
    const stripY = 548;
    // Plain-text labels. Emoji glyphs were not rendering reliably
    // on every platform/font combination — same issue that hit the
    // "Go to Map" button.
    this.renderStripPanel(80, stripY, 360, 80,
      "The Roster",
      "Review levels, stats, and abilities for every soul in the squad.",
      () => {
        sfxClick();
        this.scene.pause();
        this.scene.run("RosterScene", { from: this.scene.key });
      }
    );
    this.renderStripPanel(GAME_WIDTH - 80 - 360, stripY, 360, 80,
      "Memories Wall",
      "(no memories forged yet — bonds will surface here in a future update)",
      () => {
        sfxClick();
        this.showMemoriesPlaceholder();
      },
      /* enabled */ false
    );

    // ---- Footer -----------------------------------------------------------
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

    // Top-right action: "Go to Map". Replaces the signpost prop —
    // sits in the corner so the camp's middle band stays clear for
    // character sprites. Settings gear sits to the right of it so
    // the corner cluster reads as "scene controls" together.
    // Plain-text label — emoji glyphs were not rendering reliably
    // on every platform/font combination.
    new Button(this, {
      x: GAME_WIDTH - 80 - 160,
      y: 24,
      w: 160,
      h: 36,
      label: "Go to Map",
      primary: true,
      fontSize: 14,
      onClick: () => {
        sfxClick();
        this.cameras.main.fadeOut(350, 0, 0, 0);
        this.cameras.main.once("camerafadeoutcomplete", () => this.scene.start("OverworldScene"));
      }
    });

    new SettingsButton(this, GAME_WIDTH - 32, 32);

    getMusic(this).play(MUSIC.everydayLife, { fadeMs: 1000 });
    this.cameras.main.fadeIn(450, 0, 0, 0);

    // Clean up tween on scene shutdown so it doesn't tween a destroyed
    // graphics object after we navigate away.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.fireGlowTween) { this.fireGlowTween.stop(); this.fireGlowTween = undefined; }
    });
  }

  // ---- Painted props -------------------------------------------------------

  // Pulsing campfire — central anchor of the tableau. Prefers the
  // animated pixel-art spritesheet at assets/camp/fire.png when
  // loaded; falls back to a procedural pulsing glow + procedural
  // stone ring so the scene stays usable until the asset ships.
  // The outer warm halo is drawn in either case to spill firelight
  // onto the surrounding ground.
  private renderCampfire(cx: number, cy: number): Phaser.GameObjects.GameObject {
    if (hasAsset("camp:fire")) {
      // Real pixel-art animation. Frame dimensions match the manifest
      // (384×1024, 4 frames arranged horizontally → spritesheet
      // 1536×1024). The asset includes its own logs/embers at the
      // base AND its own warm glow — so we DO NOT draw the procedural
      // halo OR stone ring on this path. The painted asset is the
      // entire visual; nothing should compete with it.
      //
      // Fire dropped from cy+40 to cy+100 so it sits closer to the
      // ground / characters and reads as anchored to the camp's
      // floor rather than floating mid-screen. Earlier offsets had
      // a 90px gap between the fire's base and the character row at
      // fy=510 — now ~30px, much tighter.
      const animKey = "camp_fire_loop";
      if (!this.anims.exists(animKey)) {
        this.anims.create({
          key: animKey,
          frames: this.anims.generateFrameNumbers("camp:fire", { start: 0, end: 3 }),
          frameRate: 6,
          repeat: -1
        });
      }
      const sprite = this.add.sprite(cx, cy + 100, "camp:fire");
      sprite.setOrigin(0.5, 1); // bottom-center anchor
      sprite.setScale(0.35);
      sprite.play(animKey);
      return sprite;
    }

    // Procedural fallback path — only drawn when the painted asset
    // isn't loaded. Halo + stone ring give the procedural glow some
    // visual structure to sit on.
    const halo = this.add.graphics();
    halo.fillStyle(0xefa45a, 0.18);
    halo.fillCircle(cx, cy + 12, 120);
    halo.setBlendMode(Phaser.BlendModes.ADD);

    const stones = this.add.graphics();
    stones.fillStyle(0x3a2a1c, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const sx = cx + Math.cos(a) * 56;
      const sy = cy + Math.sin(a) * 22 + 30;
      stones.fillCircle(sx, sy, 7);
    }
    stones.fillStyle(0x2a1a10, 1);
    stones.fillEllipse(cx, cy + 28, 100, 28);

    // Procedural fallback — additive-blended orange disc + scale/
    // alpha tween. Same look as before the asset slot existed.
    const glow = this.add.graphics();
    glow.fillStyle(0xff7a2a, 0.55);
    glow.fillCircle(cx, cy + 8, 36);
    glow.fillStyle(0xffd966, 0.85);
    glow.fillCircle(cx, cy + 12, 18);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    this.fireGlowTween = this.tweens.add({
      targets: glow,
      scale: { from: 0.92, to: 1.08 },
      alpha: { from: 0.85, to: 1 },
      yoyo: true,
      repeat: -1,
      duration: 700,
      ease: "Sine.easeInOut"
    });
    return glow;
  }

  // Helper for the staggered entry animation. Sets the target's
  // alpha to 0 immediately, then tweens it to 1 after `delay` ms.
  // Used on every prop + character sprite so the camp "settles in"
  // rather than slamming into view all at once. Subtle but reads
  // as intentional pacing — the player feels they've ARRIVED at a
  // place.
  private stagger(target: Phaser.GameObjects.GameObject & { alpha: number }, delay: number, duration = 350): void {
    target.alpha = 0;
    this.tweens.add({
      targets: target,
      alpha: 1,
      delay,
      duration,
      ease: "Sine.easeOut"
    });
  }

  // The wagon — clickable hotspot that opens the inventory + trade
  // screen. Prefers the painted PNG at assets/camp/wagon.png when
  // loaded; falls back to a procedural wood-box silhouette so the
  // scene stays usable until the asset ships.
  private renderWagon(cx: number, cy: number, onClick: () => void): void {
    const w = 240;
    const h = 200;

    if (hasAsset("camp:wagon")) {
      // Real painted asset — display centered at (cx, cy), scaled to
      // fit the same hotspot footprint the procedural draw uses so
      // the click target is consistent regardless of asset choice.
      const img = this.add.image(cx, cy, "camp:wagon");
      // Scale to fit within w×h while preserving aspect ratio.
      const tex = this.textures.get("camp:wagon").getSourceImage() as HTMLImageElement | HTMLCanvasElement;
      const sx = w / (tex.width || w);
      const sy = h / (tex.height || h);
      const scale = Math.min(sx, sy);
      img.setScale(scale);
    } else {
      // Procedural fallback — wood box + canvas top + wheels.
      const fbW = 200;
      const fbH = 130;
      const g = this.add.graphics();
      g.fillStyle(0x3a2818, 1);
      g.fillRect(cx - fbW / 2, cy - fbH / 2, fbW, fbH - 24);
      g.lineStyle(2, 0x5a3e22, 1);
      g.strokeRect(cx - fbW / 2, cy - fbH / 2, fbW, fbH - 24);
      g.fillStyle(0xc9b07a, 0.92);
      g.fillEllipse(cx, cy - fbH / 2 + 4, fbW, 50);
      g.lineStyle(2, 0x9a8458, 1);
      g.strokeEllipse(cx, cy - fbH / 2 + 4, fbW, 50);
      g.fillStyle(0x1a0e04, 1);
      g.fillCircle(cx - fbW / 2 + 22, cy + fbH / 2 - 22, 16);
      g.fillCircle(cx + fbW / 2 - 22, cy + fbH / 2 - 22, 16);
      g.fillStyle(0x5a3e22, 1);
      g.fillCircle(cx - fbW / 2 + 22, cy + fbH / 2 - 22, 6);
      g.fillCircle(cx + fbW / 2 - 22, cy + fbH / 2 - 22, 6);
      // No emoji glyph on the procedural wagon — same rendering
      // concern that hit the Roster / Memories Wall buttons.
    }

    this.add.text(cx, cy + h / 2 + 4, "Wagon — Inventory + Trade", {
      fontFamily: FAMILY_HEADING,
      fontSize: "13px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 3
    }).setOrigin(0.5);

    this.attachHotspot(cx - w / 2, cy - h / 2, w, h + 20, onClick);
  }

  // (renderSignpost removed — "Go to Map" lives as a top-right
  // corner button now so the camp's middle band stays clear for
  // character sprites as the squad expands past 6.)

  // Memorial spot — only renders when fallen characters exist.
  // One small stone marker per fallen name, with the name carved
  // visible. Click opens a quiet narrator beat about who they were.
  private renderMemorial(cx: number, cy: number, fallen: { id: string; name: string }[]): void {
    const g = this.add.graphics();
    g.fillStyle(0x2a2218, 1);
    g.fillEllipse(cx, cy + 30, 140, 24);
    fallen.forEach((f, i) => {
      const sx = cx - 30 + i * 40;
      const sy = cy;
      // Stone marker
      g.fillStyle(0x6a5a4a, 1);
      g.fillRoundedRect(sx - 14, sy - 36, 28, 40, 3);
      g.lineStyle(1, 0x1a0e04, 1);
      g.strokeRoundedRect(sx - 14, sy - 36, 28, 40, 3);
      // Carved name
      this.add.text(sx, sy - 16, f.name.slice(0, 3).toUpperCase(), {
        fontFamily: FAMILY_HEADING,
        fontSize: "10px",
        color: "#1a0e04"
      }).setOrigin(0.5);
    });

    // Lucian-specific: festival flag from B11's sea burial. If
    // Lucian fell, his flag hangs near the marker.
    if (fallen.find((f) => f.id === "lucian")) {
      const flagX = cx + 70;
      const flagY = cy - 40;
      g.fillStyle(0x6a3a2a, 1);
      g.fillRect(flagX, flagY, 4, 80);
      g.fillStyle(0xc97a4a, 0.85);
      g.fillTriangle(flagX + 4, flagY, flagX + 50, flagY + 12, flagX + 4, flagY + 24);
      g.lineStyle(1, 0x1a0e04, 1);
      g.strokeRect(flagX, flagY, 4, 80);
    }

    this.add.text(cx, cy + 56, "Memorial", {
      fontFamily: FAMILY_HEADING,
      fontSize: "12px",
      color: "#c9b07a",
      stroke: "#1a0e04",
      strokeThickness: 2
    }).setOrigin(0.5);

    this.attachHotspot(cx - 80, cy - 50, 160, 100, () => this.showMemorialBeat(fallen));
  }

  // Character sprite + click hotspot. Sprite uses the unit's
  // existing texture (procedural or shipped, whichever loaded).
  // Name label below in the squad's gold-on-black house style.
  // Click hotspot is bigger than the sprite to give a generous
  // click target on the character's full silhouette.
  // The optional fadeDelay staggers the entry animation so squad
  // members appear one at a time, ~120ms apart, when the camp
  // loads.
  private renderCharacter(id: string, x: number, y: number, fadeDelay = 0): void {
    const factory = this.resolvePlayerFactory(id);
    if (!factory) return;
    const def = factory();
    const u = createUnit(def, { x: 0, y: 0 });
    const tex = ensureUnitTexture(this, u);
    const sprite = this.add.sprite(x, y, tex).setDisplaySize(64, 80).setOrigin(0.5, 1);
    // Soft cast shadow so the sprite reads as standing on the ground
    // rather than floating above the painted backdrop.
    const shadow = this.add.ellipse(x, y + 4, 50, 14, 0x000000, 0.45);
    void shadow;

    // Name label
    const name = this.add.text(x, y + 12, def.name, {
      fontFamily: FAMILY_HEADING,
      fontSize: "13px",
      color: "#f4d999",
      stroke: "#1a0e04",
      strokeThickness: 3
    }).setOrigin(0.5, 0);

    // Stagger entry — sprite + name fade in together so the
    // character "arrives" at their spot rather than just appearing.
    // Cheap pacing detail; the camera's own fadeIn handles the
    // overall scene reveal.
    if (fadeDelay > 0) {
      this.stagger(sprite as unknown as Phaser.GameObjects.GameObject & { alpha: number }, fadeDelay);
      this.stagger(name as unknown as Phaser.GameObjects.GameObject & { alpha: number }, fadeDelay);
    }

    // Click hotspot — a transparent zone over the sprite. Opens a
    // BattleDialogueScene overlay with the character's resolved
    // idle line. Reusing BattleDialogueScene avoids a redundant
    // scene; the styling (paused-overlay portrait + dim parent
    // showing through) translates perfectly to "click on Amar at
    // the fire."
    this.attachHotspot(x - 36, y - 80, 72, 100, () => this.openCharacterTalk(def.id));
    void sprite;
  }

  // Resolve the character's current-era idle line, then pause the
  // camp and run BattleDialogueScene as a single-beat overlay.
  // BattleDialogueScene's resume contract returns control here when
  // the player clicks Continue — same flow the in-battle dialogues
  // use, no new plumbing needed.
  private openCharacterTalk(characterId: string): void {
    sfxClick();
    const save = loadSave();
    const beat = resolveCampBeat(characterId, save.completedBattles);
    this.scene.pause();
    this.scene.run("BattleDialogueScene", {
      beats: [beat],
      resumeKey: this.scene.key
    });
  }

  // Shared hotspot helper — adds a transparent interactive zone +
  // gold ring on hover. Reused by every painted prop.
  private attachHotspot(x: number, y: number, w: number, h: number, onClick: () => void): void {
    const zone = this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    const ring = this.add.graphics();
    zone.on("pointerover", () => {
      ring.clear();
      ring.lineStyle(2, 0xffd97a, 0.85);
      ring.strokeRoundedRect(x + 0.5, y + 0.5, w - 1, h - 1, 4);
    });
    zone.on("pointerout", () => ring.clear());
    zone.on("pointerdown", onClick);
  }

  // ---- Compact strip panels (Roster + Memories Wall) -----------------------
  // Smaller cousins of the painted props above; used for the lighter
  // actions that don't deserve a full painted hotspot.
  private renderStripPanel(
    x: number, y: number, w: number, h: number,
    label: string, desc: string,
    onClick: () => void,
    enabled = true
  ): void {
    const g = this.add.graphics();
    drawPanel(g, x, y, w, h);
    if (!enabled) {
      const grey = this.add.graphics();
      grey.fillStyle(0x000000, 0.45);
      grey.fillRect(x, y, w, h);
    }
    this.add.text(x + 16, y + 12, label, {
      fontFamily: FAMILY_HEADING,
      fontSize: "16px",
      color: enabled ? "#f4d999" : "#7a7165",
      stroke: "#1a0e04",
      strokeThickness: 3
    });
    this.add.text(x + 16, y + 38, desc, {
      fontFamily: FAMILY_BODY,
      fontSize: "12px",
      color: enabled ? "#dad3bd" : "#5a5a62",
      wordWrap: { width: w - 32 },
      lineSpacing: 4
    });
    if (enabled) {
      this.attachHotspot(x, y, w, h, onClick);
    }
  }

  // ---- Wagon entrypoint (commit 1, unchanged) ------------------------------
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

  // ---- Layout helpers ------------------------------------------------------

  // Anchored positions for character sprites around the fire. Layout
  // changes by squad size so 1-character posts look intentional and
  // big-squad posts don't crowd or overlap props.
  //
  // Spatial budget (informs the per-count layouts below):
  //   * Wagon footprint — x=160-400, y=190-390. Characters can
  //     sit BELOW the wagon (y >= 430) at any x, but shouldn't
  //     overlap horizontally if positioned at the wagon's y.
  //   * Fire stones — x=580-700, y=380-440. Characters' top edge
  //     at y=fy-80 enters this zone if fy <= 520; positioning
  //     directly south of the fire is the canonical look.
  //   * Strip panels (Roster + Memories Wall) — y=548-628. Front-
  //     row character labels sit at y=fy+12, so fy=510 puts the
  //     label at 522 with 26px to the strip top — comfortable.
  //   * Title button — y=664. ~36px below the strip's bottom edge.
  //
  // SQUAD-SIZE LAYOUTS:
  //   1-6: single arc south of the fire. Center characters slightly
  //        forward (fy + 20-30) so the arc curves toward the fire.
  //   7-8: wider single arc. Spacing tightens; arc curves less.
  //   9-10: two rows. Front row (5 characters at fy+10) takes
  //         priority for the new joiners; back row (4-5 characters
  //         at fy-30) takes the originals + later additions. Back-
  //         row sprites sit BEHIND the front row visually but the
  //         click hotspots layer correctly because back-row is
  //         rendered first.
  //
  // BACK ROW + FIRE COLLISION:
  //   The fire's stone ring extends from x=580 to x=700 at y=380-440.
  //   Back row at y=480 (sprite top y=400) would clip the fire's
  //   stones if positioned at x=580-700. To avoid this, the back row
  //   layouts skip the x=580-700 band — characters sit either side
  //   of the fire (3 left of x=560, 2-3 right of x=720), with the
  //   front row covering the central x band.
  //
  // BEYOND 10 CHARACTERS:
  //   Not designed for. The campaign tops out around 10 active
  //   members per the script. If we ever exceed that, the next
  //   layout step is a third row OR scrolling the camp horizontally.
  private characterPositions(count: number): { x: number; y: number }[] {
    const fy = 510; // baseline ground line for the front row
    const fyBack = 480; // back-row baseline (sprite top y=400, ~30px above front)

    const layouts: Record<number, { x: number; y: number }[]> = {
      1: [{ x: 640, y: fy }],
      2: [{ x: 580, y: fy }, { x: 700, y: fy }],
      3: [{ x: 540, y: fy }, { x: 640, y: fy + 20 }, { x: 740, y: fy }],
      4: [{ x: 500, y: fy }, { x: 600, y: fy + 20 }, { x: 700, y: fy + 20 }, { x: 800, y: fy }],
      5: [{ x: 460, y: fy }, { x: 560, y: fy + 20 }, { x: 660, y: fy + 30 }, { x: 760, y: fy + 20 }, { x: 860, y: fy }],
      6: [{ x: 440, y: fy }, { x: 530, y: fy + 20 }, { x: 620, y: fy + 30 }, { x: 700, y: fy + 30 }, { x: 790, y: fy + 20 }, { x: 880, y: fy }],
      // Single-row stretches — tighten spacing as count grows.
      7: [
        { x: 410, y: fy }, { x: 490, y: fy + 15 }, { x: 570, y: fy + 25 },
        { x: 640, y: fy + 30 },
        { x: 710, y: fy + 25 }, { x: 790, y: fy + 15 }, { x: 870, y: fy }
      ],
      8: [
        { x: 380, y: fy }, { x: 460, y: fy + 12 }, { x: 540, y: fy + 22 }, { x: 610, y: fy + 28 },
        { x: 680, y: fy + 28 }, { x: 750, y: fy + 22 }, { x: 830, y: fy + 12 }, { x: 910, y: fy }
      ],
      // Two-row layouts. Back row STRADDLES the fire (3 left, 2 right
      // for 9; 3 left, 3 right for 10) — never sits in the x=580-700
      // band where the fire's stone ring is. Front row takes 5 spots
      // across the full arc.
      9: [
        // Back row (4 — left+right of fire, none center)
        { x: 380, y: fyBack }, { x: 460, y: fyBack }, { x: 760, y: fyBack }, { x: 840, y: fyBack },
        // Front row (5 — full arc south of fire)
        { x: 420, y: fy + 10 }, { x: 530, y: fy + 25 }, { x: 640, y: fy + 30 },
        { x: 750, y: fy + 25 }, { x: 860, y: fy + 10 }
      ],
      10: [
        // Back row (5 — 3 left of fire, 2 right; the asymmetry
        // mirrors how the squad usually clusters around someone
        // talking on the right)
        { x: 360, y: fyBack }, { x: 440, y: fyBack }, { x: 520, y: fyBack },
        { x: 760, y: fyBack }, { x: 840, y: fyBack },
        // Front row (5)
        { x: 400, y: fy + 10 }, { x: 510, y: fy + 25 }, { x: 620, y: fy + 30 },
        { x: 730, y: fy + 25 }, { x: 840, y: fy + 10 }
      ]
    };
    return layouts[Math.min(10, Math.max(1, count))] ?? [];
  }

  private resolvePlayerFactory(id: string): (() => UnitDef) | undefined {
    // Map character ids to PLAYER factories. amar_true / amarHidden
    // share the visual with amar but represent different statlines —
    // use the canonical "amar" sprite for the camp.
    const factories: Record<string, () => UnitDef> = {
      amar: PLAYERS.amar,
      lucian: PLAYERS.lucian,
      ning: PLAYERS.ning,
      maya: PLAYERS.maya,
      leo: PLAYERS.leo,
      ranatoli: PLAYERS.ranatoli,
      selene: PLAYERS.selene,
      kian: PLAYERS.kian
    };
    return factories[id];
  }

  // Fallen-character resolver — returns the names + ids of squad
  // members who have died scripted deaths in completed battles.
  // Currently just Lucian (post_cliffs after B11). Future scripted
  // deaths in B13/B17/etc. plug in here.
  private fallenCharacters(completedBattles: string[]): { id: string; name: string }[] {
    const fallen: { id: string; name: string }[] = [];
    if (completedBattles.includes("b11_cliffs")) {
      fallen.push({ id: "lucian", name: "Lucian" });
    }
    return fallen;
  }

  // ---- Memorial / Memories overlays ----------------------------------------

  private showMemorialBeat(fallen: { id: string; name: string }[]): void {
    sfxClick();
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setInteractive();
    const panelW = 540;
    const panelH = 280;
    const panelX = (GAME_WIDTH - panelW) / 2;
    const panelY = (GAME_HEIGHT - panelH) / 2;
    const pg = this.add.graphics();
    drawPanel(pg, panelX, panelY, panelW, panelH);
    const title = this.add.text(panelX + panelW / 2, panelY + 22, "At the Memorial", {
      fontFamily: FAMILY_HEADING,
      fontSize: "22px",
      color: "#f4d999"
    }).setOrigin(0.5, 0);

    // Per-character memorial text. Lucian is the only canonical
    // death in the playable slice; future scripted deaths add
    // entries here.
    const blocks: string[] = [];
    for (const f of fallen) {
      if (f.id === "lucian") {
        blocks.push("Lucian — foreman of Thuling, husband to Mira, father to Tali. Took the bolt that should have ended Ning. Died in the cabin of Madame Dawn's ship with Amar's hand in his. The festival flag from his front room hangs over the marker. Mira and Tali rode for the cousin's farm. Amar will write to them every season for the rest of his life.");
      } else {
        blocks.push(`${f.name} — fell in the line of duty.`);
      }
    }
    const body = this.add.text(panelX + 24, panelY + 64, blocks.join("\n\n"), {
      fontFamily: FAMILY_BODY,
      fontSize: "13px",
      color: "#dad3bd",
      wordWrap: { width: panelW - 48 },
      lineSpacing: 5
    });

    const closeBtn = new Button(this, {
      x: panelX + panelW / 2 - 70,
      y: panelY + panelH - 50,
      w: 140,
      h: 36,
      label: "Close",
      primary: false,
      fontSize: 13,
      onClick: () => {
        dim.destroy(); pg.destroy(); title.destroy(); body.destroy(); closeBtn.destroy();
      }
    });
  }

  private showMemoriesPlaceholder(): void {
    const dim = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.7).setInteractive();
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
        dim.destroy(); pg.destroy(); title.destroy(); body.destroy(); closeBtn.destroy();
      }
    });
  }

  // ---- Subtitle resolver (unchanged from commit 1) -------------------------
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

  // ---- Active squad resolver (unchanged from commit 1) ---------------------
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
    // No completed battles yet — show the starting trio so the camp
    // doesn't read as empty on a fresh save.
    return ["amar"];
  }
}

void COLORS;
