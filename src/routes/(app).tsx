import { Meta } from "@solidjs/meta";
import type { RouteSectionProps } from "@solidjs/router";
import { AppShell } from "~/components/app/AppShell";

/** Signed-in app interior: sidebar on md+, bottom tabs on phones. */
export default function AppLayout(props: RouteSectionProps) {
  return (
    <>
      <Meta name="robots" content="noindex" />
      <AppShell>{props.children}</AppShell>
    </>
  );
}
