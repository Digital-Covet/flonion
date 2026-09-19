import { A } from "@solidjs/router";
import { createSignal, Show } from "solid-js";
import {
  FieldError,
  inputBase,
  labelClass,
  textLink,
} from "~/components/auth/AuthShell";
import {
  api,
  btnPrimary,
  btnSecondary,
  NETWORK_ERROR,
  Notice,
  SelectField,
  type SelectOption,
  Spinner,
} from "~/components/onboarding/ui";
import { ratingText, StarRating } from "~/components/reviews/StarRating";
import { cn } from "~/lib/cn";
import { SUPPORT_EMAIL } from "~/lib/constants";
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_EMAIL_MAX,
  FEEDBACK_MESSAGE_MAX,
  FEEDBACK_NAME_MAX,
  type FeedbackCategory,
} from "~/lib/feedback";

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Stored values are the endpoint's exact strings; the labels are the
 * plain-language version an owner reads. Keyed by category so adding one to
 * `FEEDBACK_CATEGORIES` is a type error until it has copy here.
 */
const CATEGORY_COPY: Record<
  FeedbackCategory,
  { label: string; description: string }
> = {
  General: { label: "General", description: "Anything else on your mind" },
  "Bug Report": {
    label: "Something is broken",
    description: "It doesn't work, or it works wrongly",
  },
  "Feature Request": {
    label: "Missing feature",
    description: "Something Flonion can't do yet",
  },
  Improvement: {
    label: "Could work better",
    description: "It works, but it's slow or confusing",
  },
  Other: { label: "Other", description: "None of the above" },
};

const CATEGORY_OPTIONS: SelectOption[] = FEEDBACK_CATEGORIES.map((value) => ({
  value,
  ...CATEGORY_COPY[value],
}));

type FieldName = "name" | "email" | "category" | "rating" | "message";
type Errors = Partial<Record<FieldName, string>>;

/**
 * Feedback form (spec §6, Feedback: "Short form; success replaces the form").
 *
 * Name and email start from the signed-in account but stay editable — the
 * person who runs the shop is often not the person whose login is open, and
 * the reply goes to whatever address is typed here.
 */
export function FeedbackForm(props: {
  defaultName: string;
  defaultEmail: string;
}) {
  const [name, setName] = createSignal(props.defaultName);
  const [email, setEmail] = createSignal(props.defaultEmail);
  const [category, setCategory] = createSignal("");
  const [rating, setRating] = createSignal(0);
  const [message, setMessage] = createSignal("");

  const [errors, setErrors] = createSignal<Errors>({});
  const [banner, setBanner] = createSignal<{
    tone: "error" | "warning";
    text: string;
    expired?: boolean;
  }>();
  const [pending, setPending] = createSignal(false);
  const [sent, setSent] = createSignal(false);
  /**
   * Kept separately from `sent` so the thank-you can repeat the rating back
   * without ever reading a cleared value while its branch is being torn down.
   */
  const [sentRating, setSentRating] = createSignal(0);

  let nameRef: HTMLInputElement | undefined;
  let emailRef: HTMLInputElement | undefined;
  let categoryRef: HTMLDivElement | undefined;
  let ratingRef: HTMLInputElement | undefined;
  let messageRef: HTMLTextAreaElement | undefined;

  const left = () => FEEDBACK_MESSAGE_MAX - message().length;

  /** Move to the first thing that needs fixing, top to bottom. */
  function focusFirst(found: Errors) {
    if (found.name) return nameRef?.focus();
    if (found.email) return emailRef?.focus();
    if (found.category) return categoryRef?.querySelector("button")?.focus();
    if (found.rating) return ratingRef?.focus();
    if (found.message) return messageRef?.focus();
  }

  function validate(): Errors {
    const found: Errors = {};
    const trimmedName = name().trim();
    const trimmedEmail = email().trim();
    const trimmedMessage = message().trim();

    if (!trimmedName) found.name = "Tell us what to call you.";
    else if (trimmedName.length > FEEDBACK_NAME_MAX)
      found.name = `Keep your name under ${FEEDBACK_NAME_MAX} characters.`;

    if (!trimmedEmail) found.email = "We need an address to reply to.";
    else if (!EMAIL_SHAPE.test(trimmedEmail))
      found.email = "Enter an email address like name@business.com.";
    else if (trimmedEmail.length > FEEDBACK_EMAIL_MAX)
      found.email = "That address is too long.";

    if (!category()) found.category = "Pick what this is about.";
    if (!rating()) found.rating = "Rate Flonion before sending.";

    if (!trimmedMessage) found.message = "Tell us what happened.";
    else if (trimmedMessage.length > FEEDBACK_MESSAGE_MAX)
      found.message = `Trim this to ${FEEDBACK_MESSAGE_MAX} characters.`;

    return found;
  }

  async function submit(event: SubmitEvent) {
    event.preventDefault();
    if (pending()) return;

    const found = validate();
    if (Object.keys(found).length > 0) {
      setErrors(found);
      focusFirst(found);
      return;
    }

    setErrors({});
    setBanner(undefined);
    setPending(true);
    try {
      const res = await api<{ id: string; success: boolean }>("/api/feedback", {
        method: "POST",
        body: {
          name: name().trim(),
          email: email().trim(),
          category: category(),
          rating: rating(),
          message: message().trim(),
        },
      });

      // Nothing is cleared on any failure: re-typing a page of feedback
      // because a request timed out is how feedback stops being sent.
      if (res.status === 401) {
        setBanner({
          tone: "warning",
          text: "Your session expired. Log in again and send this — your words are still here.",
          expired: true,
        });
        return;
      }
      if (!res.ok) {
        setBanner({
          tone: "error",
          text:
            res.data.error ??
            "We couldn't send that just now. Try again shortly.",
        });
        return;
      }

      setSentRating(rating());
      setSent(true);
    } catch {
      setBanner({ tone: "error", text: NETWORK_ERROR });
    } finally {
      setPending(false);
    }
  }

  /** Keeps who you are, clears what you said. */
  function again() {
    setSent(false);
    setCategory("");
    setRating(0);
    setMessage("");
    setErrors({});
    setBanner(undefined);
    queueMicrotask(() => categoryRef?.querySelector("button")?.focus());
  }

  return (
    <Show
      when={!sent()}
      fallback={<Thanks rating={sentRating()} onAgain={again} />}
    >
      <form
        id="feedback-form"
        novalidate
        onSubmit={submit}
        class="flex flex-col gap-6"
      >
        <Show when={banner()}>
          {(note) => (
            <Notice tone={note().tone}>
              {note().text}
              <Show when={note().expired}>
                {" "}
                <A href="/login?callbackURL=%2Ffeedback" class={textLink}>
                  Log in
                </A>
              </Show>
            </Notice>
          )}
        </Show>

        <div class="grid gap-5 sm:grid-cols-2">
          <div class="flex flex-col gap-1.5">
            <label for="feedback-name" class={labelClass}>
              Your name
            </label>
            <input
              ref={nameRef}
              id="feedback-name"
              name="name"
              type="text"
              autocomplete="name"
              maxlength={FEEDBACK_NAME_MAX}
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              aria-invalid={errors().name ? "true" : undefined}
              aria-describedby={
                errors().name ? "feedback-name-error" : undefined
              }
              class={inputBase}
            />
            <FieldError id="feedback-name-error" message={errors().name} />
          </div>

          <div class="flex flex-col gap-1.5">
            <label for="feedback-email" class={labelClass}>
              Reply-to email
            </label>
            <input
              ref={emailRef}
              id="feedback-email"
              name="email"
              type="email"
              inputmode="email"
              autocomplete="email"
              maxlength={FEEDBACK_EMAIL_MAX}
              value={email()}
              onInput={(e) => setEmail(e.currentTarget.value)}
              aria-invalid={errors().email ? "true" : undefined}
              aria-describedby={
                errors().email ? "feedback-email-error" : "feedback-email-hint"
              }
              class={inputBase}
            />
            <Show
              when={errors().email}
              fallback={
                <p id="feedback-email-hint" class="text-sm text-text-muted">
                  Where our answer goes.
                </p>
              }
            >
              <FieldError id="feedback-email-error" message={errors().email} />
            </Show>
          </div>
        </div>

        <div ref={categoryRef} class="flex flex-col gap-1.5">
          <SelectField
            label="What is this about?"
            options={CATEGORY_OPTIONS}
            value={category()}
            onChange={(value) => setCategory(value)}
            placeholder="Choose one"
            name="category"
            invalid={Boolean(errors().category)}
            describedBy={
              errors().category ? "feedback-category-error" : undefined
            }
          />
          <FieldError
            id="feedback-category-error"
            message={errors().category}
          />
        </div>

        <div class="rounded-md border border-border bg-background px-4 py-5">
          <StarRating
            legend="How is Flonion working for you?"
            name="rating"
            value={rating()}
            onChange={setRating}
            error={errors().rating}
            ref={(first) => {
              ratingRef = first;
            }}
          />
        </div>

        <div class="flex flex-col gap-1.5">
          <label for="feedback-message" class={labelClass}>
            Your feedback
          </label>
          <textarea
            ref={messageRef}
            id="feedback-message"
            name="message"
            rows={6}
            maxlength={FEEDBACK_MESSAGE_MAX}
            placeholder="What were you trying to do, and what happened instead?"
            value={message()}
            onInput={(e) => setMessage(e.currentTarget.value)}
            aria-invalid={errors().message ? "true" : undefined}
            aria-describedby={
              errors().message
                ? "feedback-message-error"
                : "feedback-message-hint"
            }
            class={cn(inputBase, "min-h-36 resize-y py-2.5")}
          />
          <Show
            when={errors().message}
            fallback={
              <p id="feedback-message-hint" class="text-sm text-text-muted">
                The more specific, the faster we can fix it.{" "}
                <span class="font-mono tabular-nums">
                  {message().length}/{FEEDBACK_MESSAGE_MAX}
                </span>
              </p>
            }
          >
            <FieldError
              id="feedback-message-error"
              message={errors().message}
            />
          </Show>
          {/* Only speaks up near the ceiling, so it isn't read on every keystroke. */}
          <span aria-live="polite" class="sr-only">
            <Show when={left() <= 100 && left() >= 0}>
              {left()} characters left
            </Show>
          </span>
        </div>

        <div class="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row-reverse sm:items-center sm:justify-start">
          <button
            type="submit"
            disabled={pending()}
            class={cn(
              btnPrimary,
              "min-h-12 w-full disabled:cursor-progress disabled:opacity-80 sm:w-auto",
            )}
          >
            <Show when={pending()} fallback="Send feedback">
              <Spinner class="size-4" />
              Sending…
            </Show>
          </button>
          <p class="text-sm text-pretty text-text-muted sm:mr-auto">
            Something urgent?{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`} class={textLink}>
              {SUPPORT_EMAIL}
            </a>
          </p>
        </div>
      </form>
    </Show>
  );
}

/**
 * Success replaces the form (spec §6). The heading takes focus so a screen
 * reader lands on the confirmation rather than back at the page title.
 */
function Thanks(props: { rating: number; onAgain: () => void }) {
  return (
    <div class="flex flex-col items-center py-4 text-center motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-[var(--duration-base)]">
      <svg
        aria-hidden="true"
        viewBox="0 0 52 52"
        class="size-14 text-success"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
      >
        <circle cx="26" cy="26" r="23" class="opacity-20" />
        <path d="M15 27l7 7 15-16" class="check-draw" pathLength="1" />
      </svg>

      <h2
        ref={(el) => queueMicrotask(() => el.focus())}
        tabindex="-1"
        class="mt-4 font-display text-xl font-semibold text-text outline-none"
      >
        Thanks — we've got it
      </h2>
      <p class="mt-2 max-w-[44ch] text-base text-pretty text-text-muted">
        You rated Flonion{" "}
        <span class="font-medium text-text">{ratingText(props.rating)}</span>. A
        real person reads every note, and we'll reply to the address you gave if
        it needs an answer.
      </p>

      <div class="mt-6 flex flex-col gap-3 sm:flex-row">
        <button type="button" onClick={props.onAgain} class={btnSecondary}>
          Send more feedback
        </button>
        <A href="/dashboard" class={btnPrimary}>
          Back to dashboard
        </A>
      </div>
    </div>
  );
}
