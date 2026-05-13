// Vitest configuration for the combat-math test suite.
//
// Pure-node environment — these tests cover the deterministic core
// (damage formulas, stance gating, XP curve, equipment passives,
// initiative, AI decisions). Anything that needs Phaser, the DOM, or
// the scene graph is intentionally OUT OF SCOPE for this suite — those
// integration paths belong in playthrough verification, not unit tests.
//
// Strict-mode TypeScript is enforced by `npm run build` (which runs
// `tsc -b` against the same source tree), so this config doesn't
// re-enable type-checking — it just runs the tests.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Lock the seed-style RNG used by many tests to deterministic output
    // by NOT mocking timers or anything else here. Tests that need
    // randomness create their own seeded Rng (src/util/rng.ts).
    reporters: ["default"]
  }
});
