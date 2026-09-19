import { A } from "@solidjs/router";
import {
  IconAlertTriangle,
  IconArrowRight,
  IconBuildingStore,
  IconCalendarEvent,
  IconCheck,
  IconCircleCheck,
  IconCopy,
  IconInfoCircle,
  IconListCheck,
  IconMapPin,
  IconPencil,
  IconPrinter,
  IconQrcode,
  IconScale,
  IconShieldCheck,
  IconSparkles,
  IconStar,
  IconUserCheck,
  IconZoomCheck,
} from "@tabler/icons-solidjs";
import { For, onCleanup, onMount } from "solid-js";
import {
  AiMarker,
  OnionRings,
  QrTicket,
  RatingPill,
  SectionHeading,
} from "~/components/landing/brand";
import { Faq, type FaqItem } from "~/components/landing/Faq";
import { HeroMock } from "~/components/landing/HeroMock";
import { SiteFooter } from "~/components/landing/SiteFooter";
import {
  btnPrimary,
  btnSecondary,
  SiteHeader,
} from "~/components/landing/SiteHeader";
import { PageMeta } from "~/components/meta/PageMeta";
import { homeGraph } from "~/components/meta/schema";

const container = "mx-auto w-full max-w-[1200px] px-4 md:px-6";
const section = "py-16 md:py-24";

/**
 * One fade-and-rise per section, the first time it scrolls into view.
 * The hidden start state only applies once this runs (see `.reveal-on` in
 * app.css), so content is visible without JS and under reduced motion.
 */
function useSectionReveal() {
  onMount(() => {
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }
    const targets = document.querySelectorAll<HTMLElement>("[data-reveal]");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute("data-reveal", "in");
          io.unobserve(entry.target);
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );
    for (const el of targets) {
      const rect = el.getBoundingClientRect();
      // Already on screen at load: leave it alone to avoid a flash.
      if (rect.top < window.innerHeight) el.setAttribute("data-reveal", "in");
      else io.observe(el);
    }
    document.documentElement.classList.add("reveal-on");
    onCleanup(() => io.disconnect());
  });
}

export default function Landing() {
  useSectionReveal();

  return (
    <>
      <PageMeta
        title="Flonion – More genuine reviews for local businesses"
        description="Flonion helps local businesses collect genuine Google reviews with QR codes, reply faster with AI drafts in your tone, and get found in local search."
        path="/"
        jsonLd={homeGraph()}
      />

      <a
        href="#main"
        class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <div class="min-h-screen bg-background font-sans text-text">
        <SiteHeader />
        <main id="main">
          <Hero />
          <ProofStrip />
          <HowItWorks />
          <AiFeatures />
          <LocalSeo />
          <GenuineReviews />
          <Faq items={APP_FAQ} />
          <FinalCta />
        </main>
        <SiteFooter />
      </div>
    </>
  );
}

/* ───────────────────────── Hero (light) ───────────────────────── */

function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      class="relative overflow-hidden pt-12 pb-20 md:pt-20 md:pb-28"
    >
      <OnionRings class="absolute top-1/2 right-[-12rem] hidden w-[46rem] -translate-y-1/2 lg:block" />
      <div
        class={`${container} relative grid grid-cols-1 items-center gap-10 sm:gap-12 lg:grid-cols-12 lg:gap-8`}
      >
        <div class="min-w-0 lg:col-span-6">
          <p class="inline-flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1 text-sm font-medium text-primary">
            <IconQrcode aria-hidden="true" class="size-4" />
            For restaurants, salons, clinics and shops
          </p>
          <h1
            id="hero-title"
            class="mt-4 font-display text-2xl font-semibold text-balance text-text sm:mt-5 sm:text-3xl lg:text-4xl"
          >
            Get more genuine reviews, reply in seconds, and get found nearby.
          </h1>
          <p class="mt-4 max-w-xl text-base text-pretty text-text-muted sm:mt-5 sm:text-lg">
            Customers scan your QR, rate their visit and post on Google. Flonion
            drafts your replies and tells you what to fix on your profile.
          </p>
          <div class="mt-8 flex flex-col gap-3 sm:flex-row">
            <A href="/signup" class={`${btnPrimary} min-h-12 px-6`}>
              Start free
              <IconArrowRight aria-hidden="true" class="size-5" />
            </A>
            <a href="#how-it-works" class={`${btnSecondary} min-h-12 px-6`}>
              See how it works
            </a>
          </div>
          <ul class="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-text-muted">
            <For
              each={[
                "Free to start",
                "No app for customers",
                "Set up in minutes",
              ]}
            >
              {(item) => (
                <li class="inline-flex items-center gap-1.5">
                  <IconCheck aria-hidden="true" class="size-4 text-secondary" />
                  {item}
                </li>
              )}
            </For>
          </ul>
        </div>
        <div class="min-w-0 lg:col-span-6">
          <HeroMock />
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Proof strip (light) ───────────────────────── */

const PLATFORMS = ["Google", "JustDial", "Facebook", "Tripadvisor", "Yelp"];

function ProofStrip() {
  return (
    <section
      aria-labelledby="proof-title"
      class="border-y border-border bg-surface py-8"
    >
      <div
        class={`${container} flex flex-col items-center gap-5 md:flex-row md:justify-between`}
      >
        <h2
          id="proof-title"
          class="text-sm font-medium text-text-muted md:shrink-0"
        >
          Works with the platforms your customers already use
        </h2>
        <ul class="flex flex-wrap items-center justify-center gap-2">
          <For each={PLATFORMS}>
            {(name) => (
              <li class="rounded-full border border-border px-4 py-1.5 font-display text-sm font-semibold text-text">
                {name}
              </li>
            )}
          </For>
        </ul>
      </div>
    </section>
  );
}

/* ───────────────────────── How it works (dark) ───────────────────────── */

const STEPS = [
  {
    icon: IconPrinter,
    title: "Print your QR",
    body: "Create a review link in under a minute and put the QR ticket on your counter, table or bill.",
  },
  {
    icon: IconQrcode,
    title: "Customers scan and rate",
    body: "No login and no app. They pick the stars, write a few words, and can ask for help wording it.",
  },
  {
    icon: IconCopy,
    title: "They post where it counts",
    body: "One tap copies their review and opens Google or JustDial. Every rating sees the same options.",
  },
];

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      data-surface="dark"
      aria-labelledby="how-title"
      class={`${section} scroll-mt-16 bg-background text-text`}
    >
      <div
        data-reveal
        class={`${container} grid grid-cols-1 items-center gap-12 lg:grid-cols-12`}
      >
        <div class="lg:col-span-6">
          <SectionHeading
            id="how-title"
            eyebrow="How it works"
            title="From the counter to Google in under two minutes"
            lead="The moment a customer is happiest is when they are still in your shop. Flonion turns that moment into a posted review."
          />
          <ol class="mt-10 flex flex-col gap-6">
            <For each={STEPS}>
              {(step, i) => (
                <li class="flex gap-4">
                  <span class="grid size-11 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                    <step.icon aria-hidden="true" class="size-5" />
                  </span>
                  <div>
                    <h3 class="font-display text-lg font-semibold">
                      <span class="font-mono text-sm text-text-muted tabular-nums">
                        0{i() + 1}
                      </span>{" "}
                      {step.title}
                    </h3>
                    <p class="mt-1 text-text-muted">{step.body}</p>
                  </div>
                </li>
              )}
            </For>
          </ol>
        </div>

        {/* Photo slot P1 (QR stand on a real partner's counter) goes here. */}
        <div class="relative lg:col-span-6">
          <div class="relative mx-auto grid max-w-md place-items-center overflow-hidden rounded-xl border border-border bg-surface px-6 py-14 sm:py-20">
            <OnionRings class="absolute inset-0 m-auto w-[130%] max-w-none" />
            <QrTicket
              stack
              business="Swaad Restaurant"
              prompt="Enjoyed your meal? Scan to leave a review."
              url="app.flonion.com"
              class="relative"
            />
            <p class="relative mt-6 flex items-center gap-2 text-sm text-text-muted">
              <IconInfoCircle aria-hidden="true" class="size-4 text-info" />
              Download as PNG or print a ready-made sheet.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── AI features bento (light) ───────────────────────── */

const bentoTile =
  "rounded-lg border border-border bg-surface p-6 transition-shadow duration-[var(--duration-base)] hover:shadow-[0_12px_32px_rgb(28_25_23/0.08)]";

function AiFeatures() {
  return (
    <section
      id="features"
      aria-labelledby="features-title"
      class={`${section} scroll-mt-16`}
    >
      <div data-reveal class={container}>
        <SectionHeading
          id="features-title"
          eyebrow="Features"
          title="Everything a busy owner needs, nothing they don't"
          lead="Use it on your phone between customers. AI does the first draft; you always decide what gets posted."
        />

        <div class="mt-12 grid gap-4 md:grid-cols-6">
          {/* Large: reply drafts */}
          <article class={`${bentoTile} md:col-span-4 md:row-span-2`}>
            <AiMarker label="AI reply drafts" />
            <h3 class="mt-3 font-display text-xl font-semibold">
              Reply drafts in your tone
            </h3>
            <p class="mt-2 max-w-lg text-text-muted">
              Every Google review lands in one inbox with its sentiment. Tap
              once for a Professional, Friendly or Formal draft, edit it, and
              post.
            </p>
            <div class="mt-6 grid gap-3 rounded-md bg-background p-4">
              <div class="flex flex-wrap items-center gap-2">
                <span class="text-sm font-medium">Rahul M.</span>
                <RatingPill rating={3} class="py-0.5 text-xs" />
                <span class="inline-flex items-center gap-1 text-xs font-medium text-warning">
                  <IconAlertTriangle aria-hidden="true" class="size-3.5" />
                  Mixed
                </span>
              </div>
              <p class="text-sm text-text-muted">
                “Food was good but we waited 25 minutes on Saturday night.”
              </p>
              <div
                aria-hidden="true"
                class="flex w-fit rounded-md border border-border-strong p-0.5 text-xs"
              >
                <span class="rounded-sm px-2.5 py-1 text-text-muted">
                  Professional
                </span>
                <span class="rounded-sm bg-primary-soft px-2.5 py-1 font-medium text-primary">
                  Friendly
                </span>
                <span class="rounded-sm px-2.5 py-1 text-text-muted">
                  Formal
                </span>
              </div>
              <div class="rounded-md border border-border-strong bg-surface p-3">
                <AiMarker />
                <p class="mt-1.5 text-sm">
                  Thanks for coming in, Rahul, and sorry about the wait.
                  Saturdays get busy, so we've added a second person at the
                  pass. Hope to see you again soon!
                </p>
              </div>
            </div>
          </article>

          {/* Medium: review suggestions */}
          <article class={`${bentoTile} md:col-span-2 md:row-span-2`}>
            <AiMarker label="AI suggestions" />
            <h3 class="mt-3 font-display text-xl font-semibold">
              Help customers find the words
            </h3>
            <p class="mt-2 text-text-muted">
              Stuck on what to write? Customers get three short drafts based on
              what they typed and their rating. They choose, edit, and post.
            </p>
            <ul class="mt-6 flex flex-col gap-2">
              <For each={["Simple", "Professional", "Casual"]}>
                {(label, i) => (
                  <li
                    class="rounded-md border border-border bg-background p-3"
                    style={{ opacity: 1 - i() * 0.22 }}
                  >
                    <span class="text-xs font-medium text-text-muted">
                      {label}
                    </span>
                    <span class="mt-2 block h-2 w-11/12 rounded-full bg-border" />
                    <span class="mt-1.5 block h-2 w-2/3 rounded-full bg-border" />
                  </li>
                )}
              </For>
            </ul>
          </article>

          <SmallTile
            icon={IconCalendarEvent}
            title="Scheduling"
            body="Share a booking page and accept meetings with Google Meet links."
          />
          <SmallTile
            icon={IconListCheck}
            title="Team tasks"
            body="A simple board for your staff, with who's doing what this week."
          />
          <SmallTile
            icon={IconBuildingStore}
            title="Partner marketplace"
            body="Find local suppliers and partners, and show off your own work."
          />
        </div>

        <Industries />
      </div>
    </section>
  );
}

function SmallTile(props: {
  icon: typeof IconBuildingStore;
  title: string;
  body: string;
}) {
  return (
    <article class={`${bentoTile} md:col-span-2`}>
      <span class="grid size-10 place-items-center rounded-md bg-primary-soft text-primary">
        <props.icon aria-hidden="true" class="size-5" />
      </span>
      <h3 class="mt-4 font-display text-lg font-semibold">{props.title}</h3>
      <p class="mt-1 text-sm text-text-muted">{props.body}</p>
    </article>
  );
}

/*
 * Photo slot P2: free Unsplash photos, served from Unsplash's CDN at the size
 * each tile needs. Credits are recorded in src/assets/images.json. Tiles use
 * alt="" because the label below carries the meaning.
 */
const INDUSTRIES = [
  {
    label: "Restaurants & cafés",
    src: "https://images.unsplash.com/photo-1651761319093-3b471571a920",
  },
  {
    label: "Salons & spas",
    src: "https://images.unsplash.com/photo-1600948836101-f9ffda59d250",
  },
  {
    label: "Clinics",
    src: "https://images.unsplash.com/photo-1629909614456-6b1c5c94cecc",
  },
  {
    label: "Retail & kirana",
    src: "https://images.unsplash.com/photo-1739066598279-1297113f5c6a",
  },
];

const unsplash = (src: string, w: number) =>
  `${src}?auto=format&fit=crop&w=${w}&h=${Math.round((w * 3) / 4)}&q=70`;

function Industries() {
  return (
    <div class="mt-16">
      <h3 class="font-display text-lg font-semibold">
        Built for businesses people visit
      </h3>
      <ul class="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <For each={INDUSTRIES}>
          {(item) => (
            <li class="group">
              <div class="aspect-[4/3] overflow-hidden rounded-lg border border-border bg-primary-soft">
                <img
                  src={unsplash(item.src, 600)}
                  srcset={`${unsplash(item.src, 400)} 400w, ${unsplash(item.src, 600)} 600w, ${unsplash(item.src, 900)} 900w`}
                  sizes="(min-width: 1200px) 276px, (min-width: 768px) 23vw, 46vw"
                  width="600"
                  height="450"
                  alt=""
                  loading="lazy"
                  decoding="async"
                  class="size-full object-cover motion-safe:transition-transform motion-safe:duration-[var(--duration-slow)] motion-safe:ease-[var(--ease-out)] motion-safe:group-hover:scale-[1.03]"
                />
              </div>
              <p class="mt-2 text-sm font-medium">{item.label}</p>
            </li>
          )}
        </For>
      </ul>
    </div>
  );
}

/* ───────────────────────── Local SEO (dark) ───────────────────────── */

const SEO_ACTIONS = [
  {
    done: false,
    title: "Add opening hours for Sunday",
    detail: "Profiles with full hours show up in more “open now” searches.",
  },
  {
    done: false,
    title: "Reply to 3 reviews from last week",
    detail: "Recent replies show customers you're listening.",
  },
  {
    done: true,
    title: "Add 5 photos of your dining area",
    detail: "Done · 2 days ago",
  },
];

function LocalSeo() {
  const score = 72;
  const r = 52;
  const c = 2 * Math.PI * r;

  return (
    <section
      data-surface="dark"
      aria-labelledby="seo-title"
      class={`${section} bg-background text-text`}
    >
      <div
        data-reveal
        class={`${container} grid grid-cols-1 items-center gap-12 lg:grid-cols-12`}
      >
        <div class="lg:col-span-5">
          <SectionHeading
            id="seo-title"
            eyebrow="Local SEO"
            title="Show up when people nearby search"
            lead="Flonion scores your Google Business Profile, tracks the keywords you rank for, compares you with competitors down the road, and turns it all into a short to-do list."
          />
          <A
            href="/signup"
            class="mt-8 inline-flex min-h-11 items-center gap-2 rounded-md font-display font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Check your profile score
            <IconArrowRight aria-hidden="true" class="size-4" />
          </A>
        </div>

        <div class="grid gap-4 sm:grid-cols-5 lg:col-span-7">
          <div class="flex flex-col items-center justify-center rounded-lg border border-border bg-surface p-6 sm:col-span-2">
            <svg
              viewBox="0 0 128 128"
              class="size-36"
              role="img"
              aria-label={`Profile score ${score} out of 100`}
            >
              <circle
                cx="64"
                cy="64"
                r={r}
                fill="none"
                stroke="var(--border)"
                stroke-width="10"
              />
              <circle
                cx="64"
                cy="64"
                r={r}
                fill="none"
                stroke="var(--secondary)"
                stroke-width="10"
                stroke-linecap="round"
                stroke-dasharray={`${(c * score) / 100} ${c}`}
                transform="rotate(-90 64 64)"
              />
              <text
                x="64"
                y="70"
                text-anchor="middle"
                class="fill-text font-mono text-[28px] font-medium"
              >
                {score}
              </text>
            </svg>
            <p class="mt-3 font-display font-semibold">Profile score</p>
            <p class="text-sm text-text-muted">
              <span class="font-mono tabular-nums">72</span> of 100 · Good
            </p>
          </div>

          <div class="rounded-lg border border-border bg-surface p-5 sm:col-span-3">
            <div class="flex items-center justify-between gap-2">
              <h3 class="font-display font-semibold">Top actions</h3>
              <AiMarker label="AI recommendations" />
            </div>
            <ul class="mt-4 flex flex-col gap-3">
              <For each={SEO_ACTIONS}>
                {(a) => (
                  <li class="flex gap-3 rounded-md bg-background p-3">
                    {a.done ? (
                      <IconCircleCheck
                        aria-hidden="true"
                        class="mt-0.5 size-5 shrink-0 text-success"
                      />
                    ) : (
                      <IconZoomCheck
                        aria-hidden="true"
                        class="mt-0.5 size-5 shrink-0 text-primary"
                      />
                    )}
                    <div>
                      <p class="text-sm font-medium">
                        {a.done && <span class="sr-only">Completed: </span>}
                        {a.title}
                      </p>
                      <p class="text-xs text-text-muted">{a.detail}</p>
                    </div>
                  </li>
                )}
              </For>
            </ul>
            <div class="mt-4 flex items-center gap-2 border-t border-border pt-4 text-sm text-text-muted">
              <IconMapPin aria-hidden="true" class="size-4 text-secondary" />
              “biryani near me” ·{" "}
              <span class="font-mono text-text tabular-nums">#4</span> in your
              area
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────── Genuine reviews (light) ───────────────────────── */

const PRINCIPLES = [
  {
    icon: IconScale,
    title: "Same options for every rating",
    body: "A 2-star visitor sees the same “Post on Google” button as a 5-star one. Unhappy customers are never filtered out.",
  },
  {
    icon: IconUserCheck,
    title: "Customers pick their own stars",
    body: "Ratings are never pre-filled, and nobody needs an account to leave one.",
  },
  {
    icon: IconSparkles,
    title: "AI text is always labelled",
    body: "Suggestions and reply drafts carry an “AI draft” tag, and a person always chooses to use them.",
  },
  {
    icon: IconPencil,
    title: "You approve every reply",
    body: "Flonion drafts, you edit. Nothing is posted in your name without you.",
  },
];

function GenuineReviews() {
  return (
    <section aria-labelledby="genuine-title" class={section}>
      <div
        data-reveal
        class={`${container} grid grid-cols-1 items-center gap-12 lg:grid-cols-12`}
      >
        <div class="lg:col-span-7">
          <SectionHeading
            id="genuine-title"
            eyebrow="Honest by design"
            title="Real reviews from real visits, nothing else"
            lead="Customers and Google can tell when reviews are cherry-picked. Flonion is built so every review you collect is one you can stand behind."
          />
          <ul class="mt-10 grid gap-6 sm:grid-cols-2">
            <For each={PRINCIPLES}>
              {(item) => (
                <li class="flex gap-4">
                  <span class="grid size-11 shrink-0 place-items-center rounded-md bg-primary-soft text-primary">
                    <item.icon aria-hidden="true" class="size-5" />
                  </span>
                  <div>
                    <h3 class="font-display text-lg font-semibold">
                      {item.title}
                    </h3>
                    <p class="mt-1 text-sm text-text-muted">{item.body}</p>
                  </div>
                </li>
              )}
            </For>
          </ul>
        </div>

        <figure class="lg:col-span-5">
          <div class="grid gap-4 sm:grid-cols-2">
            <RatingOutcome rating={2} label="Poor" />
            <RatingOutcome rating={5} label="Excellent" />
          </div>
          <figcaption class="mt-4 flex items-center justify-center gap-2 text-sm text-text-muted">
            <IconShieldCheck aria-hidden="true" class="size-4 text-secondary" />
            Both customers get the same next step.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}

function RatingOutcome(props: { rating: number; label: string }) {
  return (
    <div class="rounded-xl border border-border bg-surface p-4 shadow-[0_12px_32px_rgb(28_25_23/0.08)]">
      <p class="text-xs text-text-muted">Customer rated</p>
      <div class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        <div class="flex gap-0.5">
          <For each={[1, 2, 3, 4, 5]}>
            {(n) => (
              <IconStar
                aria-hidden="true"
                class="size-4 stroke-accent"
                stroke-width={1.5}
                fill={n <= props.rating ? "var(--star)" : "transparent"}
              />
            )}
          </For>
        </div>
        <span class="text-sm font-medium">
          <span class="font-mono tabular-nums">{props.rating}</span> of 5 –{" "}
          {props.label}
        </span>
      </div>
      <p class="mt-4 font-display text-sm font-semibold">
        Thanks! One more step:
      </p>
      <div class="mt-2 flex flex-col gap-2">
        <For each={["Post on Google", "Post on JustDial"]}>
          {(text) => (
            <span class="rounded-md border border-border-strong px-3 py-2 text-center text-sm font-medium">
              {text}
            </span>
          )}
        </For>
        <span class="inline-flex items-center justify-center gap-1.5 py-1 text-sm text-text-muted">
          <IconCopy aria-hidden="true" class="size-4" />
          Copy my review
        </span>
      </div>
    </div>
  );
}

/* ───────────────────────── FAQ (light) ───────────────────────── */

const APP_FAQ: FaqItem[] = [
  {
    q: "How do customers leave a review?",
    a: "They scan your QR code or open your review link, pick their stars and write a few words in the browser. No app or account is needed. When they're done, Flonion sends them to the platform you've set up so they can post it.",
  },
  {
    q: "Which review platforms does Flonion work with?",
    a: "Google, Yelp, Facebook, Tripadvisor and JustDial, plus any custom link you add. You choose which ones customers see when you set up your business.",
  },
  {
    q: "What if a customer doesn't know what to write?",
    a: "They can ask for help. Flonion writes three short drafts in different tones (Simple, Professional and Casual) from what they typed and their rating, and they pick, edit and post.",
  },
  {
    q: "How do AI reply drafts work?",
    a: "Flonion reads each review for sentiment, key topics and what the customer wants, then drafts a Professional, Friendly or Formal reply. You edit it and decide whether to post.",
  },
  {
    q: "Do I need to connect my Google Business Profile?",
    a: "It's optional, but recommended. Connecting it lets Flonion pull in your Google reviews, rating and review count. Your Google access is encrypted, and you can disconnect at any time from settings.",
  },
  {
    q: "Can I see how my QR codes and review links are doing?",
    a: "Yes. Campaign analytics show page visits, QR scans, reviews submitted, redirects to each platform and how often customers used AI suggestions.",
  },
  {
    q: "How does Flonion help me show up in local search?",
    a: "It scores how complete your business profile is, suggests keywords, compares you with nearby competitors and turns it all into a prioritised list, such as adding photos, filling in hours or replying to reviews.",
  },
  {
    q: "Can I add my team?",
    a: "Yes. Invite people by email and give them a role such as Admin, Manager or Marketing. Staff can also find your business and ask to join, and owners and admins approve each request.",
  },
  {
    q: "Can customers and partners book time with me?",
    a: "Yes. Set your working days, hours and slot length, and share your public booking page. You can accept or decline requests straight from the email, and accepted meetings can get a Google Meet link and a calendar invite.",
  },
  {
    q: "Is my account secure?",
    a: "Every account has to verify its email before signing in, and you can turn on two-factor authentication with an authenticator app and backup codes.",
  },
];

/* ───────────────────────── Final CTA (accent band) ───────────────────────── */

function FinalCta() {
  return (
    <section
      data-surface="accent"
      aria-labelledby="cta-title"
      class="relative overflow-hidden bg-background py-16 text-text md:py-20"
    >
      <OnionRings class="absolute -top-40 -right-40 w-[36rem] text-[#FFFFFF24]" />
      <div
        class={`${container} relative flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between`}
      >
        <div>
          <h2
            id="cta-title"
            class="font-display text-2xl font-semibold text-balance md:text-3xl"
          >
            Your next happy customer is already in the shop.
          </h2>
          <p class="mt-2 text-text-muted">
            Set up Flonion today and print your first QR in five minutes.
          </p>
        </div>
        <A href="/signup" class={`${btnPrimary} min-h-12 shrink-0 px-6`}>
          <IconSparkles aria-hidden="true" class="size-5" />
          Start free
        </A>
      </div>
    </section>
  );
}
