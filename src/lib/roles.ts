export const ROLE_DEFINITIONS = [
  { value: "admin", label: "Admin", description: "Full access to all features" },
  { value: "member", label: "Member", description: "Standard team member" },
  { value: "designer", label: "Designer", description: "Design-focused role" },
  { value: "developer", label: "Developer", description: "Development-focused role" },
  { value: "manager", label: "Manager", description: "Project management role" },
  { value: "marketing", label: "Marketing", description: "Marketing-focused role" },
] as const;

export type UserRole = (typeof ROLE_DEFINITIONS)[number]["value"];

export function getRoleLabel(role: string): string {
  const definition = ROLE_DEFINITIONS.find((r) => r.value === role);
  return definition?.label ?? role;
}

export function getRoleDescription(role: string): string {
  const definition = ROLE_DEFINITIONS.find((r) => r.value === role);
  return definition?.description ?? "";
}

export function isValidRole(role: string): role is UserRole {
  return ROLE_DEFINITIONS.some((r) => r.value === role);
}
