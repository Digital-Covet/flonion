import { createSignal, onMount, onCleanup } from "solid-js";
import ArrowRight from "lucide-solid/icons/arrow-right";

export default function CTASection() {
  const [visible, setVisible] = createSignal(false);
  let sectionRef: HTMLDivElement | undefined;

  onMount(() => {
    if (!sectionRef) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(sectionRef);
    onCleanup(() => observer.disconnect());
  });

  return (
    <section
      class="relative mt-32 overflow-hidden bg-primary px-4 py-24 text-primary-foreground md:px-16"
      ref={sectionRef}
    >
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.14)_0%,transparent_70%)]"
        aria-hidden="true"
      />
      <div class="relative z-10 mx-auto flex max-w-[1280px] flex-col items-center gap-12 md:grid md:grid-cols-2">
        <div class="text-center md:text-left">
          <h2 class="mb-8 font-heading text-[32px] font-bold leading-tight md:text-[48px] md:leading-[1.1]">
            Ready to become the #1 rated business in your area?
          </h2>
          <a
            class="inline-flex items-center gap-2 rounded-lg bg-white px-8 py-4 text-sm font-bold text-primary shadow-md transition-all duration-200 hover:bg-teal-50 hover:scale-[1.02] hover:-translate-y-0.5 active:scale-[0.98]"
            href="#"
          >
            Start Your Free Trial
            <ArrowRight size={18} aria-hidden="true" />
          </a>
          <p class="mt-4 text-xs text-teal-100">
            No credit card required - 14-day free trial
          </p>
        </div>

        <div class="flex justify-center">
          <div
            class={`relative h-[500px] w-64 overflow-hidden rounded-[2rem] border-8 border-slate-900 bg-slate-50 shadow-md transition-all duration-700 ${
              visible()
                ? "opacity-100 scale-100 translate-y-0"
                : "opacity-0 scale-95 translate-y-7"
            }`}
          >
            <div class="absolute top-0 flex h-6 w-full justify-center rounded-b-xl bg-slate-900">
              <div class="mt-1 h-4 w-16 rounded-b-lg bg-black" />
            </div>
            <div class="h-full bg-card p-4 pt-10">
              <div class="mb-4 font-heading text-2xl font-bold text-card-foreground">
                Dashboard
              </div>
              <div class="mb-4 rounded-lg bg-primary p-4 text-primary-foreground shadow-sm">
                <div class="text-xs opacity-80">New Reviews Today</div>
                <div class="font-heading text-3xl font-bold">+14</div>
              </div>
              <div class="space-y-3">
                {["w-3/4", "w-5/6"].map((width, index) => (
                  <div class="flex items-center gap-3 rounded-lg border border-border bg-slate-50 p-3 shadow-sm">
                    <div class="h-8 w-8 rounded-full bg-slate-300" />
                    <div class="flex-1">
                      <div class={`mb-2 h-2 rounded bg-slate-300 ${width}`} />
                      <div
                        class={`h-2 rounded bg-slate-300 ${
                          index === 0 ? "w-1/2" : "w-1/3"
                        }`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
