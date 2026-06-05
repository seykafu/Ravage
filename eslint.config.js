// ESLint flat config (ESLint v9+). Replaces the legacy .eslintrc format.
//
// Goals for THIS codebase:
//   * Catch real mistakes: unused vars, accidental globals, unsafe comparisons,
//     fallthrough, `==` vs `===`, unreachable code.
//   * Be TypeScript-aware without the full type-checked ruleset — type-checked
//     linting is powerful but slow and noisy on a 2,900-line scene file, and
//     `tsc --noEmit` already covers type correctness in CI/build.
//   * NOT fight the deliberate patterns the game relies on: Phaser interop
//     casts through `unknown`/`any`, `void expr` to mark intentional
//     fire-and-forget / unused-import suppressions, and `_`-prefixed unused
//     args (event handlers that ignore some params).
//
// Run with `npm run lint` (added to package.json). Scoped to src/.

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  // Ignore build output, deps, and generated/asset dirs.
  {
    ignores: ["dist/**", "node_modules/**", "public/**", "*.config.js", "*.config.ts"]
  },

  // Base JS recommended rules.
  js.configs.recommended,

  // TypeScript recommended (syntactic — no type-info program required, so it's
  // fast and doesn't need a tsconfig wired into the linter).
  ...tseslint.configs.recommended,

  // Project-specific tuning.
  {
    files: ["src/**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        // Browser runtime globals the game uses (config is type-only here;
        // these just stop `no-undef` from flagging them).
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        setInterval: "readonly",
        clearInterval: "readonly",
        requestAnimationFrame: "readonly",
        localStorage: "readonly",
        fetch: "readonly",
        HTMLCanvasElement: "readonly",
        HTMLElement: "readonly",
        AudioContext: "readonly"
      }
    },
    rules: {
      // ---- Unused code: warn, but respect intentional `_`-prefix opt-out ----
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none" // `catch {}` / `catch (e) {}` swallow patterns are intentional
        }
      ],

      // ---- Phaser interop reality ----
      // The codebase casts through `any`/`unknown` to reach Phaser internals
      // (WebAudioSound, ScrollFactor mixin quirks, CameraManager patching).
      // These are deliberate and commented at each site; downgrade to warn so
      // they're visible without failing the build.
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "off",

      // `void someExpr;` is used intentionally to (a) mark a kept-but-unused
      // import and (b) fire-and-forget a promise. Allow it.
      "no-void": "off",
      "@typescript-eslint/no-floating-promises": "off", // not enabled (needs type info) — explicit for clarity

      // ---- Real-bug guards: keep as errors ----
      "eqeqeq": ["error", "always", { null: "ignore" }],
      "no-fallthrough": "error",
      "no-unreachable": "error",
      "no-constant-condition": ["error", { checkLoops: false }],

      // Empty blocks are often intentional here (catch {}), so allow empty
      // catch/blocks but still flag empty functions you forgot to fill.
      "no-empty": ["error", { allowEmptyCatch: true }]
    }
  }
);
