import { Dialog } from "@ark-ui/solid/dialog";
import Menu from "lucide-solid/icons/menu";
import X from "lucide-solid/icons/x";
import { createSignal } from "solid-js";
import {
  Brand,
  NavigationContent,
  ProfileSummary,
} from "./app-sidebar";

export function MobileNavigation() {
  const [isOpen, setIsOpen] = createSignal(false);

  return (
    <Dialog.Root open={isOpen()} onOpenChange={(details) => setIsOpen(details.open)}>
      <Dialog.Trigger
        aria-label="Open navigation menu"
        class="inline-flex size-9 items-center justify-center rounded-md border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted lg:hidden"
      >
        <Menu class="size-5" aria-hidden="true" />
      </Dialog.Trigger>

      <Dialog.Backdrop class="fixed inset-0 z-40 bg-slate-950/30" />
      <Dialog.Positioner class="fixed inset-0 z-50 flex">
        <Dialog.Content class="flex h-dvh w-[min(20rem,calc(100vw-2rem))] flex-col border-r border-border bg-card shadow-sm">
          <div class="flex items-center justify-between border-b border-border px-5 py-5">
            <Brand />
            <Dialog.CloseTrigger
              aria-label="Close navigation menu"
              class="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X class="size-4" aria-hidden="true" />
            </Dialog.CloseTrigger>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5">
            <NavigationContent onNavigate={() => setIsOpen(false)} />
          </div>

          <div class="border-t border-border p-4">
            <ProfileSummary />
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
