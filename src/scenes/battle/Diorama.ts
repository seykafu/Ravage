import Phaser from "phaser";
import type { Grid } from "../../combat/Grid";
import type { ObstacleKind, TerrainKind } from "../../combat/types";
import type { Projection } from "../../render/Projection";
import { ensureObstacleTexture, ensureTileTexture } from "../../art/TileArt";
import { DEPTH, actorDepth, terrainDepth, terrainOverlayDepth } from "../../render/depth";
import { addTorchGlow } from "./Lighting";
import { ensureDotTexture } from "./Atmosphere";
import { castFrom, torchShadow, type Sun } from "../../render/sun";

// ─────────────────────────────────────────────────────────────────────────
// Diorama — builds the battle board as a physical object.
//
// On the flat board every tile was one painted square at depth 0. On the ¾
// board each tile is a TOP FACE (the painted terrain, foreshortened) plus,
// wherever it stands above the tile in front of it, a FRONT FACE: the wall
// of earth, stone or timber that the height exposes. The bottom row's front
// faces together are the slab the whole board sits on. Around that:
//
//   * ambient occlusion where a tile meets a taller neighbour (light comes
//     from the north-west, so walls shade the ground south and east of them)
//   * a faint grid so the tactics stay legible on painted ground
//   * sunken water with a moving shimmer and foam lapping at the shore
//   * raised walls capped in stone — brick is a wall's FACE, not its top
//   * props stood UP as billboards with their base on the ground, sorted
//     with the units so a tree in front of a soldier covers him
//   * torch light pooling on the ground, plus a halo at the flame
//   * a soft shadow under the whole board, so it sits on the world
//
// Works with either projection. On the flat board front faces are all zero
// height, so the same code draws the old look (tops, props, grid) — which
// is what keeps `?flat=1` a real fallback rather than a second renderer.
// ─────────────────────────────────────────────────────────────────────────

/** Terrains with no authored direction — safe to rotate for variety. */
const ISOTROPIC: ReadonlySet<string> = new Set([
  "grass", "stone", "dirt", "snow", "mud", "marble", "sand", "forest",
  "rubble", "cobblestone", "cracked_earth", "ice", "moss_stone"
]);

/**
 * Terrains whose painted texture is smooth and low-contrast. Their art
 * tiles seamlessly as painted, and mirror flips keep it seamless (a
 * flipped edge meets a copy of itself), but a quarter-turn butts one edge
 * against a different one — and per-cell brightness jitter at the level
 * the busy textures need was nearly twice snow's own variation. Together
 * they turned snowfields and marble floors into a checkerboard. These get
 * flips only, and a gentler jitter.
 */
const SMOOTH: ReadonlySet<string> = new Set([
  "snow", "marble", "sand", "dirt", "ice", "water", "mud", "carpet", "cracked_earth"
]);

/**
 * What a tile's exposed wall is made of. Turf and snow are skins over
 * earth and rock; everything hard shows its own body.
 */
const FACE_MATERIAL: Record<TerrainKind, TerrainKind> = {
  grass: "dirt", forest: "dirt", mud: "dirt", dirt: "dirt", cracked_earth: "dirt",
  sand: "sand", snow: "stone", ice: "ice",
  stone: "stone", cobblestone: "stone", rubble: "stone", moss_stone: "stone",
  marble: "marble", wall: "wall", wood: "wood", door: "wood",
  water: "stone", carpet: "stone", lava: "stone"
};

/** Soft surfaces whose skin visibly overhangs the wall beneath them. */
const LIPPED: ReadonlySet<TerrainKind> = new Set(["grass", "forest", "snow", "sand", "moss_stone", "mud"]);

/**
 * Props that should stand taller than a tile on the ¾ board. A tree
 * shorter than a soldier, or a palace column no taller than a crate, is
 * what makes a tilted board read as a toy.
 */
const PROP_SCALE: Partial<Record<ObstacleKind, number>> = {
  tree: 1.3, pillar: 1.25, torch: 1.1, throne: 1.1
};

// Generated at 2× world size — the render-scale camera draws the world at
// zoom 2, so these hit the screen at native resolution.
const FACE_TEX_W = 96;
const FACE_TEX_H = 64;
const LIP_TEX_H = 10;

type Src = HTMLImageElement | HTMLCanvasElement;
const sourceOf = (scene: Phaser.Scene, key: string): Src =>
  scene.textures.get(key).getSourceImage() as Src;

/** A rotated copy of a tile texture (90° steps), cached. */
const ensureRotated = (scene: Phaser.Scene, key: string, quarter: number): string => {
  if (quarter === 0) return key;
  const out = `dtop:${key}:${quarter}`;
  if (scene.textures.exists(out)) return out;
  const src = sourceOf(scene, key);
  const tex = scene.textures.createCanvas(out, src.width, src.height);
  if (!tex) return key;
  const ctx = tex.getContext();
  ctx.translate(src.width / 2, src.height / 2);
  ctx.rotate(quarter * Math.PI / 2);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  tex.refresh();
  scene.textures.get(out).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return out;
};

/**
 * The exposed wall under a tile of `top` terrain: a band of its material's
 * painted texture (cropped, not stretched, so grain keeps its shape),
 * darkened toward the ground, with a couple of strata lines.
 */
const ensureFaceTexture = (scene: Phaser.Scene, top: TerrainKind): string => {
  const key = `dface:${top}`;
  if (scene.textures.exists(key)) return key;
  const matKey = ensureTileTexture(scene, FACE_MATERIAL[top], 97);
  const src = sourceOf(scene, matKey);
  const tex = scene.textures.createCanvas(key, FACE_TEX_W, FACE_TEX_H);
  if (!tex) return matKey;
  const ctx = tex.getContext();
  const bandH = Math.min(src.height, src.width * (FACE_TEX_H / FACE_TEX_W));
  ctx.drawImage(src, 0, Math.max(0, (src.height - bandH) * 0.4), src.width, bandH, 0, 0, FACE_TEX_W, FACE_TEX_H);
  // A south-facing wall under a north-west sun: in shadow, deepening
  // toward the foot where bounce light can't reach.
  const g = ctx.createLinearGradient(0, 0, 0, FACE_TEX_H);
  g.addColorStop(0, "rgba(14,12,22,0.18)");
  g.addColorStop(1, "rgba(14,12,22,0.52)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FACE_TEX_W, FACE_TEX_H);
  // Strata: a dark seam with a hairline of catch-light under it.
  for (const f of [0.36, 0.7]) {
    const y = Math.round(FACE_TEX_H * f);
    ctx.fillStyle = "rgba(0,0,0,0.20)";
    ctx.fillRect(0, y, FACE_TEX_W, 2);
    ctx.fillStyle = "rgba(255,240,220,0.05)";
    ctx.fillRect(0, y + 2, FACE_TEX_W, 1);
  }
  tex.refresh();
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return key;
};

/** The overhanging skin of turf / snow / sand along a wall's top edge. */
const ensureLipTexture = (scene: Phaser.Scene, top: TerrainKind): string => {
  const key = `dlip:${top}`;
  if (scene.textures.exists(key)) return key;
  const topKey = ensureTileTexture(scene, top, 97);
  const src = sourceOf(scene, topKey);
  const tex = scene.textures.createCanvas(key, FACE_TEX_W, LIP_TEX_H);
  if (!tex) return topKey;
  const ctx = tex.getContext();
  ctx.drawImage(src, 0, src.height * 0.45, src.width, src.height * 0.1, 0, 0, FACE_TEX_W, LIP_TEX_H - 3);
  const g = ctx.createLinearGradient(0, LIP_TEX_H - 3, 0, LIP_TEX_H);
  g.addColorStop(0, "rgba(0,0,0,0.45)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, LIP_TEX_H - 3, FACE_TEX_W, 3);
  tex.refresh();
  scene.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR);
  return key;
};

/** 1-px-wide gradient strips for ambient occlusion. */
const ensureAoTextures = (scene: Phaser.Scene): { v: string; h: string } => {
  const v = "dao:v", h = "dao:h";
  if (!scene.textures.exists(v)) {
    const t = scene.textures.createCanvas(v, 2, 32);
    if (t) {
      const ctx = t.getContext();
      const g = ctx.createLinearGradient(0, 0, 0, 32);
      g.addColorStop(0, "rgba(8,6,14,0.62)");
      g.addColorStop(1, "rgba(8,6,14,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 2, 32);
      t.refresh();
    }
  }
  if (!scene.textures.exists(h)) {
    const t = scene.textures.createCanvas(h, 32, 2);
    if (t) {
      const ctx = t.getContext();
      const g = ctx.createLinearGradient(0, 0, 32, 0);
      g.addColorStop(0, "rgba(8,6,14,0.55)");
      g.addColorStop(1, "rgba(8,6,14,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 32, 2);
      t.refresh();
    }
  }
  return { v, h };
};

/** Light rippling on water — drawn once, animated by tween. */
const ensureShimmerTexture = (scene: Phaser.Scene): string => {
  const key = "dwater:shimmer";
  if (scene.textures.exists(key)) return key;
  const W = 96, H = 72;
  const tex = scene.textures.createCanvas(key, W, H);
  if (!tex) return key;
  const ctx = tex.getContext();
  ctx.lineCap = "round";
  // Deterministic squiggles: short crests of light, staggered.
  let s = 1337;
  const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
  for (let i = 0; i < 9; i++) {
    const x = rnd() * W, y = 6 + rnd() * (H - 12), len = 10 + rnd() * 18;
    ctx.strokeStyle = `rgba(225,248,255,${0.35 + rnd() * 0.35})`;
    ctx.lineWidth = 1.4 + rnd() * 1.2;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + len / 2, y - 3, x + len, y);
    ctx.stroke();
  }
  tex.refresh();
  return key;
};

/**
 * Foam where water meets a bank: a bright broken line at the edge that
 * thins into the water. One horizontal strip (for a bank behind) and one
 * vertical (for banks to the side), drawn once and reused.
 */
const ensureFoamTextures = (scene: Phaser.Scene): { h: string; v: string } => {
  const h = "dfoam:h", v = "dfoam:v";
  const LEN = 96, DEEP = 14;
  const paint = (ctx: CanvasRenderingContext2D, along: (a: number, d: number) => [number, number]) => {
    let s = 4242;
    const rnd = () => { s = (s * 1103515245 + 12345) >>> 0; return (s >>> 8) / 16777216; };
    // Soft body: bright at the bank, gone a few px out.
    for (let d = 0; d < DEEP; d++) {
      const a = Math.pow(1 - d / DEEP, 2.2) * 0.55;
      ctx.fillStyle = `rgba(236,248,252,${a.toFixed(3)})`;
      for (let i = 0; i < LEN; i++) {
        const [x, y] = along(i, d);
        ctx.fillRect(x, y, 1, 1);
      }
    }
    // Broken crest: blobs strung along the edge, a few drifting out.
    for (let i = 0; i < 26; i++) {
      const a = rnd() * LEN, d = Math.pow(rnd(), 2) * (DEEP * 0.7), r = 1 + rnd() * 2.2;
      const [x, y] = along(a, d + r * 0.5);
      ctx.fillStyle = `rgba(250,254,255,${(0.55 + rnd() * 0.4).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  if (!scene.textures.exists(h)) {
    const tex = scene.textures.createCanvas(h, LEN, DEEP);
    if (tex) { paint(tex.getContext(), (a, d) => [a, d]); tex.refresh(); }
  }
  if (!scene.textures.exists(v)) {
    const tex = scene.textures.createCanvas(v, DEEP, LEN);
    if (tex) { paint(tex.getContext(), (a, d) => [d, a]); tex.refresh(); }
  }
  return { h, v };
};

/**
 * Where a prop's visible base is, as an origin-y fraction: the lowest row
 * of its texture that has any opaque pixel. Obstacle art isn't bottom-
 * aligned (a rock ends at row 33 of 48, a throne at 48), so anchoring the
 * image's bottom edge to the ground floated some props and buried others.
 */
const baseCache = new Map<string, number>();
const propBaseOrigin = (scene: Phaser.Scene, key: string): number => {
  const hit = baseCache.get(key);
  if (hit !== undefined) return hit;
  const src = sourceOf(scene, key);
  let origin = 0.9;
  try {
    const c = document.createElement("canvas");
    c.width = src.width;
    c.height = src.height;
    const ctx = c.getContext("2d");
    if (ctx) {
      ctx.drawImage(src, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height).data;
      scan: for (let y = c.height - 1; y >= 0; y--) {
        for (let x = 0; x < c.width; x++) {
          if (data[(y * c.width + x) * 4 + 3]! > 24) { origin = (y + 1) / c.height; break scan; }
        }
      }
    }
  } catch {
    // A tainted canvas can't be read back — the default is close enough.
  }
  baseCache.set(key, origin);
  return origin;
};

export interface DioramaOptions {
  /** How far below a tile's top-face centre an actor's feet go. */
  footDY: number;
  /** Seed for per-cell variation (stable per map). */
  seed: number;
  /** Tile height in levels. Pass () => 0 for the flat board. */
  elevationAt: (x: number, y: number) => number;
  /** World px per level (0 on the flat board — nothing is drawn raised). */
  elevStep: number;
  /** Cast shadows from the sun (render/sun). Omit for no sun: dark battles, the flat board. */
  sun?: Sun;
  /** No sun, but props near a flame throw shadows away from it (dark battles). */
  torchShadows?: boolean;
}

export interface DioramaResult {
  /** World positions of every flame, for lights and the darkness overlay. */
  lights: { x: number; y: number; radius: number }[];
}

/**
 * Build the board. Every object is a world object created during the
 * scene's setup sweep, before the UI-camera snapshot, so the UI camera
 * never double-draws any of it.
 */
export const buildDiorama = (
  scene: Phaser.Scene,
  grid: Grid,
  projection: Projection,
  opts: DioramaOptions
): DioramaResult => {
  const W = grid.width, H = grid.height;
  // World px a tile stands above the ground plane. Off the board reads as
  // -Infinity so the map edge never casts occlusion onto the tiles along it.
  const elev = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= W || y >= H) return Number.NEGATIVE_INFINITY;
    return opts.elevationAt(x, y) * opts.elevStep;
  };
  const ao = ensureAoTextures(scene);
  const shimmerKey = ensureShimmerTexture(scene);
  const foam = ensureFoamTextures(scene);
  const raised = opts.elevStep > 0;
  const isWater = (x: number, y: number): boolean =>
    x >= 0 && y >= 0 && x < W && y < H && grid.tileAt({ x, y }).terrain === "water";
  // One overlay layer per row — grid lines and edge light, sorted with the
  // row so a raised row in front covers them (terrainOverlayDepth).
  const rowG = Array.from({ length: H }, (_, y) =>
    scene.add.graphics().setDepth(terrainOverlayDepth(y)));
  const lights: DioramaResult["lights"] = [];
  // Props that could throw a torch shadow — resolved once every flame on
  // the board is known.
  const shadowCasters: Phaser.GameObjects.Image[] = [];

  // Board shadow — the diorama sitting on the world. Drawn first so the
  // board paints over its own shadow.
  const b = projection.bounds();
  const shadow = scene.add.image(b.x + b.w / 2, b.y + b.h + 6, ensureDotTexture(scene));
  shadow.setTint(0x000000).setAlpha(0.7).setDisplaySize(b.w * 1.22, Math.max(70, b.h * 0.26));
  shadow.setDepth(DEPTH.BOARD_SHADOW);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const tile = grid.tileAt({ x, y });
      const t = { x, y };
      const top = projection.topFace(t);
      const key = projection.depthKey(t);
      const hash = ((x * 73856093) ^ (y * 19349663) ^ (opts.seed * 83492791)) >>> 0;
      const hereUp = elev(x, y);

      // ---- top face -------------------------------------------------
      // A raised wall shows its brick on the FACE; seen from above, its top
      // is capstone. Brick painted on both read as a dark hole, not a block.
      const levelsUp = raised ? opts.elevationAt(x, y) : 0;
      const capped = tile.terrain === "wall" && levelsUp > 0;
      const topTerrain = capped ? "stone" : tile.terrain;
      const baseKey = ensureTileTexture(scene, topTerrain, opts.seed + (x * 73 + y * 131));
      const smooth = SMOOTH.has(topTerrain);
      const quarter = ISOTROPIC.has(topTerrain) && !smooth ? (hash >> 2) & 3 : 0;
      const topImg = scene.add.image(top.x, top.y, ensureRotated(scene, baseKey, quarter))
        .setOrigin(0, 0)
        .setDisplaySize(top.w, top.h)
        .setDepth(terrainDepth(key));
      topImg.setFlipX((hash & 1) === 1);
      if (ISOTROPIC.has(topTerrain)) topImg.setFlipY((hash & 2) === 2);
      // Brightness: a little per-cell jitter against wallpaper repetition,
      // plus height — high ground catches more light, sunk water less.
      const jitter = (hash >> 4) % (smooth ? 5 : 11);
      const lum = Math.max(0xa0, Math.min(0xff, 0xf2 + jitter + Math.round(levelsUp * 5)));
      // Capstone is cooler and paler than the warm flagstone it borrows.
      topImg.setTint(capped
        ? (Math.min(0xff, lum - 0x08) << 16) | (lum << 8) | Math.min(0xff, lum + 0x06)
        : (lum << 16) | (lum << 8) | lum);

      if (tile.terrain === "water") {
        // Deep water reads darker and cooler than the bank above it — the
        // painted texture is a bright shallow-lagoon teal, which on its own
        // read as a flat plate rather than something you could drown in.
        topImg.setTint(raised ? 0x92b8cc : 0xb8d4e0);
        const sh = scene.add.image(top.x + top.w / 2, top.y + top.h / 2, shimmerKey)
          .setDisplaySize(top.w, top.h)
          .setBlendMode(Phaser.BlendModes.ADD)
          .setAlpha(0.2)
          .setDepth(terrainOverlayDepth(y));
        sh.setFlipX((hash & 8) === 8);
        scene.tweens.add({
          targets: sh,
          alpha: { from: 0.12, to: 0.42 },
          x: sh.x + 3,
          duration: 1400 + (hash % 900),
          delay: hash % 1200,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut"
        });
        // Foam along every bank: behind (the edge under the bank's wall)
        // and to either side. Off the board is open water — no bank, no
        // foam. The bank in FRONT hides this tile's near edge, so none there.
        const lap = (img: Phaser.GameObjects.Image, phase: number) => {
          img.setDepth(terrainOverlayDepth(y)).setAlpha(0.5);
          scene.tweens.add({
            targets: img,
            alpha: { from: 0.42, to: 0.85 },
            duration: 1700 + (hash % 700),
            delay: (hash + phase) % 1500,
            yoyo: true,
            repeat: -1,
            ease: "Sine.easeInOut"
          });
        };
        if (y > 0 && !isWater(x, y - 1)) {
          lap(scene.add.image(top.x, top.y, foam.h).setOrigin(0, 0).setDisplaySize(top.w, 8)
            .setFlipX((hash & 16) === 16), 0);
        }
        if (x > 0 && !isWater(x - 1, y)) {
          lap(scene.add.image(top.x, top.y, foam.v).setOrigin(0, 0).setDisplaySize(7, top.h)
            .setFlipY((hash & 32) === 32), 400);
        }
        if (x < W - 1 && !isWater(x + 1, y)) {
          lap(scene.add.image(top.x + top.w, top.y, foam.v).setOrigin(1, 0).setDisplaySize(7, top.h)
            .setFlipX(true).setFlipY((hash & 64) === 64), 800);
        }
      }

      // ---- front face (the wall this height exposes) -----------------
      const fh = projection.frontFaceHeight(t);
      if (fh > 0) {
        scene.add.image(top.x, top.y + top.h, ensureFaceTexture(scene, tile.terrain))
          .setOrigin(0, 0)
          .setDisplaySize(top.w, fh)
          .setDepth(terrainDepth(key) + 5e-5);
        if (LIPPED.has(tile.terrain)) {
          scene.add.image(top.x, top.y + top.h - 1, ensureLipTexture(scene, tile.terrain))
            .setOrigin(0, 0)
            .setDisplaySize(top.w, 4)
            .setDepth(terrainDepth(key) + 6e-5);
        } else {
          // Hard edges catch the light instead of drooping.
          rowG[y]!.lineStyle(1, 0xfff2dc, capped ? 0.26 : 0.16);
          rowG[y]!.lineBetween(top.x, top.y + top.h - 0.5, top.x + top.w, top.y + top.h - 0.5);
        }
      }
      // Side edges of a raised top: the sun is north-west, so an edge
      // standing over lower ground to the west catches light and one over
      // lower ground to the east falls into shade. This is what makes a
      // block read as a block when there are no side faces to draw.
      if (hereUp > 0 && tile.terrain !== "water") {
        const g = rowG[y]!;
        if (elev(x - 1, y) < hereUp) {
          g.lineStyle(1, 0xfff2dc, 0.2);
          g.lineBetween(top.x + 0.5, top.y, top.x + 0.5, top.y + top.h);
        }
        if (elev(x + 1, y) < hereUp) {
          g.lineStyle(1.5, 0x08060e, 0.35);
          g.lineBetween(top.x + top.w - 0.75, top.y, top.x + top.w - 0.75, top.y + top.h);
        }
        if (elev(x, y - 1) < hereUp) {
          g.lineStyle(1, 0xfff2dc, 0.14);
          g.lineBetween(top.x, top.y + 0.5, top.x + top.w, top.y + 0.5);
        }
      }

      // ---- ambient occlusion from taller neighbours -------------------
      const behind = elev(x, y - 1) - hereUp;
      if (behind > 0) {
        scene.add.image(top.x, top.y, ao.v).setOrigin(0, 0)
          .setDisplaySize(top.w, Math.min(top.h * 0.55, 6 + behind * 0.45))
          .setAlpha(Math.min(1, 0.55 + behind / 60))
          .setDepth(terrainOverlayDepth(y));
      }
      const left = elev(x - 1, y) - hereUp;
      if (left > 0) {
        scene.add.image(top.x, top.y, ao.h).setOrigin(0, 0)
          .setDisplaySize(Math.min(top.w * 0.4, 5 + left * 0.4), top.h)
          .setDepth(terrainOverlayDepth(y));
      }
      const right = elev(x + 1, y) - hereUp;
      if (right > 0) {
        scene.add.image(top.x + top.w, top.y, ao.h).setOrigin(0, 0)
          .setDisplaySize(Math.min(top.w * 0.3, 4 + right * 0.3), top.h)
          .setFlipX(true).setOrigin(1, 0)
          .setAlpha(0.6)
          .setDepth(terrainOverlayDepth(y));
      }

      // Faint grid: legibility without the old checkerboard look. Fainter
      // still on water, where hard lines read as tiles, not waves.
      rowG[y]!.lineStyle(1, 0x000000, tile.terrain === "water" ? 0.05 : 0.085);
      rowG[y]!.strokeRect(top.x + 0.5, top.y + 0.5, top.w - 1, top.h - 1);

      // ---- props -----------------------------------------------------
      const obsKey = ensureObstacleTexture(scene, tile.obstacle);
      if (obsKey) {
        const cx = top.x + top.w / 2;
        const footY = top.y + top.h / 2 + opts.footDY;
        const s = (PROP_SCALE[tile.obstacle] ?? 1);
        const wobble = tile.obstacle === "torch" || tile.obstacle === "throne"
          ? 1
          : 0.96 + ((hash >> 6) % 9) / 100;
        const size = top.w * s * wobble;
        scene.add.ellipse(cx, footY - 1, top.w * 0.66 * s, top.w * 0.17, 0x000000, 0.3)
          .setDepth(DEPTH.SHADOW);
        const baseOrigin = propBaseOrigin(scene, obsKey);
        const obs = scene.add.image(cx, footY, obsKey)
          .setOrigin(0.5, baseOrigin)
          .setDisplaySize(size, size)
          // A hair behind any unit sharing the tile (fence, barricade and
          // throne are walkable): the soldier stands AT the barricade.
          .setDepth(actorDepth(footY - 0.5));
        if (tile.obstacle !== "torch" && tile.obstacle !== "throne") obs.setFlipX((hash & 4) === 4);
        // The prop's own shadow across the ground. Not for a torch: it is
        // a light, and a flame throwing a sun-shadow reads as wrong.
        if (opts.sun && tile.obstacle !== "torch") {
          const cast = scene.add.image(cx, footY, obsKey)
            .setOrigin(0.5, baseOrigin)
            .setTintFill(0x000000)
            .setAlpha(opts.sun.alpha)
            .setDepth(DEPTH.SHADOW - 0.1);
          castFrom(cast, obs, opts.sun);
        } else if (opts.torchShadows && tile.obstacle !== "torch") {
          shadowCasters.push(obs);
        }
        if (tile.obstacle === "torch") {
          // Light pooling on the ground around the base, foreshortened
          // like the ground it lands on...
          addTorchGlow(scene, cx, footY - 2, {
            depth: DEPTH.LIGHT,
            scaleX: 2.1,
            scaleY: 2.1 * (top.h / top.w)
          });
          // ...and a halo at the flame itself, over the prop.
          const flameY = footY - size * 0.72;
          addTorchGlow(scene, cx, flameY, { depth: actorDepth(footY) + 1e-4, scaleX: 0.9, scaleY: 0.9 });
          lights.push({ x: cx, y: footY, radius: 110 });
        }
      }
    }
  }

  for (const obs of shadowCasters) {
    const lit = torchShadow(obs.x, obs.y, lights);
    if (!lit) continue;
    const cast = scene.add.image(obs.x, obs.y, obs.texture.key)
      .setOrigin(obs.originX, obs.originY)
      .setTintFill(0x000000)
      .setAlpha(lit.alpha)
      .setDepth(DEPTH.TORCH_SHADOW - 0.01);
    castFrom(cast, obs, lit);
  }

  return { lights };
};
