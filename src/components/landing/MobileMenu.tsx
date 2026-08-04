import { Show } from "solid-js";
import { X } from "lucide-solid";
import { navLinks } from "~/constants/landing";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileMenu(props: MobileMenuProps) {
  return (
    <Show when={props.open}>
      <div class="fixed inset-0 z-[60] bg-card md:hidden">
        <div class="flex h-full flex-col p-4">
          <div class="mb-10 flex items-center justify-between">
            <a
              class="font-heading text-2xl font-bold text-primary"
              href="#"
              onClick={props.onClose}
            >
              Flonion
            </a>
            <button
              class="p-2 text-primary"
              type="button"
              aria-label="Close menu"
              onClick={props.onClose}
            >
              <X size={32} aria-hidden="true" />
            </button>
          </div>

          <nav class="mb-10 flex flex-col gap-6" aria-label="Mobile navigation">
            {navLinks.map((link) => (
              <a
                class="text-xl text-card-foreground transition-colors hover:text-primary"
                href={link.href}
                onClick={props.onClose}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div class="mt-auto flex flex-col gap-4 pb-10">
            <a
              class="rounded-lg border border-primary py-4 text-center font-bold text-primary"
              href="#"
              onClick={props.onClose}
            >
              Login
            </a>
            <a
              class="rounded-lg bg-primary py-4 text-center font-bold text-primary-foreground shadow-md"
              href="#"
              onClick={props.onClose}
            >
              Get Started
            </a>
          </div>
        </div>
      </div>
    </Show>
  );
}
