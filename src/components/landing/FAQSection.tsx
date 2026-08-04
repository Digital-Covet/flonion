import { createSignal, For } from "solid-js";
import { ChevronDown } from "lucide-solid";
import { faqItems } from "~/constants/landing";

function FAQItem(props: { question: string; answer: string }) {
  const [open, setOpen] = createSignal(false);
  const panelId = `faq-${props.question.replace(/\W+/g, "-").toLowerCase()}`;

  return (
    <div class="rounded-xl border border-border bg-card shadow-sm">
      <button
        type="button"
        class="flex w-full cursor-pointer items-center justify-between p-6 text-left text-card-foreground transition-colors hover:bg-muted/50"
        aria-expanded={open()}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <h3 class="text-base font-bold">{props.question}</h3>
        <span
          class={`ml-4 shrink-0 text-primary transition-transform duration-200 ${
            open() ? "rotate-180" : ""
          }`}
        >
          <ChevronDown size={20} aria-hidden="true" />
        </span>
      </button>
      <div
        id={panelId}
        class={`overflow-hidden transition-all duration-300 ease-out ${
          open() ? "max-h-96 opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div class="border-t border-border px-6 pb-6 pt-4 text-base text-muted-foreground">
          {props.answer}
        </div>
      </div>
    </div>
  );
}

export default function FAQSection() {
  return (
    <section class="bg-white px-4 py-32 md:px-16" id="faq">
      <div class="mx-auto max-w-3xl">
        <h2 class="mb-16 text-center text-3xl font-bold text-foreground">
          Frequently Asked Questions
        </h2>
        <div class="space-y-4">
          <For each={faqItems}>
            {(item) => <FAQItem question={item.question} answer={item.answer} />}
          </For>
        </div>
      </div>
    </section>
  );
}
