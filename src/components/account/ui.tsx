import { IconChevronLeft, IconCircleCheck } from "@tabler/icons-solidjs";
import { type Component, type JSX, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { focusRing } from "~/components/auth/AuthShell";
import { type NavSection, sectionCard } from "~/components/settings/ui";
import { cn } from "~/lib/cn";

/**
 * `/account` is the personal half of what `/settings` does for the business
 * (spec §6: "Sections for email change, password, 2FA setup with QR and backup
 * codes"). It borrows the settings shell — left nav on md+, list-then-detail on
 * phones — so the two feel like one place, but each panel saves on its own:
 * these three actions hit three different endpoints and none of them is a draft
 * worth a shared save bar.
 */
export const ACCOUNT_SECTIONS = [
  {
    id: "email",
    label: "Email address",
    summary: "The address you log in with",
  },
  {
    id: "password",
    label: "Password",
    summary: "Change the password on this account",
  },
  {
    id: "two-factor",
    label: "Two-step verification",
    summary: "Ask for a code as well as a password",
  },
] as const satisfies readonly NavSection[];

export type AccountSectionId = (typeof ACCOUNT_SECTIONS)[number]["id"];

export function isAccountSectionId(
  value: string | undefined,
): value is AccountSectionId {
  return ACCOUNT_SECTIONS.some((section) => section.id === value);
}

/**
 * Titled panel. The heading takes focus when a section is opened from the nav,
 * so keyboard and screen-reader users are not left at the top of the list.
 */
export function AccountPanel(props: {
  id: AccountSectionId;
  title: string;
  lead?: string;
  focusHeading?: boolean;
  children: JSX.Element;
}) {
  const headingId = `account-${props.id}-title`;
  return (
    <section aria-labelledby={headingId} class={sectionCard}>
      <h2
        id={headingId}
        ref={(el) => {
          if (props.focusHeading) queueMicrotask(() => el.focus());
        }}
        tabindex="-1"
        class="font-display text-lg font-semibold text-text outline-none"
      >
        {props.title}
      </h2>
      <Show when={props.lead}>
        <p class="mt-1 max-w-[60ch] text-base text-pretty text-text-muted">
          {props.lead}
        </p>
      </Show>
      <div class="mt-6">{props.children}</div>
    </section>
  );
}

/** Back to the section list; only ever shown below md. */
export function BackToAccount(props: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      class={cn(
        "-ml-2 inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-sm font-medium text-primary md:hidden",
        focusRing,
      )}
    >
      <IconChevronLeft aria-hidden="true" class="size-4" />
      All account settings
    </button>
  );
}

/**
 * Live password rule, matching signup and reset-password: a dot while unmet,
 * a tick once met. Never colour alone — the icon changes too.
 */
export function Requirement(props: {
  id: string;
  met: boolean;
  children: JSX.Element;
}) {
  return (
    <p
      id={props.id}
      class={cn(
        "flex items-center gap-1.5 text-sm",
        props.met ? "text-success" : "text-text-muted",
      )}
    >
      <Show
        when={props.met}
        fallback={
          <span
            aria-hidden="true"
            class="grid size-4 shrink-0 place-items-center"
          >
            <span class="size-1.5 rounded-full bg-current" />
          </span>
        }
      >
        <IconCircleCheck aria-hidden="true" class="size-4 shrink-0" />
      </Show>
      {props.children}
    </p>
  );
}

/** Label + value row, used where an account fact is shown rather than edited. */
export function FactRow(props: {
  label: string;
  children: JSX.Element;
  hint?: JSX.Element;
}) {
  return (
    <div class="flex flex-col gap-1 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0 sm:flex-row sm:items-baseline sm:gap-4">
      <span class="text-sm font-medium text-text sm:w-40 sm:shrink-0">
        {props.label}
      </span>
      <div class="min-w-0 flex-1 text-base text-text">
        {props.children}
        <Show when={props.hint}>
          <span class="mt-0.5 block text-sm text-text-muted">{props.hint}</span>
        </Show>
      </div>
    </div>
  );
}

/**
 * Status chip: always an icon and a word, never colour alone (spec §1,
 * anti-pattern 4). Used for "Verified" / "Not verified" and the 2FA state.
 */
export function StatusChip(props: {
  tone: "success" | "warning" | "muted";
  icon: Component<JSX.SvgSVGAttributes<SVGSVGElement>>;
  children: JSX.Element;
}) {
  return (
    <span
      class={cn(
        "inline-flex items-center gap-1.5 rounded-sm px-2 py-0.5 text-sm font-medium",
        props.tone === "success" && "bg-success/10 text-success",
        props.tone === "warning" && "bg-warning/10 text-warning",
        props.tone === "muted" && "bg-primary-soft text-primary",
      )}
    >
      <Dynamic
        component={props.icon}
        aria-hidden="true"
        class="size-4 shrink-0"
      />
      {props.children}
    </span>
  );
}
