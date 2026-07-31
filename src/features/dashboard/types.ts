import type { Component } from "solid-js";
import type { IconComponent } from "~/types";

export interface RecentActivity {
  id: string;
  name: string;
  initials: string;
  rating: number;
  preview: string;
  ago: string;
  source: string;
}

export interface QuickAction {
  label: string;
  href: string;
  icon: Component<{ size?: number; class?: string }>;
  description: string;
}
