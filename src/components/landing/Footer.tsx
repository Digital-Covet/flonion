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
    <footer class="relative z-10 w-full border-t border-slate-800 bg-slate-950 px-4 py-12 md:px-16">
      <div class="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 md:flex-row md:items-center">
        <div>
          <A
            class="mb-2 flex items-center gap-2"
            href="/"
            aria-label="Flonion home"
          >
            <InlineCombinationMark class="h-8" />
          </A>
          <p class="text-base text-slate-400">
            &copy; {date.getFullYear()} Flonion AI. Empowering Indian SMEs.
          </p>
        </div>
        <div class="flex flex-wrap gap-4">
          {allLinks.map((link) => (
            <a
              class="text-base text-slate-400 opacity-80 transition-colors hover:text-teal-300 hover:opacity-100"
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
