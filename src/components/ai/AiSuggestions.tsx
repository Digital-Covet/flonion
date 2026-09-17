import { createSignal, For, Show } from "solid-js";
import { useReducedMotion } from "~/hooks/useReducedMotion";

type Suggestion = { tone: "simple" | "professional" | "casual"; text: string };

/**
 * Flonion DS §5 code skeleton — E4 AI suggestion cards (most critical).
 * SolidJS + Tailwind, reduced-motion aware.
 *
 * Behavior: (a) pending — input locks, button shows spinner + "Drafting…";
 * (b) streaming — suggestion cards enter with opacity + translateY(8→0),
 * 180ms ease-out, 60ms stagger; no character-by-character typewriter
 * (screen-reader hostile); (c) cooldown — disabled button with visible
 * countdown (rate-limit transparency). Live region announces readiness.
 */
export function AiSuggestions(props: { businessName: string }) {
  const reduced = useReducedMotion();
  const [draft, setDraft] = createSignal("");
  const [rating, setRating] = createSignal(5);
  const [status, setStatus] = createSignal<
    "idle" | "pending" | "ready" | "error"
  >("idle");
  const [items, setItems] = createSignal<Suggestion[]>([]);
  const [cooldown, setCooldown] = createSignal(0);

  async function generate() {
    if (cooldown() > 0) return;
    setStatus("pending");
    try {
      const res = await fetch("/api/ai/suggest-review", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          draftText: draft(),
          starRating: rating(),
          businessName: props.businessName,
        }),
      });
      if (res.status === 429) {
        setCooldown(20);
        setStatus("error");
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setItems(data.suggestedReviews);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section aria-live="polite" class="grid gap-3">
      <div class="grid gap-2">
        <label for="ai-draft" class="text-sm font-medium text-foreground">
          Rough draft
        </label>
        <textarea
          id="ai-draft"
          rows={3}
          value={draft()}
          disabled={status() === "pending"}
          onInput={(e) => setDraft(e.currentTarget.value)}
          class="rounded-control border border-input bg-background p-3 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        />
      </div>
      <div class="grid gap-2">
        <label for="ai-rating" class="text-sm font-medium text-foreground">
          Star rating
        </label>
        <input
          id="ai-rating"
          type="number"
          min={1}
          max={5}
          value={rating()}
          disabled={status() === "pending"}
          onInput={(e) => setRating(Number(e.currentTarget.value))}
          class="tnum h-11 w-24 rounded-control border border-input bg-background px-3 text-base disabled:opacity-60"
        />
      </div>
      <button
        type="button"
        onClick={generate}
        disabled={status() === "pending" || cooldown() > 0}
        aria-describedby={cooldown() > 0 ? "ai-cooldown" : undefined}
        class="h-11 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity duration-[180ms] ease-out hover:bg-primary-hover disabled:opacity-60 motion-reduce:transition-none"
      >
        {status() === "pending" ? "Drafting…" : "Generate 3 suggestions"}
      </button>
      <Show when={cooldown() > 0}>
        <p id="ai-cooldown" class="text-sm text-muted-foreground">
          Rate-limited — try again in {cooldown()}s.
        </p>
      </Show>
      <Show when={status() === "pending"}>
        <div class="grid gap-2" aria-hidden="true">
          <For each={[0, 1, 2]}>
            {() => (
              <div class="skeleton h-20 rounded-card bg-muted motion-reduce:animate-none" />
            )}
          </For>
        </div>
      </Show>
      <Show when={status() === "ready"}>
        <div class="grid gap-2">
          <For each={items()}>
            {(s, i) => (
              <article
                class={
                  reduced()
                    ? "rounded-card border border-border bg-card p-3"
                    : "e4-card-enter rounded-card border border-border bg-card p-3"
                }
                style={reduced() ? {} : { "animation-delay": `${i() * 60}ms` }}
              >
                <header class="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-wide">
                  <span class="rounded-control bg-info-muted px-2 py-0.5 text-info-text">
                    {s.tone}
                  </span>
                </header>
                <p class="tnum text-sm leading-relaxed text-foreground">
                  {s.text}
                </p>
                <button
                  type="button"
                  onClick={() => setDraft(s.text)}
                  class="mt-2 h-9 rounded-control border border-border px-3 text-sm transition-opacity duration-[180ms] hover:bg-muted motion-reduce:transition-none"
                >
                  Use this draft
                </button>
              </article>
            )}
          </For>
        </div>
      </Show>
      <Show when={status() === "error"}>
        <p
          role="alert"
          class="rounded-card border border-destructive/20 bg-destructive-muted p-3 text-sm text-destructive"
        >
          Could not generate suggestions. Your draft is preserved — try again
          {cooldown() > 0 ? ` in ${cooldown()}s` : ""}.
        </p>
      </Show>
    </section>
  );
}
