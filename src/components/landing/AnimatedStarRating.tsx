import Star from "lucide-solid/icons/star";
import type { AnimatedStarRatingProps } from "~/types/landing";

export default function AnimatedStarRating({ count = 5, delay = 0, inView = true }: AnimatedStarRatingProps) {
  return (
    <div class="flex text-amber">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          size={20}
          class="star-item"
          style={{
            fill: i < count ? "currentColor" : "none",
            opacity: inView ? 1 : 0,
            transform: inView ? "scale(1)" : "scale(0.5)",
            "transition-delay": `${delay + i * 100}ms`,
          }}
        />
      ))}
    </div>
  );
}
