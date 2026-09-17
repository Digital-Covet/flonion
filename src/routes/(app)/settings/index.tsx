import { Title } from "@solidjs/meta";
import { SettingsShell } from "~/features/settings/components/SettingsShell";
import { SettingsPage } from "~/features/settings/SettingsPage";

/**
 * Settings — business profile, integrations, review links, preferences,
 * keywords, and danger zone (DS §6). Team lives at `/settings/team` inside
 * the same shared template.
 */
export default function SettingsRoute() {
  return (
    <SettingsShell
      active="section-profile"
      title="Settings"
      description="Manage your business profile and platform preferences."
    >
      <Title>Settings — Flonion</Title>
      <SettingsPage />
    </SettingsShell>
  );
}
