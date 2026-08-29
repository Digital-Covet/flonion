import { Progress } from "@ark-ui/solid/progress";
import type { Component } from "solid-js";
import type { LoadBarProps } from "~/types";

function LoadBar(props: LoadBarProps) {
  return (
    <div>
      <div class="mb-1 flex justify-between text-xs font-medium">
        <span>{props.label}</span>
        <span class={props.tone === "orange" ? "text-orange" : "text-primary"}>
          {props.detail}
        </span>
      </div>
      <Progress.Root value={props.value} class="h-2 overflow-hidden rounded-full bg-muted">
        <Progress.Track class="h-full">
          <Progress.Range
            class={`h-full rounded-full transition-[width] duration-700 ${
              props.tone === "orange" ? "bg-orange" : "bg-primary"
            }`}
          />
        </Progress.Track>
      </Progress.Root>
    </div>
  );
}

export default LoadBar;
