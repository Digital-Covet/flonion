import { Show } from "solid-js";
import { GlassCard } from "./glass-card";
import { Button } from "./button";
import { Badge } from "./badge";
import { MetaItem } from "./meta-item";

interface HeroSectionProps {
  name: string;
  logo?: string | null;
  description?: string | null;
  address?: string | null;
  sector?: string | null;
}

export const HeroSection = (props: HeroSectionProps) => (
  <section class="glass-card rounded-xl p-6 relative overflow-hidden flex flex-col md:flex-row gap-4 items-start">
    <div
      class="absolute inset-0 z-0 opacity-10 bg-cover bg-center pointer-events-none"
      aria-hidden="true"
    />

    <div class="z-10 w-24 h-24 md:w-32 md:h-32 rounded-lg bg-muted flex-shrink-0 border border-border overflow-hidden flex items-center justify-center">
      <Show
        when={props.logo}
        fallback={
          <span class="text-3xl md:text-4xl font-bold text-muted-foreground">
            {props.name.charAt(0).toUpperCase()}
          </span>
        }
      >
        <img
          class="w-full h-full object-cover"
          src={props.logo!}
          alt={`${props.name} logo`}
        />
      </Show>
    </div>

    <div class="z-10 flex-1 flex flex-col justify-between h-full min-w-0">
      <div>
        <div class="flex items-center gap-3 mb-2 flex-wrap">
          <h2 class="font-heading text-2xl md:text-3xl font-bold text-foreground">
            {props.name}
          </h2>
          <Badge>Verified</Badge>
        </div>
        <p class="text-base text-muted-foreground mb-4">
          {props.description ?? "No description available."}
        </p>
      </div>

      <div class="flex flex-wrap gap-4 mt-auto">
        <Show when={props.address}>
          <MetaItem icon="location" label={props.address!} />
        </Show>
        <Show when={props.sector}>
          <MetaItem icon="globe" label={props.sector!} />
        </Show>
      </div>
    </div>

    <div class="z-10 flex flex-col gap-3 w-full md:w-auto">
      <Button variant="primary">Request Proposal</Button>
      <Button variant="outline">Save Profile</Button>
    </div>
  </section>
);
