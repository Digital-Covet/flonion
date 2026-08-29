import type { Component } from "solid-js";
import type { StatusBadgeProps, BadgeTone } from "~/types";

const tones: Record<BadgeTone, string> = {
  primary: "bg-positive-muted text-positive",
  orange: "bg-orange-muted text-orange",
  purple: "bg-purple-muted text-purple",
};

function StatusBadge(props: StatusBadgeProps) {
  return (
    <span class={`rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-wide ${tones[props.tone]}`}>
      {props.children}
    </span>
  );
}

export default StatusBadge;
