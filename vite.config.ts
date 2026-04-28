import { defineConfig } from "vite";
import { resolve } from "path";

// Multi-page build:
//   /        → marketing landing page (root index.html)
//   /play/   → the game itself (play/index.html, bootstraps src/main.ts)
//
// `base` is "/" (absolute) rather than "./" so that assets emitted under
// dist/assets/ resolve correctly from any route. The Phaser loader pins its
// own baseURL to "/" in BootScene for the same reason — manifest entries
// like "assets/foo.png" must always fetch from the site root, not from
// /play/assets/foo.png.
export default defineConfig({
  base: "/",
  server: { port: 5173, host: true },
  build: {
    target: "es2022",
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        play: resolve(__dirname, "play/index.html")
      },
      output: {
        // Pull Phaser into its own chunk so it caches across game-code deploys.
        // The framework rarely changes; the game code changes constantly.
        manualChunks: {
          phaser: ["phaser"]
        }
      }
    },
    chunkSizeWarningLimit: 1500
  }
});
