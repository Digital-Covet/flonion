import { Title } from "@solidjs/meta";
import { A } from "@solidjs/router";
import ArrowLeft from "lucide-solid/icons/arrow-left";
import { SettingsShell } from "~/features/settings/components/SettingsShell";
import TeamPage from "~/features/team/TeamPage";

/**
 * Team settings (DS §6) — members, invitations, and join requests inside the
 * shared settings template. Destructive removals live in the page's Danger
 * Zone and always ask for confirmation first.
 */
export default function TeamRoute() {
  return (
    <SettingsShell
      active="section-team"
      title="Team Settings"
      description="Manage your team members, roles, and invitations."
    >
      <Title>Team Settings — Flonion</Title>
      {/* List-then-detail on mobile: a way back to the section list. */}
      <A
        href="/settings"
        class="mb-4 inline-flex min-h-11 items-center gap-2 rounded-control px-2 text-sm font-medium text-muted-foreground transition-opacity duration-[180ms] hover:bg-muted hover:text-foreground motion-reduce:transition-none"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        Back to settings
      </A>
      <TeamPage />
    </SettingsShell>
  );
}
