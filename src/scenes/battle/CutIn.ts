import Phaser from "phaser";
import type { Unit } from "../../combat/types";
import { FAMILY_BODY, FAMILY_DISPLAY, FAMILY_HEADING, GAME_HEIGHT, GAME_WIDTH } from "../../util/constants";
import { sfxCineClang, sfxCrit } from "../../audio/Sfx";

// ─────────────────────────────────────────────────────────────────────────
// Cut-ins — the battle's two big portrait moments.
//
//   critCutIn  a critical hit: before the blow lands, a slanted band
//              tears across the screen with the attacker's face in it,
//              speed lines, and their battle cry. Under a second.
//   bossIntro  a named boss takes the field: their portrait, name and
//              title on a dark band, before the first turn. Click skips.
//
// Both draw on the UI camera (the caller's `ui` tag pins each object) and
// resolve when they are gone. The scene's own clock drives them, so the
// enemy phase's fast-forward speeds an enemy boss's cut-in up with it.
// ─────────────────────────────────────────────────────────────────────────

type UiTag = <T extends Phaser.GameObjects.GameObject>(o: T) => T;

const DEPTH = 1250;

/** The face each character strikes with. */
const FACE: Record<string, string> = {
  amar: "resolute", lucian: "grim_resolve", ning: "focused_bow", maya: "calculating_side_glance",
  leo: "cocky_smirk", ranatoli: "lecturing", selene: "cold_contempt", veya: "focused",
  corin: "battle_fury", kian: "knowing_smile", rose: "brisk",
  ndari: "scornful", nebu: "fury", archbold: "righteous_fury", dawn: "ideologue_intensity"
};

/** What they shout as it lands (VOICE.md registers: short, theirs). */
const CRY: Record<string, string> = {
  amar: "Now!", lucian: "Hold the line!", ning: "Got you!", maya: "Too slow.", leo: "Watch this!",
  ranatoli: "Steel up!", selene: "Mark.", veya: "Measured.", corin: "Through!", kian: "Form, boy!",
  rose: "Through them!",
  ndari: "Ha!", nebu: "Kneel!", castor: "Yield.", wren: "Hold still.", othren: "For Dawn!",
  serrick: "Break!", archbold: "Kneel to your king!", dawn: "Enough.", herald: "Noted.",
  ravage_commander: "Priced.", coyne: "Nothing personal.", brask: "Burn.", vasse: "For the line!",
  sarto: "Ring it!"
};

/** Generic faces (the stand-in portraits) don't get a cut-in. */
const GENERIC = new Set(["royal_guard", "raider", "reaver", "bandit", "crown_archer"]);

const portraitKey = (scene: Phaser.Scene, u: Unit): string | null => {
  const pid = u.portraitId ?? u.id;
  if (GENERIC.has(pid)) return null;
  const face = FACE[pid];
  if (face && scene.textures.exists(`portrait:${pid}:${face}`)) return `portrait:${pid}:${face}`;
  return scene.textures.exists(`portrait:${pid}`) ? `portrait:${pid}` : null;
};

/** Whether this unit's critical hits get a cut-in: the squad, and the named bosses. */
export const wantsCutIn = (scene: Phaser.Scene, u: Unit): boolean =>
  (u.faction === "player" || !!u.sprite || !!u.tags?.has("boss")) && portraitKey(scene, u) !== null;

/** A tween as a promise. */
const tw = (scene: Phaser.Scene, cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> =>
  new Promise((res) => { scene.tweens.add({ ...cfg, onComplete: () => res() }); });

export const critCutIn = async (scene: Phaser.Scene, ui: UiTag, u: Unit): Promise<void> => {
  const key = portraitKey(scene, u);
  if (!key) return;
  const pid = u.portraitId ?? u.id;
  const fromLeft = u.faction === "player";
  const W = GAME_WIDTH, H = GAME_HEIGHT;
  const bandH = 220, bandY = H * 0.42 - bandH / 2, skew = 70;
  const made: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { made.push(ui(o)); return o; };

  sfxCrit();
  sfxCineClang();
  const dim = add(scene.add.rectangle(0, 0, W, H, 0x000000, 1).setOrigin(0, 0).setDepth(DEPTH).setAlpha(0));
  // The band: a parallelogram across the screen, opening from the
  // attacker's side.
  const band = add(scene.add.graphics().setDepth(DEPTH + 1));
  const accent = u.faction === "player" ? 0xd9b257 : 0xc23a2a;
  band.fillStyle(0x0b0709, 0.94);
  band.fillPoints([
    new Phaser.Math.Vector2(skew, 0), new Phaser.Math.Vector2(W + skew, 0),
    new Phaser.Math.Vector2(W, bandH), new Phaser.Math.Vector2(0, bandH)
  ], true);
  band.fillStyle(accent, 1);
  band.fillRect(skew * 0.5, -3, W, 3);
  band.fillRect(0, bandH, W, 3);
  band.setPosition(fromLeft ? -skew : -skew * 0.5, bandY).setScale(0, 1);
  if (!fromLeft) band.setX(W).setScale(-0, 1);

  // Speed lines racing across the band, in the direction of the blow.
  const lines = add(scene.add.graphics().setDepth(DEPTH + 2).setBlendMode(Phaser.BlendModes.ADD));
  const streaks = Array.from({ length: 18 }, () => ({
    y: bandY + 10 + Math.random() * (bandH - 20), len: 120 + Math.random() * 260,
    x: Math.random() * W, v: 2.4 + Math.random() * 2.2
  }));
  const dir = fromLeft ? 1 : -1;
  const drawLines = (t: number): void => {
    lines.clear();
    for (const s of streaks) {
      const x = ((s.x + dir * s.v * t) % (W + 400) + (W + 400)) % (W + 400) - 200;
      lines.lineStyle(2, 0xffffff, 0.22);
      lines.lineBetween(x, s.y, x + dir * s.len, s.y);
    }
  };

  // The face: the head and shoulders of the portrait, fitted to the band.
  const face = add(scene.add.image(0, 0, key).setDepth(DEPTH + 3));
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const cropTop = src.height * 0.03, cropH = src.height * 0.42;
  face.setCrop(0, cropTop, src.width, cropH);
  const scale = (bandH - 4) / cropH;
  face.setScale(scale).setOrigin(0.5, 0).setFlipX(!fromLeft);
  const faceX = fromLeft ? 330 : W - 330;
  face.setPosition(faceX - dir * 70, bandY + 2 - cropTop * scale).setAlpha(0);

  // The cry, on the far side of the band from the face.
  const textX = fromLeft ? W - 330 : 330;
  const tag = add(scene.add.text(textX, bandY + 40, "CRITICAL", {
    fontFamily: FAMILY_HEADING, fontSize: "16px", color: Phaser.Display.Color.IntegerToColor(accent).rgba,
    letterSpacing: 8
  }).setOrigin(0.5).setDepth(DEPTH + 3).setAlpha(0));
  const cry = add(scene.add.text(textX, bandY + bandH / 2 + 4, CRY[pid] ?? "", {
    fontFamily: FAMILY_DISPLAY, fontSize: "48px", color: "#f4e4b0", stroke: "#120a04", strokeThickness: 6,
    shadow: { offsetX: 0, offsetY: 3, color: "#000", blur: 12, fill: true }
  }).setOrigin(0.5).setDepth(DEPTH + 3).setAlpha(0).setScale(1.5));
  const name = add(scene.add.text(textX, bandY + bandH - 34, u.name.toUpperCase(), {
    fontFamily: FAMILY_BODY, fontSize: "18px", color: "#c9b896", fontStyle: "italic", letterSpacing: 3
  }).setOrigin(0.5).setDepth(DEPTH + 3).setAlpha(0));
  const flash = add(scene.add.rectangle(0, 0, W, H, 0xffffff, 1).setOrigin(0, 0).setDepth(DEPTH + 4)
    .setAlpha(0.35).setBlendMode(Phaser.BlendModes.ADD));

  const clock = { t: 0 };
  const run = scene.tweens.add({ targets: clock, t: 900, duration: 900, onUpdate: () => drawLines(clock.t) });
  void tw(scene, { targets: flash, alpha: 0, duration: 260 });
  void tw(scene, { targets: dim, alpha: 0.4, duration: 90 });
  await tw(scene, { targets: band, scaleX: fromLeft ? 1 : -1, duration: 140, ease: "Cubic.easeOut" });
  void tw(scene, { targets: face, alpha: 1, x: faceX, duration: 160, ease: "Cubic.easeOut" });
  void tw(scene, { targets: face, x: faceX + dir * 22, duration: 700, delay: 160 });
  void tw(scene, { targets: [tag, name], alpha: 1, duration: 160, delay: 60 });
  await tw(scene, { targets: cry, alpha: 1, scale: 1, duration: 150, delay: 60, ease: "Back.easeOut" });
  await tw(scene, { targets: {}, duration: 470 });
  await tw(scene, { targets: [band, face, tag, cry, name, lines, dim], alpha: 0, duration: 150 });
  run.remove();
  for (const o of made) o.destroy();
};

// ---- the boss intro -----------------------------------------------------------

/** Who they are, under their name. */
export const BOSS_TITLES: Record<string, string> = {
  nebu: "King of Anthros",
  ndari: "Warlord of the Mountain Pass",
  selene_enemy: "The Ghost from Para",
  kian_enemy: "The King's Hand",
  imperial_knight: "Commander of the King's Guard",
  turncoat: "Quartermaster of the Rebellion",
  kings_knife: "The King's Knife",
  dawn_loyalist: "Marshal of Dawn's Army",
  imperial_general: "Field General of Grude",
  incendiary_captain: "Captain of the Fire Teams",
  remnant_colonel: "Last Colonel of a Broken Army",
  bell_warden: "Keeper of the Great Bell",
  ravage_herald: "Herald of the Ravage",
  ravage_commander: "Warlord of the Fleet",
  archbold: "King of Grude",
  dawn_boss: "Mother of the Rebellion"
};

/** The boss a battle opens on, if it has one we introduce. */
export const introducedBoss = (scene: Phaser.Scene, enemies: Unit[]): Unit | undefined =>
  enemies.find((e) => BOSS_TITLES[e.id] && portraitKey(scene, e) !== null);

export const bossIntro = async (scene: Phaser.Scene, ui: UiTag, boss: Unit, rightEdge = GAME_WIDTH): Promise<void> => {
  const key = portraitKey(scene, boss);
  if (!key) return;
  const W = rightEdge, H = GAME_HEIGHT;
  const made: Phaser.GameObjects.GameObject[] = [];
  const add = <T extends Phaser.GameObjects.GameObject>(o: T): T => { made.push(ui(o)); return o; };
  let skipped = false;
  let release: (() => void) | undefined;
  const skip = (): void => { skipped = true; release?.(); };
  const hold = (ms: number): Promise<void> => new Promise((res) => {
    if (skipped) { res(); return; }
    release = res;
    scene.time.delayedCall(ms, res);
  });

  sfxCineClang();
  const dim = add(scene.add.rectangle(0, 0, GAME_WIDTH, H, 0x000000, 1).setOrigin(0, 0).setDepth(DEPTH).setAlpha(0));
  const bandY = H * 0.5 - 130, bandH = 260;
  const band = add(scene.add.graphics().setDepth(DEPTH + 1));
  band.fillStyle(0x0d0607, 0.95);
  band.fillPoints([
    new Phaser.Math.Vector2(0, 30), new Phaser.Math.Vector2(W, 0),
    new Phaser.Math.Vector2(W, bandH - 30), new Phaser.Math.Vector2(0, bandH)
  ], true);
  band.fillStyle(0xa8261c, 1);
  band.fillPoints([
    new Phaser.Math.Vector2(0, 26), new Phaser.Math.Vector2(W, -4),
    new Phaser.Math.Vector2(W, 0), new Phaser.Math.Vector2(0, 30)
  ], true);
  band.fillPoints([
    new Phaser.Math.Vector2(0, bandH), new Phaser.Math.Vector2(W, bandH - 30),
    new Phaser.Math.Vector2(W, bandH - 26), new Phaser.Math.Vector2(0, bandH + 4)
  ], true);
  band.setPosition(0, bandY).setAlpha(0);

  // Their portrait, large, rising out of the band on the right.
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  const src = scene.textures.get(key).getSourceImage() as HTMLImageElement;
  const face = add(scene.add.image(0, 0, key).setDepth(DEPTH + 2).setOrigin(0.5, 1));
  face.setCrop(0, 0, src.width, src.height * 0.62);
  const scale = 470 / (src.height * 0.62);
  const faceX = W - 220;
  face.setScale(scale).setPosition(faceX + 120, bandY + bandH + src.height * 0.38 * scale).setAlpha(0);

  const textX = W * 0.36;
  const label = add(scene.add.text(textX, bandY + 64, "BOSS", {
    fontFamily: FAMILY_HEADING, fontSize: "16px", color: "#e0584a", letterSpacing: 10
  }).setOrigin(0.5).setDepth(DEPTH + 3).setAlpha(0));
  const name = add(scene.add.text(textX, bandY + 122, boss.name.toUpperCase(), {
    fontFamily: FAMILY_DISPLAY, fontSize: "54px", color: "#f4e4b0", stroke: "#120a04", strokeThickness: 7,
    shadow: { offsetX: 0, offsetY: 4, color: "#000", blur: 16, fill: true }
  }).setOrigin(0.5).setDepth(DEPTH + 3).setAlpha(0).setScale(1.4).setLetterSpacing(4));
  const title = add(scene.add.text(textX, bandY + 178, BOSS_TITLES[boss.id] ?? "", {
    fontFamily: FAMILY_BODY, fontSize: "24px", color: "#d8c8a4", fontStyle: "italic",
    stroke: "#000", strokeThickness: 3
  }).setOrigin(0.5).setDepth(DEPTH + 3).setAlpha(0));
  if (name.width > W * 0.6) name.setFontSize(42);

  scene.time.delayedCall(250, () => {
    if (!skipped) {
      scene.input.once("pointerdown", skip);
      scene.input.keyboard?.once("keydown", skip);
    }
  });
  void tw(scene, { targets: dim, alpha: 0.55, duration: 250 });
  await tw(scene, { targets: band, alpha: 1, duration: 220 });
  void tw(scene, { targets: face, alpha: 1, x: faceX, duration: 380, ease: "Cubic.easeOut" });
  void tw(scene, { targets: label, alpha: 1, duration: 300, delay: 120 });
  await tw(scene, { targets: name, alpha: 1, scale: 1, duration: 260, delay: 160, ease: "Cubic.easeIn" });
  scene.cameras.main.shake(220, 0.004);
  void tw(scene, { targets: title, alpha: 1, duration: 400 });
  await hold(1700);
  scene.input.off("pointerdown", skip);
  scene.input.keyboard?.off("keydown", skip);
  await tw(scene, { targets: [dim, band, face, label, name, title], alpha: 0, duration: 260 });
  for (const o of made) o.destroy();
};
