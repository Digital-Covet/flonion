import { Title } from "@solidjs/meta";
import { useSearchParams } from "@solidjs/router";
import { createSignal, Match, Show, Switch } from "solid-js";
import { EmailPanel, PasswordPanel } from "~/components/account/panels";
import { TwoFactorPanel } from "~/components/account/two-factor";
import {
  ACCOUNT_SECTIONS,
  type AccountSectionId,
  BackToAccount,
  isAccountSectionId,
} from "~/components/account/ui";
import { WidgetError } from "~/components/dashboard/ui";
import { SectionNav, SectionSkeleton } from "~/components/settings/ui";
import { authClient } from "~/lib/auth-client";
import { cn } from "~/lib/cn";

/**
 * Personal account settings (spec §6, Account): email, password and two-step
 * verification. Everything here reads and writes the better-auth session
 * rather than the business, which is why it sits beside `/settings` instead of
 * inside it — the business can be shared with a team, this cannot.
 */
export default function AccountPage() {
  const session = authClient.useSession();
  const [params, setParams] = useSearchParams();

  const raw = () =>
    Array.isArray(params.section) ? params.section[0] : params.section;
  /** The open section lives in the URL so a reload or a link lands on it. */
  const section = (): AccountSectionId | null => {
    const value = raw();
    return isAccountSectionId(value) ? value : null;
  };
  /** Desktop always shows a panel; mobile shows the list until one is picked. */
  const shown = (): AccountSectionId => section() ?? "email";
  const [navigated, setNavigated] = createSignal(false);

  function open(id: AccountSectionId) {
    setNavigated(true);
    setParams({ section: id }, { replace: true, scroll: false });
  }
  function close() {
    setNavigated(false);
    setParams({ section: undefined }, { replace: true, scroll: false });
  }

  const user = () => session().data?.user;
  const loading = () => session().isPending && !user();
  const failed = () => Boolean(session().error) && !user();
  const focusHeading = (id: AccountSectionId) => navigated() && shown() === id;

  return (
    <>
      <Title>Account · Flonion</Title>

      <div class="flex flex-col gap-6">
        <header class="min-w-0">
          <h1 class="font-display text-xl font-semibold text-balance text-text md:text-2xl">
            Account
          </h1>
          <p class="mt-1 max-w-[60ch] text-base text-pretty text-text-muted">
            How you log in to Flonion. Your business details live in{" "}
            <span class="whitespace-nowrap">Settings</span>.
          </p>
        </header>

        <Show when={failed()}>
          <WidgetError
            what="your account"
            onRetry={() => void session().refetch()}
          />
        </Show>

        <div class="grid gap-6 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:items-start">
          {/* Desktop: persistent left nav. Mobile: the list half of list-then-detail. */}
          <div
            class={cn(
              "md:sticky md:top-8",
              section() ? "hidden md:block" : "block",
            )}
          >
            <div class="hidden md:block">
              <SectionNav
                items={ACCOUNT_SECTIONS}
                label="Account sections"
                current={shown()}
                onSelect={open}
              />
            </div>
            <div class="rounded-lg border border-border bg-surface p-2 md:hidden">
              <SectionNav
                items={ACCOUNT_SECTIONS}
                label="Account sections"
                current={null}
                onSelect={open}
                detailed
              />
            </div>
          </div>

          <div class={cn("min-w-0", section() ? "block" : "hidden md:block")}>
            <Show when={section()}>
              <div class="mb-2">
                <BackToAccount onClick={close} />
              </div>
            </Show>

            <Show
              when={user()}
              fallback={
                <Show when={loading()}>
                  <SectionSkeleton fields={3} />
                </Show>
              }
            >
              {(signedIn) => (
                <Switch>
                  <Match when={shown() === "email"}>
                    <EmailPanel
                      email={signedIn().email}
                      verified={Boolean(signedIn().emailVerified)}
                      focusHeading={focusHeading("email")}
                    />
                  </Match>
                  <Match when={shown() === "password"}>
                    <PasswordPanel focusHeading={focusHeading("password")} />
                  </Match>
                  <Match when={shown() === "two-factor"}>
                    <TwoFactorPanel
                      enabled={Boolean(signedIn().twoFactorEnabled)}
                      onChanged={() => session().refetch()}
                      focusHeading={focusHeading("two-factor")}
                    />
                  </Match>
                </Switch>
              )}
            </Show>
          </div>
        </div>
      </div>
    </>
  );
}
