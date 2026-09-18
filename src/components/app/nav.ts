import {
  IconBriefcase,
  IconBuildingStore,
  IconCalendarEvent,
  IconChartLine,
  IconFolders,
  IconInbox,
  IconLayoutDashboard,
  IconLayoutKanban,
  IconMessage,
  IconQrcode,
  IconSettings,
  IconTrendingUp,
  IconUserCircle,
  IconUsers,
} from "@tabler/icons-solidjs";
import type { Component, JSX } from "solid-js";
import type { BusinessInfo } from "~/components/app/context";

export type NavItem = {
  href: string;
  label: string;
  icon: Component<JSX.SvgSVGAttributes<SVGSVGElement>>;
  /** Match the exact path only, so a parent route isn't lit up by its children. */
  end?: boolean;
  /**
   * Target depends on the signed-in business, so the shell resolves it at
   * render time and `href` is only the fallback while that is still loading.
   */
  dynamic?: "profile";
};

/**
 * The owner's own company page — what a partner sees, and read-only for
 * everyone; the editing lives at `/marketplace/projects`. The lookup behind
 * `/company/:handle` falls back to the business id, so an owner who never
 * picked a vanity username still lands on their own page rather than a dead
 * link.
 */
export function profileHref(business: BusinessInfo | undefined): string | null {
  if (!business) return null;
  const handle = business.username?.trim() || business.businessId;
  return handle ? `/company/${handle}` : null;
}

export type NavGroup = { label?: string; items: NavItem[] };

/** Sidebar order follows the owner's daily loop: overview → reviews → growth → team. */
export const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", icon: IconLayoutDashboard },
    ],
  },
  {
    label: "Reviews",
    items: [
      { href: "/reviews/inbox", label: "Review inbox", icon: IconInbox },
      { href: "/reviews/new", label: "New request", icon: IconQrcode },
    ],
  },
  {
    label: "Marketing",
    items: [
      { href: "/marketing/seo", label: "Local SEO", icon: IconTrendingUp },
      { href: "/marketing/analytics", label: "Analytics", icon: IconChartLine },
    ],
  },
  {
    label: "Marketplace",
    items: [
      {
        href: "/marketplace",
        label: "Partners",
        icon: IconBuildingStore,
        end: true,
      },
      {
        href: "/marketplace/projects",
        label: "Projects",
        icon: IconFolders,
      },
      {
        href: "/marketplace",
        label: "View public profile",
        icon: IconBriefcase,
        dynamic: "profile",
      },
    ],
  },
  {
    label: "Collaborate",
    items: [
      {
        href: "/collaborations/meeting-schedular",
        label: "Meetings",
        icon: IconCalendarEvent,
      },
      {
        href: "/collaborations/tasks",
        label: "Tasks",
        icon: IconLayoutKanban,
      },
    ],
  },
  {
    label: "Business",
    items: [
      { href: "/settings", label: "Settings", icon: IconSettings, end: true },
      { href: "/settings/team", label: "Team", icon: IconUsers },
    ],
  },
];

/** Personal links: in the account menu on desktop, the drawer on phones. */
export const NAV_ACCOUNT: NavItem[] = [
  { href: "/account", label: "Account", icon: IconUserCircle },
  { href: "/feedback", label: "Send feedback", icon: IconMessage },
];

/** Mobile bottom tabs (spec §2 Layout); "More" opens the full nav. */
export const MOBILE_TABS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: IconLayoutDashboard,
  },
  { href: "/reviews/inbox", label: "Inbox", icon: IconInbox },
  { href: "/reviews/new", label: "Request", icon: IconQrcode },
  { href: "/marketing/seo", label: "SEO", icon: IconTrendingUp },
];
