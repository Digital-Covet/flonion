import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { solidStart } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { defineConfig, type Plugin } from "vite";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";

/**
 * `@tabler/icons-solidjs` is a barrel of ~6,000 icon modules. Solid libraries
 * skip dependency pre-bundling, so in dev every page that imports one icon made
 * Vite transform (and the browser fetch) the entire set. This rewrites
 * `import { IconStar } from "@tabler/icons-solidjs"` into one import per icon
 * file, so only the icons actually used are loaded.
 */
function tablerIconsDirectImports(): Plugin {
  const pkg = "@tabler/icons-solidjs";
  const require = createRequire(import.meta.url);
  // The package doesn't export package.json; its CJS entry is dist/cjs/*.js.
  const sourceDir = path.resolve(
    path.dirname(require.resolve(pkg)),
    "../source",
  );
  // Deprecated names (e.g. Icon123) re-export a differently named file.
  const aliases = new Map(
    [
      ...readFileSync(path.join(sourceDir, "aliases.js"), "utf8").matchAll(
        /export \{ default as (\w+) \} from '\.\/icons\/(\w+)'/g,
      ),
    ].map(([, name, file]) => [name, file]),
  );
  const importRe = new RegExp(
    `import\\s*\\{([^}]*)\\}\\s*from\\s*["']${pkg}["'];?`,
    "g",
  );
  const iconPrefix = `${pkg}/icons/`;

  return {
    name: "tabler-icons-direct-imports",
    enforce: "pre",
    resolveId(id) {
      if (!id.startsWith(iconPrefix)) return null;
      return path.join(sourceDir, "icons", `${id.slice(iconPrefix.length)}.js`);
    },
    transform(code, id) {
      if (id.includes("node_modules") || !code.includes(pkg)) return null;
      if (!/\.[cm]?[jt]sx?(\?|$)/.test(id)) return null;
      let changed = false;
      const out = code.replace(importRe, (whole, specifiers: string) => {
        const lines: string[] = [];
        for (const raw of specifiers.split(",")) {
          const spec = raw.trim();
          if (!spec) continue;
          if (spec.startsWith("type ")) continue; // erased by TypeScript
          const [imported, local = imported] = spec.split(/\s+as\s+/);
          const file = aliases.get(imported) ?? imported;
          if (!existsSync(path.join(sourceDir, "icons", `${file}.js`))) {
            return whole; // not an icon (e.g. createSolidComponent): leave as is
          }
          lines.push(`import ${local} from "${iconPrefix}${file}";`);
        }
        changed = true;
        return lines.join("\n");
      });
      return changed ? { code: out, map: null } : null;
    },
  };
}

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
    tablerIconsDirectImports(),
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
