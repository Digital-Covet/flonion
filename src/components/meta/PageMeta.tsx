import { Link, Meta, Title } from "@solidjs/meta";
import { Show } from "solid-js";
import {
  absoluteUrl,
  DEFAULT_OG_IMAGE,
  OG_IMAGE_ALT,
  OG_IMAGE_HEIGHT,
  OG_IMAGE_WIDTH,
  OG_LOCALE,
  SITE_ORIGIN,
} from "~/lib/site";

export type PageMetaProps = {
  title: string;
  description?: string;
  /** Root-relative path used for the canonical URL and `og:url`. */
  path: string;
  /** Root-relative or absolute; defaults to the shared 1200x630 card. */
  image?: string;
  imageAlt?: string;
  ogType?: "website" | "article";
  /** Emit `noindex, nofollow` and keep the page out of the sitemap. */
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
};

/**
 * The single source of head metadata for a page.
 *
 * `@solidjs/meta` cannot have a child override a parent `meta` by name (the
 * provider keys dedup on name *and* content), so every SEO tag is emitted in
 * exactly one place: here. In particular, do not add `<title>` or `<meta>`
 * tags to `entry-server.tsx` — the Solid Meta docs call that out as overriding
 * the provider.
 */
export function PageMeta(props: PageMetaProps) {
  const canonical = () => new URL(props.path, SITE_ORIGIN).toString();

  const image = () => {
    const value = props.image ?? DEFAULT_OG_IMAGE;
    return /^https?:\/\//.test(value) ? value : absoluteUrl(value);
  };

  return (
    <>
      <Title>{props.title}</Title>

      <Show when={props.description}>
        {(description) => (
          <>
            <Meta name="description" content={description()} />
            <Meta property="og:description" content={description()} />
            <Meta name="twitter:description" content={description()} />
          </>
        )}
      </Show>

      <Show when={props.noindex}>
        <Meta name="robots" content="noindex, nofollow" />
      </Show>

      <Link rel="canonical" href={canonical()} />

      <Meta property="og:type" content={props.ogType ?? "website"} />
      <Meta property="og:site_name" content="Flonion" />
      <Meta property="og:locale" content={OG_LOCALE} />
      <Meta property="og:title" content={props.title} />
      <Meta property="og:url" content={canonical()} />
      <Meta property="og:image" content={image()} />
      <Meta property="og:image:width" content={OG_IMAGE_WIDTH} />
      <Meta property="og:image:height" content={OG_IMAGE_HEIGHT} />
      <Meta property="og:image:alt" content={props.imageAlt ?? OG_IMAGE_ALT} />

      <Meta name="twitter:card" content="summary_large_image" />
      <Meta name="twitter:title" content={props.title} />
      <Meta name="twitter:image" content={image()} />
      <Meta name="twitter:image:alt" content={props.imageAlt ?? OG_IMAGE_ALT} />

      <Show when={props.jsonLd}>
        {(data) => (
          <script
            type="application/ld+json"
            innerHTML={JSON.stringify(data()).replace(/</g, "\\u003c")}
          />
        )}
      </Show>
    </>
  );
}
