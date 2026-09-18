import "dotenv/config";
// @refresh reload
import { createHandler, StartServer } from "@solidjs/start/server";

/**
 * Document shell.
 *
 * Only tags `@solidjs/meta` cannot manage live here. Do NOT add `<title>` or
 * SEO `<meta>` tags to this file: the Solid Meta docs warn that a normal
 * `<title>` in `entry-server` overrides the provider, and route-level metas
 * would simply be appended alongside them. Every page's metadata comes from
 * `<PageMeta>` in `~/components/meta/PageMeta`.
 */
export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en-IN">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta
            name="theme-color"
            content="#faf8f5"
            media="(prefers-color-scheme: light)"
          />
          <meta
            name="theme-color"
            content="#120f17"
            media="(prefers-color-scheme: dark)"
          />
          <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/site.webmanifest" />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
