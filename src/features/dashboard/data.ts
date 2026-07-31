import { Inbox, SearchCheck, ExternalLink, MessageSquareText } from "lucide-solid";
import type { QuickAction, RecentActivity } from "./types";

export const recentActivity: RecentActivity[] = [
  {
    id: "r1",
    name: "Sarah Mitchell",
    initials: "SM",
    rating: 5,
    preview: "Amazing experience! The staff was incredibly friendly and the food was outstanding.",
    ago: "2 hours ago",
    source: "Google",
  },
  {
    id: "r2",
    name: "James Rodriguez",
    initials: "JR",
    rating: 4,
    preview: "Great service overall. Wait time was a bit long but the quality made up for it.",
    ago: "5 hours ago",
    source: "Google",
  },
  {
    id: "r3",
    name: "Emily Chen",
    initials: "EC",
    rating: 5,
    preview: "Best restaurant in the area! Highly recommend the pasta special.",
    ago: "1 day ago",
    source: "Yelp",
  },
  {
    id: "r4",
    name: "Michael Thompson",
    initials: "MT",
    rating: 3,
    preview: "Food was decent but the ambiance could use some improvement.",
    ago: "2 days ago",
    source: "Facebook",
  },
  {
    id: "r5",
    name: "Lisa Park",
    initials: "LP",
    rating: 5,
    preview: "Absolutely love this place! Five stars all the way.",
    ago: "3 days ago",
    source: "Google",
  },
];

export const quickActions: QuickAction[] = [
  {
    label: "View Inbox",
    href: "/reviews/inbox",
    icon: Inbox,
    description: "Check and reply to reviews",
  },
  {
    label: "SEO Optimizer",
    href: "/marketing/seo",
    icon: SearchCheck,
    description: "Improve local search visibility",
  },
  {
    label: "Ask a Review",
    href: "/reviews/new",
    icon: ExternalLink,
    description: "Draft and submit a review",
  },
  {
    label: "AI Suggest",
    href: "/reviews/inbox",
    icon: MessageSquareText,
    description: "Get AI-powered reply suggestions",
  },
];
