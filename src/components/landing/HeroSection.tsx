import { A } from "@solidjs/router";
import ArrowRight from "lucide-solid/icons/arrow-right";
import QrCode from "lucide-solid/icons/qr-code";
import Star from "lucide-solid/icons/star";
import QRCode from "qrcode";
import { createSignal, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";

export default function HeroSection() {
  // Decorative QR tile rendered client-side after first paint so it never
  // blocks LCP (DS §5). Fixed 96px box holds layout → CLS ≤ 0.1.
  const [qrDataUrl, setQrDataUrl] = createSignal<string | null>(null);

  onMount(() => {
    if (isServer) return;
    const idle = (
      window as Window & { requestIdleCallback?: (cb: () => void) => number }
    ).requestIdleCallback;
    const render = () => {
      QRCode.toDataURL(`${window.location.origin}/signup`, {
        width: 192,
        margin: 1,
        errorCorrectionLevel: "M",
      }).then(setQrDataUrl, () => setQrDataUrl(null));
    };
    if (idle) idle(render);
    else setTimeout(render, 800);
  });

  return (
    <section class="hero-gradient relative overflow-hidden px-4 pb-16 pt-16 md:px-8 md:pb-24 md:pt-24">
      <div class="relative z-10 mx-auto grid max-w-[1120px] items-center gap-12 lg:grid-cols-[7fr_5fr]">
        <div>
          <p class="mb-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-medium text-muted-foreground">
            <span
              class="inline-block size-2 rounded-full bg-secondary"
              aria-hidden="true"
            />
            QR capture · AI replies · Local SEO
          </p>
          <h1 class="font-heading text-hero font-semibold text-foreground">
            Turn happy customers into{" "}
            <span class="accent-gradient">public reviews</span>
          </h1>
          <p class="mb-8 mt-5 max-w-xl text-base leading-[1.6] text-muted-foreground">
            Flonion gives local shops, clinics, and salons a QR link, a fast
            review inbox with editable AI drafts, and a local-SEO checklist — so
            reputation work takes minutes, not evenings.
          </p>
          <div class="flex flex-col gap-3 sm:flex-row">
            <A
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-[180ms] hover:bg-primary-hover motion-reduce:transition-none"
              href="/signup"
            >
              Get started free
              <ArrowRight size={18} aria-hidden="true" />
            </A>
            <a
              class="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-input bg-card px-8 py-3.5 text-sm font-medium text-card-foreground transition-opacity duration-[180ms] hover:bg-muted motion-reduce:transition-none"
              href="#how-it-works"
            >
              See how it works
            </a>
          </div>

          <div class="mt-6 flex items-center gap-2 text-sm">
            <span
              class="flex text-star"
              role="img"
              aria-label="Rated 4.8 out of 5"
            >
              {[0, 1, 2, 3, 4].map(() => (
                <Star size={16} class="fill-star" aria-hidden="true" />
              ))}
            </span>
            <span class="tnum font-medium text-foreground">4.8</span>
            <span class="text-muted-foreground">
              from 800+ local businesses
            </span>
          </div>
          <p class="mt-3 max-w-md text-xs leading-relaxed text-muted-foreground">
            AI suggestions are always labelled drafts — you edit and approve
            before anything goes public.
          </p>
        </div>

        {/* Static hero visual (DS §6: static hero image as LCP). Opaque
            card, 12px radius, 32px padding — no tilt, float, or glass blur. */}
        <div class="rounded-xl border border-border bg-card p-8 shadow-md">
          <div class="flex items-center justify-between gap-4 border-b border-border pb-4">
            <p class="font-heading text-lg font-semibold text-card-foreground">
              Swaad Restaurant
            </p>
            <p class="inline-flex items-center gap-1.5 rounded-full bg-success-muted px-3 py-1 text-xs font-medium text-success">
              <span
                class="inline-block size-1.5 rounded-full bg-success"
                aria-hidden="true"
              />
              Google connected
            </p>
          </div>
          <dl class="grid grid-cols-2 gap-4 py-5">
            <div class="rounded-xl border border-border bg-background p-4">
              <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Avg rating
              </dt>
              <dd class="tnum mt-1 font-heading text-2xl font-semibold text-card-foreground">
                4.8 <span class="text-base text-star-text">★</span>
              </dd>
            </div>
            <div class="rounded-xl border border-border bg-background p-4">
              <dt class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Unreplied
              </dt>
              <dd class="tnum mt-1 font-heading text-2xl font-semibold text-card-foreground">
                3
              </dd>
            </div>
          </dl>
          <div class="flex items-center gap-4 rounded-xl border border-border bg-background p-4">
            <div class="grid size-24 shrink-0 place-items-center overflow-hidden rounded-lg border border-border bg-white p-1.5">
              <Show
                when={qrDataUrl()}
                fallback={
                  <QrCode
                    size={28}
                    class="text-muted-foreground"
                    aria-hidden="true"
                  />
                }
              >
                <img
                  src={qrDataUrl()!}
                  alt=""
                  aria-hidden="true"
                  width={96}
                  height={96}
                  class="h-full w-full object-contain"
                  loading="lazy"
                  decoding="async"
                />
              </Show>
            </div>
            <div>
              <p class="text-sm font-medium text-card-foreground">
                Scan to leave a review
              </p>
              <p class="tnum mt-0.5 font-mono text-xs text-muted-foreground">
                flonion.ai/r/swaad
              </p>
              <p class="mt-1 text-xs text-muted-foreground">
                Under 60 seconds · works on any phone
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
