import { Accordion } from "@ark-ui/solid/accordion";
import ChevronDown from "lucide-solid/icons/chevron-down";
import { For } from "solid-js";
import { faqItems } from "~/constants/landing";

export default function FAQSection() {
  return (
    <section class="bg-card px-4 py-20 md:px-8 md:py-28" id="faq">
      <div class="mx-auto max-w-3xl">
        <div class="mx-auto mb-12 max-w-2xl text-center">
          <p class="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-secondary">
            Questions, answered
          </p>
          <h2 class="font-heading text-2xl font-semibold text-foreground md:text-3xl">
            Frequently asked questions
          </h2>
        </div>
        <Accordion.Root multiple collapsible defaultValue={[]}>
          <div class="space-y-4">
            <For each={faqItems}>
              {(item) => (
                <Accordion.Item
                  value={item.question}
                  class="rounded-xl border border-border bg-background shadow-sm"
                >
                  <Accordion.ItemTrigger class="flex min-h-11 w-full cursor-pointer items-center justify-between gap-4 p-5 text-left text-card-foreground transition-opacity duration-[180ms] hover:bg-muted/60 motion-reduce:transition-none">
                    <span class="text-base font-medium">{item.question}</span>
                    <Accordion.ItemIndicator class="ml-4 shrink-0 text-primary transition-transform duration-200 data-[state=open]:rotate-180">
                      <ChevronDown size={20} aria-hidden="true" />
                    </Accordion.ItemIndicator>
                  </Accordion.ItemTrigger>
                  <Accordion.ItemContent>
                    <div class="border-t border-border px-5 pb-5 pt-4 text-base leading-[1.6] text-muted-foreground">
                      {item.answer}
                    </div>
                  </Accordion.ItemContent>
                </Accordion.Item>
              )}
            </For>
          </div>
        </Accordion.Root>
      </div>
    </section>
  );
}
