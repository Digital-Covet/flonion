import path from "path";
import { defineConfig } from "vite";
import { nitro } from "nitro/vite";
import tailwindcss from '@tailwindcss/vite'
import { solidStart } from "@solidjs/start/config";

export default defineConfig(({ command }) => ({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "~": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    solidStart(),
    tailwindcss(),
    ...(command === 'build' ? [nitro()] : []),
  ],
}));
