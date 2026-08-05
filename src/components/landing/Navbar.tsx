import Menu from "lucide-solid/icons/menu";
import { A } from "@solidjs/router";
import { navLinks } from "~/constants/landing";
import Wordmark from "~/assets/wordmark";

interface NavbarProps {
  mobileMenuOpen: boolean;
  onToggleMenu: () => void;
}

export default function Navbar(props: NavbarProps) {
  return (
    <nav class="fixed top-0 z-50 w-full border-b border-border bg-card/80 shadow-sm backdrop-blur-md">
      <div class="w-full flex items-center justify-between px-4 py-4 md:px-16">
        <a
          class="flex items-center"
          href="#"
          aria-label="Flonion home"
        >
          <Wordmark class="h-4" />
        </a>

        <div class="hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <a
              class="text-sm font-semibold tracking-wide text-muted-foreground transition-colors duration-200 hover:text-primary"
              href={link.href}
            >
              {link.label}
            </a>
          ))}
        </div>

        <div class="flex items-center gap-2">
          <button
            class="p-2 text-primary md:hidden"
            type="button"
            aria-label="Open menu"
            onClick={props.onToggleMenu}
          >
            <Menu size={32} aria-hidden="true" />
          </button>

          <A
            class="hidden px-4 py-2 text-sm font-semibold text-primary transition-colors duration-200 hover:text-primary-hover md:inline-block"
            href="/login"
          >
            Login
          </A>

          <A
            class="rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors duration-200 hover:bg-primary-hover hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]"
            href="/signup"
          >
            Get Started
          </A>
        </div>
      </div>
    </nav>
  );
}
