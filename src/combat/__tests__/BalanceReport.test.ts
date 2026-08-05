// Campaign balance guardrails + printed difficulty curve.
//
// simulateCampaign() models every playable battle's expected exchange
// using the real damage pipeline (see BalanceSim.ts). This test prints
// the curve for humans and asserts the bounds that keep the campaign
// honest:
//
//   * Rank-and-file must take a real number of swings to kill (no
//     one-tap chaff) AND must genuinely threaten the squad (no
//     invulnerable-hero syndrome).
//   * Bosses must out-pressure their own mooks and survive a focused
//     squad long enough to matter.
//
// If a stat edit or a new battle breaks these bounds, this test fails
// CI instead of the campaign shipping soft.

import { describe, it, expect } from "vitest";
import { simulateCampaign } from "../BalanceSim";

const fmt = (n: number | null): string => (n === null ? "  —  " : n.toFixed(1).padStart(5));

describe("campaign difficulty curve", () => {
  const rows = simulateCampaign();

  it("prints the curve", () => {
    const header =
      "battle".padEnd(34) +
      "lvl".padStart(4) +
      "mooks".padStart(6) +
      "P kills mook".padStart(14) +
      "mook kills P".padStart(14) +
      "P kills boss".padStart(14) +
      "boss kills P".padStart(14);
    const lines = rows.map((r) =>
      r.label.padEnd(34) +
      String(r.squadLevel).padStart(4) +
      String(r.mookCount).padStart(6) +
      fmt(r.playerHtkMook).padStart(14) +
      fmt(r.enemyHtkPlayer).padStart(14) +
      fmt(r.playerHtkBoss).padStart(14) +
      fmt(r.bossHtkPlayer).padStart(14)
    );
    // eslint-disable-next-line no-console
    console.log("\n" + header + "\n" + "-".repeat(header.length) + "\n" + lines.join("\n") + "\n");
    expect(rows.length).toBeGreaterThan(20);
  });

  // B1 is the scripted-loss tutorial (baseline-exempt in Difficulty.ts)
  // — its numbers are intentionally hopeless and sit outside every bound.
  const bounded = rows.filter((r) => r.label !== "b01_palace_coup");

  it("rank-and-file take real effort to kill everywhere (no one-tap chaff)", () => {
    for (const r of bounded.filter((r) => r.mookCount > 0)) {
      expect(r.playerHtkMook, `${r.label}: mooks die too fast`).toBeGreaterThanOrEqual(1.8);
      expect(r.playerHtkMook, `${r.label}: mooks too spongy`).toBeLessThanOrEqual(6);
    }
  });

  it("rank-and-file genuinely threaten the squad everywhere (no invulnerable heroes)", () => {
    for (const r of bounded.filter((r) => r.mookCount > 0)) {
      // Read as: a full enemy roster focusing one unit downs them in
      // roughly (bound / mookCount) rounds. Pre-scaling this number ran
      // 44-86 across the whole second half.
      expect(r.enemyHtkPlayer, `${r.label}: enemies can't hurt the squad`).toBeLessThanOrEqual(24);
      expect(r.enemyHtkPlayer, `${r.label}: enemies shred the squad`).toBeGreaterThanOrEqual(3.5);
    }
  });

  it("bosses survive focus and keep pressuring near their escort's level", () => {
    for (const r of bounded.filter((r) => r.bossHtkPlayer !== null)) {
      expect(r.bossHtkPlayer!, `${r.label}: boss badly out-pressured by own mooks`).toBeLessThanOrEqual(r.enemyHtkPlayer * 1.6);
      expect(r.playerHtkBoss!, `${r.label}: boss folds too fast`).toBeGreaterThanOrEqual(3);
      expect(r.playerHtkBoss!, `${r.label}: boss is a slog`).toBeLessThanOrEqual(14);
    }
  });
});
