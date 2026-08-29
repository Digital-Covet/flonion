import { Progress } from "@ark-ui/solid/progress";

interface ClientProgressProps {
  name: string;
  percentage: number;
  colorClass: string;
}

export default function ClientProgress(props: ClientProgressProps) {
  return (
    <div class="flex items-center gap-3">
      <div class={`w-2 h-2 rounded-full ${props.colorClass}`}></div>
      <div class="flex-1">
        <div class="flex justify-between items-center mb-1">
          <span class="text-sm font-medium text-foreground">{props.name}</span>
          <Progress.ValueText class="text-xs font-medium text-muted-foreground">
            {props.percentage}%
          </Progress.ValueText>
        </div>
        <Progress.Root value={props.percentage} class="w-full">
          <Progress.Track class="bg-border rounded-full h-1.5">
            <Progress.Range class={`h-1.5 rounded-full ${props.colorClass}`} />
          </Progress.Track>
        </Progress.Root>
      </div>
    </div>
  );
}
