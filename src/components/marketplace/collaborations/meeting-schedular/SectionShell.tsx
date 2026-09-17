import type { SectionShellProps } from "~/types";

/**
 * Flonion DS §2 surface: 12px cards, 20px padding at call sites,
 * warm canvas tokens, subtle shadow. No animation here — parents
 * opt into E1 via `.e1-enter` so skeletons don't animate layout.
 */
function SectionShell(props: SectionShellProps) {
  return (
    <section
      class={`overflow-hidden rounded-card border border-border bg-card shadow-sm ${props.class ?? ""}`}
    >
      {props.children}
    </section>
  );
}

export default SectionShell;
