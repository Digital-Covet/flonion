import { Accordion } from "@ark-ui/solid/accordion";
import { IconChevronDown } from "@tabler/icons-solidjs";
import { For } from "solid-js";
import { SectionHeading } from "~/components/landing/brand";
import { SUPPORT_EMAIL } from "~/lib/constants";

const container = "mx-auto w-full max-w-[1200px] px-4 md:px-6";
const section = "py-16 md:py-24";

export type FaqItem = { q: string; a: string };

/** Shared FAQ section, anchored at `#faq` on the landing and pricing pages. */
export function Faq(props: { items: FaqItem[]; title?: string }) {
  return (
    <section
      id="faq"
      aria-labelledby="faq-title"
      class={`${section} scroll-mt-16`}
    >
      <div class={`${container} grid grid-cols-1 gap-10 lg:grid-cols-12`}>
        <div class="lg:col-span-4">
          <SectionHeading
            id="faq-title"
            eyebrow="FAQ"
            title={props.title ?? "Questions owners ask us"}
          />
          <p class="mt-4 text-text-muted">
            Something else on your mind?{" "}
            <a
              href={`mailto:${SUPPORT_EMAIL}`}
              class="font-medium text-primary underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Send us a note
            </a>
            .
          </p>
        </div>

        <Accordion.Root
          collapsible
          defaultValue={["faq-0"]}
          class="flex flex-col gap-3 lg:col-span-8"
        >
          <For each={props.items}>
            {(item, i) => (
              <Accordion.Item
                value={`faq-${i()}`}
                class="rounded-lg border border-border bg-surface"
              >
                <h3>
                  <Accordion.ItemTrigger class="flex min-h-14 w-full items-center justify-between gap-4 rounded-lg px-5 py-3 text-left font-display text-base font-semibold hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
                    {item.q}
                    <Accordion.ItemIndicator class="shrink-0 text-text-muted motion-safe:transition-transform motion-safe:duration-[var(--duration-fast)] data-[state=open]:rotate-180">
                      <IconChevronDown aria-hidden="true" class="size-5" />
                    </Accordion.ItemIndicator>
                  </Accordion.ItemTrigger>
                </h3>
                <Accordion.ItemContent class="px-5 pb-5 text-text-muted">
                  {item.a}
                </Accordion.ItemContent>
              </Accordion.Item>
            )}
          </For>
        </Accordion.Root>
      </div>
    </section>
  );
}
