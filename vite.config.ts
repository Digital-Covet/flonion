import path from "path";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import tailwindcss from '@tailwindcss/vite';
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';
import { solidStart } from "@solidjs/start/config";

export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "~": path.resolve(import.meta.dirname, "./src"),
      "@generated": path.resolve(import.meta.dirname, "./generated")
    },
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
    ...(command === 'build' ? [nitro()] : []),
  ],
}));
