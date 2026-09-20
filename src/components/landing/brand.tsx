import { IconSparkles, IconStar } from "@tabler/icons-solidjs";
import { For, type JSX, Show, splitProps } from "solid-js";
import { cn } from "~/lib/cn";
import { QR_DARK, QR_LIGHT, qrGeometry, qrLogoSrc } from "~/lib/qr";

/**
 * Onion Rings motif: concentric rounded rectangles whose radius grows 12px
 * per ring. Decorative only, drawn in `--motif` (primary at 14% opacity) so
 * text that crosses a ring keeps AA contrast.
 */
export function OnionRings(
  props: JSX.SvgSVGAttributes<SVGSVGElement> & { rings?: number },
) {
  const [local, rest] = splitProps(props, ["rings", "class"]);
  const count = () => Math.min(Math.max(local.rings ?? 5, 3), 5);
  const size = 560;
  const step = 52;
  return (
    <svg
      aria-hidden="true"
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      class={cn("pointer-events-none text-motif", local.class)}
      {...rest}
    >
      <For each={Array.from({ length: count() }, (_, i) => i)}>
        {(i) => {
          const inset = step * (count() - 1 - i) + 2;
          return (
            <rect
              x={inset}
              y={inset}
              width={size - inset * 2}
              height={size - inset * 2}
              rx={12 + i * 12}
              stroke="currentColor"
              stroke-width="1.5"
              vector-effect="non-scaling-stroke"
            />
          );
        }}
      </For>
    </svg>
  );
}

/** "4.6 · 212 reviews": the one way ratings are shown everywhere. */
export function RatingPill(props: {
  rating: number;
  count?: number;
  class?: string;
}) {
  return (
    <span
      class={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-sm text-text",
        props.class,
      )}
    >
      <IconStar
        aria-hidden="true"
        class="size-4 stroke-accent"
        fill="var(--star)"
        stroke-width={1.5}
      />
      <span class="font-mono font-medium tabular-nums">
        {props.rating.toFixed(1)}
      </span>
      {props.count !== undefined && (
        <span class="text-text-muted">
          · <span class="font-mono tabular-nums">{props.count}</span> reviews
        </span>
      )}
    </span>
  );
}

/** Machine-written text is always labelled: icon plus words, never icon alone. */
export function AiMarker(props: { label?: string; class?: string }) {
  return (
    <span
      class={cn(
        "inline-flex items-center gap-1 text-xs font-medium text-primary",
        props.class,
      )}
    >
      <IconSparkles aria-hidden="true" class="size-3.5" />
      {props.label ?? "AI draft"}
    </span>
  );
}

/**
 * Real, scannable QR drawn as a single SVG path (no canvas, no JS on load).
 *
 * `logo` puts the business's mark on a white plate in the middle. Passing one
 * raises the code to error correction H, so the modules it covers are still
 * recoverable; codes that must stay machine-plain (an authenticator's TOTP
 * URI, say) simply leave it off.
 */
export function QrSvg(props: {
  value: string;
  logo?: string | null;
  class?: string;
}) {
  const src = () => qrLogoSrc(props.logo);
  const geo = () => qrGeometry(props.value, Boolean(src()));
  return (
    <svg
      role="img"
      aria-label={`QR code linking to ${props.value}`}
      viewBox={`0 0 ${geo().size} ${geo().size}`}
      shape-rendering="crispEdges"
      class={props.class}
    >
      <rect width={geo().size} height={geo().size} fill={QR_LIGHT} />
      <path d={geo().path} fill={QR_DARK} />
      <Show when={src() ? geo().plate : null}>
        {(plate) => (
          <>
            <rect
              x={plate().x}
              y={plate().y}
              width={plate().side}
              height={plate().side}
              rx={plate().radius}
              fill={QR_LIGHT}
            />
            <image
              href={src() as string}
              x={plate().logo.x}
              y={plate().logo.y}
              width={plate().logo.side}
              height={plate().logo.side}
              preserveAspectRatio="xMidYMid meet"
            />
          </>
        )}
      </Show>
    </svg>
  );
}

/**
 * QR ticket stub: dashed perforation plus two semicircle notches, QR on the
 * left and the label on the right. Notches take the colour of the section
 * canvas via `--background`.
 */
export function QrTicket(props: {
  business: string;
  prompt: string;
  url: string;
  /** The business's own mark, drawn in the middle of the code. */
  logo?: string | null;
  /** Below `lg`, put the QR above the label with a horizontal perforation. */
  stack?: boolean;
  qrClass?: string;
  class?: string;
}) {
  return (
    <div
      class={cn(
        "relative flex items-stretch overflow-hidden rounded-lg border border-border bg-surface text-text shadow-[0_12px_32px_rgb(0_0_0/0.12)]",
        props.stack && "flex-col lg:flex-row",
        props.class,
      )}
    >
      <div class="grid shrink-0 place-items-center p-4">
        <QrSvg
          value={props.url}
          logo={props.logo}
          class={cn("size-24 rounded-sm sm:size-28", props.qrClass)}
        />
      </div>
      <div
        class={cn(
          "relative flex flex-col justify-center gap-1 border-dashed border-border-strong py-4 pr-5 pl-5",
          props.stack
            ? "border-t text-center lg:border-t-0 lg:border-l lg:text-left"
            : "border-l",
        )}
      >
        <span
          aria-hidden="true"
          class="absolute -top-2 -left-2 size-4 rounded-full border border-border bg-background"
        />
        <span
          aria-hidden="true"
          class={cn(
            "absolute size-4 rounded-full border border-border bg-background",
            props.stack
              ? "-top-2 -right-2 lg:-bottom-2 lg:top-auto lg:right-auto lg:-left-2"
              : "-bottom-2 -left-2",
          )}
        />
        <span class="font-display text-lg font-semibold leading-tight">
          {props.business}
        </span>
        <span class="text-sm text-text-muted">{props.prompt}</span>
        <span class="mt-1 text-xs text-text-muted">Powered by Flonion</span>
      </div>
    </div>
  );
}

export function SectionHeading(props: {
  eyebrow: string;
  title: string;
  lead?: string;
  id?: string;
  class?: string;
}) {
  return (
    <div class={cn("max-w-2xl", props.class)}>
      <p class="font-display text-sm font-semibold tracking-wide text-primary uppercase">
        {props.eyebrow}
      </p>
      <h2
        id={props.id}
        class="mt-3 font-display text-2xl font-semibold text-balance text-text md:text-3xl"
      >
        {props.title}
      </h2>
      {props.lead && (
        <p class="mt-4 text-base text-pretty text-text-muted md:text-lg">
          {props.lead}
        </p>
      )}
    </div>
  );
}
