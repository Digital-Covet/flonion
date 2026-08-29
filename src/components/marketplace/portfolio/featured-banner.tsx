import { GlassCard } from "./glass-card";

export const FeaturedBanner = () => (
  <GlassCard class="sm:col-span-2 h-48 relative overflow-hidden flex items-end justify-start p-6 group cursor-pointer">
    <div class="absolute inset-0 bg-muted z-0">
      <img
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        alt="Abstract 3D rendered landscape with flowing blue and white geometric shapes."
      />
    </div>
    <div class="absolute inset-0 bg-linear-to-t from-foreground/80 to-transparent z-10" />
    <div class="z-20">
      <h4 class="text-base font-medium text-primary-foreground mb-1">
        3D Brand Environments
      </h4>
      <p class="text-sm text-primary-foreground/90">
        Immersive webGL and interactive 3D assets for brand storytelling.
      </p>
    </div>
  </GlassCard>
);
