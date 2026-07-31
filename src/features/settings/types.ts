import type { LucideIcon } from "lucide-solid";

export interface FormFieldProps {
  label: string;
  value?: string;
  placeholder?: string;
  type?: "text" | "tel" | "email";
  hint?: string;
  helpTooltip?: string;
  class?: string;
  id: string;
  onInput?: (e: InputEvent) => void;
}

export interface ToggleRowProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  badgeIcon?: LucideIcon;
  id: string;
}

export interface SectionCardProps {
  title: string;
  icon: LucideIcon;
  children: unknown;
  class?: string;
  showAiBadge?: boolean;
}

export interface IntegrationData {
  name: string;
  connectedSince: string;
  icon: LucideIcon;
  iconColor?: string;
}

export interface GoogleLocationData {
  displayName: string;
  address: string;
  primaryPhone: string;
  websiteUrl: string;
  category: string;
  placeId: string;
}

export interface IntegrationCardProps {
  integration: IntegrationData;
  placeId?: string;
  onPlaceIdInput?: (e: InputEvent) => void;
  connected?: boolean;
  connecting?: boolean;
  locations?: GoogleLocationData[];
  selectedLocationIndex?: number;
  onConnect?: () => void;
  onLocationSelect?: (index: number) => void;
}
