
import { JSX } from "solid-js";

export interface NavLink {
  label: string;
  href: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

export interface FeatureItem {
  icon: JSX.Element;
  title: string;
  description: string;
  mockup?: JSX.Element;
  class?: string;
}

export interface TestimonialItem {
  rating: number;
  quote: string;
  name: string;
  business: string;
  avatarColor: string;
}

export interface BusinessLogo {
  icon: JSX.Element;
  name: string;
  color: string;
}

export interface StatItem {
  label: string;
  value: string | number;
  change?: string;
  progress?: number;
}

export interface AnimatedStarRatingProps {
  count?: number;
  delay?: number;
  inView?: boolean;
}
