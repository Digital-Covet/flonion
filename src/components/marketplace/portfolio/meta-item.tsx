import { iconMap, type IconName } from "./icon-map";

interface MetaItemProps {
  icon: IconName;
  label: string;
}

export const MetaItem = (props: MetaItemProps) => {
  const IconComp = iconMap[props.icon];
  return (
    <div class="flex items-center gap-2 text-muted-foreground text-sm">
      <IconComp size={16} />
      <span>{props.label}</span>
    </div>
  );
};
