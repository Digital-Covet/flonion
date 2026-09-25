import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Standalone on purpose: the app's vite.config.ts loads SolidStart, Nitro and
 * the image optimizer, none of which unit tests need. Only the path aliases
 * are shared.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "~": path.resolve(import.meta.dirname, "./src"),
      "@generated": path.resolve(import.meta.dirname, "./generated"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
