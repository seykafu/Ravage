// Cache-bust integrity. Streamed assets deploy at stable urls with a
// day of browser cache, so versionedPath() appends a content hash from
// assetVersions.gen.ts — WHICH MUST MATCH THE BYTES ON DISK, or a
// re-dropped file ships under its old ?v= and returning players keep
// seeing the old art for a day (real incident: Veya's final sprite).
// `npm test` / `npm run build` regenerate the map automatically; this
// guard catches a bare `npx vitest` after an art drop, or a forgotten
// commit of the regenerated file.

import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { ASSET_VERSIONS } from "../assetVersions.gen";
import { versionedPath } from "../manifest";

const PUB = join(__dirname, "..", "..", "..", "public");
const REGEN = "run `node scripts/hashAssets.mjs` and commit the regenerated map";

const walk = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : e.name.endsWith(".md") ? [] : [p];
  });

describe("asset version map", () => {
  it("matches the bytes on disk for every streamed file", () => {
    const files = ["assets", "audio"].flatMap((d) => walk(join(PUB, d)));
    expect(files.length).toBeGreaterThan(100);
    const onDisk = new Set<string>();
    for (const p of files) {
      const key = relative(PUB, p).replaceAll("\\", "/");
      onDisk.add(key);
      const hash = createHash("md5").update(readFileSync(p)).digest("hex").slice(0, 10);
      expect(ASSET_VERSIONS[key], `${key}: stale/missing hash — ${REGEN}`).toBe(hash);
    }
    for (const key of Object.keys(ASSET_VERSIONS)) {
      expect(onDisk.has(key), `${key}: hashed file no longer exists — ${REGEN}`).toBe(true);
    }
  });

  it("versionedPath appends ?v= for hashed files and passes unknown paths through", () => {
    const key = "assets/sprites/lenscaster/idle.png";
    expect(versionedPath(key)).toBe(`${key}?v=${ASSET_VERSIONS[key]}`);
    expect(versionedPath("assets/sprites/khan/idle.png")).toBe("assets/sprites/khan/idle.png");
  });
});
