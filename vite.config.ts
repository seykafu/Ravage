import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: { port: 5173, host: true },
  build: {
    target: "es2022",
    sourcemap: true,
    // Pull Phaser into its own chunk so it caches across game-code deploys.
    // The framework rarely changes; the game code changes constantly.
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ["phaser"]
        }
      }
    },
    chunkSizeWarningLimit: 1500
  }
});
