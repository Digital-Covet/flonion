import type { Component } from "solid-js";
import type { SectionShellProps } from "~/types";

function SectionShell(props: SectionShellProps) {
  return (
    <section class={`overflow-hidden rounded-lg border border-border bg-card shadow-sm ${props.class ?? ""}`}>
      {props.children}
    </section>
  );
}

export default SectionShell;
