import { Drawer, type DrawerOpenChangeDetails } from "@ark-ui/solid/drawer";
import { A } from "@solidjs/router";
import X from "lucide-solid/icons/x";
import Wordmark from "~/assets/wordmark";
import { navLinks } from "~/constants/landing";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileMenu(props: MobileMenuProps) {
  const handleChange = (details: DrawerOpenChangeDetails) => {
    if (!details.open) props.onClose();
  };

  return (
    <div class="md:hidden">
      <Drawer.Root open={props.open} onOpenChange={handleChange}>
        <Drawer.Backdrop class="fixed inset-0 z-[60] bg-black/50" />
        <Drawer.Positioner class="fixed inset-0 z-[60]">
          <Drawer.Content class="flex h-full w-full flex-col bg-card">
            <div class="flex min-h-11 items-center justify-between px-4 py-3">
              <A
                class="flex min-h-11 items-center"
                href="/"
                aria-label="Flonion home"
                onClick={props.onClose}
              >
                <Wordmark class="h-7" />
              </A>
              <Drawer.CloseTrigger
                class="grid size-11 place-items-center rounded-lg text-primary"
                aria-label="Close menu"
              >
                <X size={24} aria-hidden="true" />
              </Drawer.CloseTrigger>
            </div>

            <nav
              class="flex flex-1 flex-col gap-1 px-4 py-4"
              aria-label="Mobile navigation"
            >
              {navLinks.map((link) => (
                <a
                  class="inline-flex min-h-11 items-center rounded-lg px-2 text-lg font-medium text-card-foreground transition-opacity duration-[180ms] hover:bg-muted motion-reduce:transition-none"
                  href={link.href}
                  onClick={props.onClose}
                >
                  {link.label}
                </a>
              ))}
            </nav>

            <div class="mt-auto flex flex-col gap-3 px-4 pb-10">
              <A
                class="inline-flex min-h-11 items-center justify-center rounded-lg border border-input py-3 text-center font-medium text-primary"
                href="/login"
                onClick={props.onClose}
              >
                Log in
              </A>
              <A
                class="inline-flex min-h-11 items-center justify-center rounded-lg bg-primary py-3 text-center font-medium text-primary-foreground shadow-sm"
                href="/signup"
                onClick={props.onClose}
              >
                Get started
              </A>
            </div>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </div>
  );
}
