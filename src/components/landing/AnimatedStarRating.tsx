import Star from "lucide-solid/icons/star";
import type { AnimatedStarRatingProps } from "~/types/landing";

/** Calm, instant star display (DS §1 anti-pattern: no gamified bounce or
 *  confetti on anything rating-shaped). Number always renders next to stars. */
export default function AnimatedStarRating(props: AnimatedStarRatingProps) {
  const count = () => props.count ?? 5;

  return (
    <div
      class="flex items-center gap-1 text-star"
      role="img"
      aria-label={`Rated ${count()} out of 5`}
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Star
          size={18}
          class="fill-star"
          aria-hidden="true"
          opacity={i < count() ? 1 : 0.3}
        />
      ))}
      <span class="tnum ml-1 text-sm font-medium text-card-foreground">
        {count()}.0
      </span>
    </div>
  );
}
