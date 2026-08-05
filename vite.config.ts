import path from "path";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import tailwindcss from '@tailwindcss/vite'
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
    ...(command === 'build' ? [nitro()] : []),
  ],
}));
