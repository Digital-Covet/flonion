import { For } from "solid-js";
import InlineCombinationMark from "~/assets/inline-combination-mark";
import { authClient } from "~/lib/auth-client";
import { SUPPORT_EMAIL } from "~/lib/constants";

const container = "mx-auto w-full max-w-[1200px] px-4 md:px-6";

const FOOTER_LINKS = [
  {
    heading: "Product",
    links: [
      { href: "/#features", label: "Features" },
      { href: "/pricing", label: "Pricing" },
      { href: "/#faq", label: "FAQ" },
      { href: "/marketplace", label: "Marketplace", auth: true },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/signup", label: "Start free" },
      { href: "/login", label: "Log in" },
      { href: `mailto:${SUPPORT_EMAIL}`, label: "Send feedback" },
    ],
  },
];

export function SiteFooter() {
  // `auth` links are only shown once the visitor is signed in.
  const session = authClient.useSession();
  const signedIn = () => Boolean(session().data?.user);

  return (
    <footer data-surface="dark" class="bg-background py-12 text-text">
      <div
        class={`${container} flex flex-col gap-10 md:flex-row md:justify-between`}
      >
        <div class="max-w-xs">
          <InlineCombinationMark class="h-6 w-auto [&>path:first-of-type]:fill-primary" />
          <p class="mt-4 text-sm text-text-muted">
            Genuine reviews, faster replies and better local search for the
            businesses in your neighbourhood.
          </p>
        </div>
        <div class="grid grid-cols-2 gap-10">
          <For each={FOOTER_LINKS}>
            {(group) => (
              <nav aria-label={group.heading}>
                <h2 class="font-display text-sm font-semibold">
                  {group.heading}
                </h2>
                <ul class="mt-3 flex flex-col">
                  <For
                    each={group.links.filter(
                      (link) => !link.auth || signedIn(),
                    )}
                  >
                    {(link) => (
                      <li>
                        <a
                          href={link.href}
                          class="inline-flex min-h-11 items-center text-sm text-text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                        >
                          {link.label}
                        </a>
                      </li>
                    )}
                  </For>
                </ul>
              </nav>
            )}
          </For>
        </div>
      </div>
      <div class={`${container} mt-10 border-t border-border pt-6`}>
        <p class="text-xs text-text-muted">
          © {new Date().getFullYear()} Flonion. Google, JustDial, Facebook,
          Tripadvisor and Yelp are trademarks of their owners.
        </p>
      </div>
    </footer>
  );
}
