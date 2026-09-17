import User from "lucide-solid/icons/user";
import AnimatedStarRating from "~/components/landing/AnimatedStarRating";
import { testimonialItems } from "~/constants/landing";

export default function TestimonialsSection() {
  const avatarBg = (color: string) => {
    const map: Record<string, string> = {
      primary: "bg-primary/10 text-primary",
      secondary: "bg-secondary/10 text-secondary",
      tertiary: "bg-warning-muted text-star-text",
    };
    return map[color] ?? "bg-primary/10 text-primary";
  };

  return (
    <section class="bg-background px-4 py-20 md:px-8 md:py-28" id="reviews">
      <div class="mx-auto max-w-[1120px]">
        <div class="mx-auto mb-12 max-w-2xl text-center">
          <p class="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-secondary">
            Owner stories
          </p>
          <h2 class="font-heading text-2xl font-semibold text-foreground md:text-3xl">
            What local businesses say
          </h2>
        </div>
        <div class="grid gap-6 md:grid-cols-3">
          {testimonialItems.map((item) => (
            <figure class="flex flex-col rounded-xl border border-border bg-card p-8 shadow-sm">
              <AnimatedStarRating count={item.rating} />
              <blockquote class="mb-8 mt-4 flex-1 text-base leading-[1.6] text-card-foreground">
                &ldquo;{item.quote}&rdquo;
              </blockquote>
              <figcaption class="flex items-center gap-4">
                <span
                  class={`grid size-11 shrink-0 place-items-center rounded-full ${avatarBg(item.avatarColor)}`}
                  aria-hidden="true"
                >
                  <User size={20} />
                </span>
                <span>
                  <span class="block text-sm font-medium text-card-foreground">
                    {item.name}
                  </span>
                  <span class="block text-xs text-muted-foreground">
                    {item.business}
                  </span>
                </span>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}
