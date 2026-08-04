import { For } from "solid-js";
import { Accordion } from "@ark-ui/solid/accordion";
import ChevronDown from "lucide-solid/icons/chevron-down";
import { faqItems } from "~/constants/landing";

export default function FAQSection() {
  return (
    <section class="bg-white px-4 py-32 md:px-16" id="faq">
      <div class="mx-auto max-w-3xl">
        <h2 class="mb-16 text-center text-3xl font-bold text-foreground">
          Frequently Asked Questions
        </h2>
        <Accordion.Root multiple collapsible defaultValue={[]}>
          <div class="space-y-4">
            <For each={faqItems}>
              {(item) => (
                <Accordion.Item
                  value={item.question}
                  class="rounded-xl border border-border bg-card shadow-sm"
                >
                  <Accordion.ItemTrigger class="flex w-full cursor-pointer items-center justify-between p-6 text-left text-card-foreground transition-colors hover:bg-muted/50">
                    <h3 class="text-base font-bold">{item.question}</h3>
                    <Accordion.ItemIndicator class="ml-4 shrink-0 text-primary transition-transform duration-200 data-[state=open]:rotate-180">
                      <ChevronDown size={20} aria-hidden="true" />
                    </Accordion.ItemIndicator>
                  </Accordion.ItemTrigger>
                  <Accordion.ItemContent>
                    <div class="border-t border-border px-6 pb-6 pt-4 text-base text-muted-foreground">
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
