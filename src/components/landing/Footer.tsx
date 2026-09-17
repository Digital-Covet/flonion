import { A } from "@solidjs/router";
import InlineCombinationMark from "~/assets/inline-combination-mark";
import { navLinks } from "~/constants/landing";

export default function Footer() {
  const allLinks = [
    ...navLinks,
    { label: "Privacy Policy", href: "#" },
    { label: "Terms of Service", href: "#" },
  ];
  const date = new Date();
  return (
    <footer class="relative z-10 w-full border-t border-border bg-card px-4 py-12 md:px-8">
      <div class="mx-auto flex max-w-[1120px] flex-col items-start justify-between gap-6 md:flex-row md:items-center">
        <div>
          <A
            class="mb-2 inline-flex min-h-11 items-center"
            href="/"
            aria-label="Flonion home"
          >
            <InlineCombinationMark class="h-6" />
          </A>
          <p class="max-w-sm text-sm leading-[1.6] text-muted-foreground">
            &copy; {date.getFullYear()} Flonion AI. Reputation, bookings, and
            local SEO for neighbourhood businesses.
          </p>
        </div>
        <nav class="flex flex-wrap gap-x-6 gap-y-3" aria-label="Footer">
          {allLinks.map((link) => (
            <a
              class="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground transition-opacity duration-[180ms] hover:text-primary motion-reduce:transition-none"
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>
    </footer>
  );
}
