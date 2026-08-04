import { createSignal, onMount, onCleanup } from "solid-js";
import User from "lucide-solid/icons/user";
import { testimonialItems } from "~/constants/landing";
import AnimatedStarRating from "~/components/landing/AnimatedStarRating";

export default function TestimonialsSection() {
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

  const accentColor = (color: string) => {
    const map: Record<string, string> = {
      primary: "text-primary",
      secondary: "text-purple",
      tertiary: "text-orange",
    };
    return map[color] || "text-primary";
  };

  return (
    <section class="bg-muted px-4 py-32 md:px-16" id="reviews" ref={sectionRef}>
      <div class="mx-auto max-w-[1280px]">
        <h2 class="mb-20 text-center text-3xl font-bold text-foreground">
          What local businesses say
        </h2>
        <div class="grid gap-8 md:grid-cols-3">
          {testimonialItems.map((item, index) => (
            <div
              class={`rounded-xl bg-card p-8 shadow-md transition-all duration-300 hover:-translate-y-2 ${
                visible()
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-7"
              }`}
              style={{ "transition-delay": `${index * 100}ms` }}
            >
              <div class="mb-6">
                <AnimatedStarRating count={item.rating} inView={visible()} />
              </div>
              <p class="mb-8 text-base italic leading-relaxed text-card-foreground">
                &ldquo;{item.quote}&rdquo;
              </p>
              <div class="flex items-center gap-4">
                <div
                  class={`flex h-12 w-12 items-center justify-center rounded-full border border-border bg-muted ${accentColor(item.avatarColor)}`}
                >
                  <User size={20} aria-hidden="true" />
                </div>
                <div>
                  <div class="text-sm font-bold text-card-foreground">
                    {item.name}
                  </div>
                  <div class="text-xs text-muted-foreground">
                    {item.business}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
