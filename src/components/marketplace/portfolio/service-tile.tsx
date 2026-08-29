import { cn } from "~/lib/cn";
import { GlassCard } from "./glass-card";
import { iconMap, type IconName } from "./icon-map";

interface ServiceTileProps {
  icon: IconName;
  title: string;
  description: string;
  class?: string;
}

export const ServiceTile = (props: ServiceTileProps) => {
  const IconComp = iconMap[props.icon];
  return (
    <GlassCard hover class={cn("cursor-pointer group", props.class)}>
      <div class="text-primary mb-4 group-hover:scale-110 transition-transform">
        <IconComp size={32} />
      </div>
      <h4 class="text-base font-medium text-foreground mb-2">{props.title}</h4>
      <p class="text-sm text-muted-foreground leading-relaxed">
        {props.description}
      </p>
    </GlassCard>
  );
};
