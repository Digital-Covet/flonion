import path from "node:path";
import { solidStart } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";

export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "~": path.resolve(import.meta.dirname, "./src"),
      "@generated": path.resolve(import.meta.dirname, "./generated"),
    },
  },
  // The SolidStart dev error overlay imports these CommonJS packages; without
  // pre-bundling, the browser gets the raw files and the ESM imports fail.
  optimizeDeps: {
    include: [
      "@solidjs/start > source-map-js",
      "@solidjs/start > error-stack-parser",
    ],
  },
  plugins: [
    solidStart({ middleware: "./src/middleware.ts" }),
    tailwindcss(),
    ViteImageOptimizer({
      webp: { quality: 80 },
      png: { quality: 80 },
      jpeg: { quality: 80 },
      jpg: { quality: 80 },
    }),
    ...(command === "build" ? [nitro()] : []),
  ],
}));
