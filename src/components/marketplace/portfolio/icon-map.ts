import ArrowRight from "lucide-solid/icons/arrow-right";
import Box from "lucide-solid/icons/box";
import Calendar from "lucide-solid/icons/calendar";
import CheckCircle from "lucide-solid/icons/check-circle";
import Film from "lucide-solid/icons/film";
import Globe from "lucide-solid/icons/globe";
import Mail from "lucide-solid/icons/mail";
import MapPin from "lucide-solid/icons/map-pin";
import Sparkles from "lucide-solid/icons/sparkles";
import Star from "lucide-solid/icons/star";
import Users from "lucide-solid/icons/users";
import type { Component } from "solid-js";

export type IconName =
  | "location"
  | "globe"
  | "users"
  | "calendar"
  | "mail"
  | "star"
  | "arrow-right"
  | "film"
  | "sparkles"
  | "box"
  | "check";

export const iconMap: Record<
  IconName,
  Component<{ size?: number; class?: string }>
> = {
  location: MapPin,
  globe: Globe,
  users: Users,
  calendar: Calendar,
  mail: Mail,
  star: Star,
  "arrow-right": ArrowRight,
  film: Film,
  sparkles: Sparkles,
  box: Box,
  check: CheckCircle,
};
