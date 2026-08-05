import { Drawer, type DrawerOpenChangeDetails } from "@ark-ui/solid/drawer";
import X from "lucide-solid/icons/x";
import { navLinks } from "~/constants/landing";
import Wordmark from "~/assets/wordmark";

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
        <Drawer.Backdrop class="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm" />
        <Drawer.Positioner class="fixed inset-0 z-[60]">
          <Drawer.Content class="flex h-full w-full flex-col bg-card">
            <Drawer.Grabber class="flex justify-center pt-3 pb-1">
              <Drawer.GrabberIndicator class="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </Drawer.Grabber>

            <div class="flex items-center justify-between px-4 pb-6">
              <a
                class="flex items-center"
                href="#"
                onClick={props.onClose}
              >
                <Wordmark class="h-8" />
              </a>
              <Drawer.CloseTrigger
                class="p-2 text-primary"
                aria-label="Close menu"
              >
                <X size={32} aria-hidden="true" />
              </Drawer.CloseTrigger>
            </div>

            <nav class="mb-10 flex flex-1 flex-col gap-6 px-4" aria-label="Mobile navigation">
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

            <div class="mt-auto flex flex-col gap-4 px-4 pb-10">
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
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </div>
  );
}
