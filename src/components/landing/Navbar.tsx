import { A } from "@solidjs/router";
import Menu from "lucide-solid/icons/menu";
import InlineCombinationMark from "~/assets/inline-combination-mark";
import { navLinks } from "~/constants/landing";

interface NavbarProps {
  mobileMenuOpen: boolean;
  onToggleMenu: () => void;
}

export default function Navbar(props: NavbarProps) {
  return (
    <nav
      class="fixed top-0 z-50 w-full border-b border-border bg-background/95 shadow-sm"
      aria-label="Primary"
    >
      <div class="mx-auto flex w-full max-w-[1120px] items-center justify-between px-4 py-3 md:px-8">
        <A
          class="flex min-h-11 items-center"
          href="/"
          aria-label="Flonion home"
        >
          <InlineCombinationMark class="h-5" />
        </A>

        <div class="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <a
              class="inline-flex min-h-11 items-center text-sm font-medium text-muted-foreground transition-opacity duration-[180ms] hover:text-primary motion-reduce:transition-none"
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div class="flex items-center gap-2">
          <button
            class="grid size-11 place-items-center rounded-lg text-primary md:hidden"
            type="button"
            aria-label={props.mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={props.mobileMenuOpen}
            onClick={props.onToggleMenu}
          >
            <Menu size={24} aria-hidden="true" />
          </button>

          <A
            class="hidden min-h-11 items-center px-4 py-2 text-sm font-medium text-primary transition-opacity duration-[180ms] hover:text-primary-hover md:inline-flex motion-reduce:transition-none"
            href="/login"
          >
            Log in
          </A>

          <A
            class="hidden min-h-11 items-center rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition-opacity duration-[180ms] hover:bg-primary-hover md:inline-flex motion-reduce:transition-none"
            href="/signup"
          >
            Get started
          </A>
        </div>
      </div>
    </nav>
  );
}
