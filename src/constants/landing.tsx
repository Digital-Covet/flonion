import BellRing from "lucide-solid/icons/bell-ring";
import CalendarCheck from "lucide-solid/icons/calendar-check";
import LayoutDashboard from "lucide-solid/icons/layout-dashboard";
import QrCode from "lucide-solid/icons/qr-code";
import SearchCheck from "lucide-solid/icons/search-check";
import Sparkles from "lucide-solid/icons/sparkles";
import Store from "lucide-solid/icons/store";
import type {
  BusinessLogo,
  ComparisonFeature,
  FaqItem,
  FeatureItem,
  NavLink,
  PricingFaqItem,
  PricingTier,
  TestimonialItem,
} from "~/types/landing";

export const navLinks: NavLink[] = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how-it-works" },
  { href: "#reviews", label: "Reviews" },
  { label: "Pricing", href: "/pricing" },
  { href: "#faq", label: "FAQ" },
];

export const faqItems: FaqItem[] = [
  {
    question: "How does Flonion help me get more reviews?",
    answer:
      "Print your QR table stand or share your review link. Customers scan, rate, and submit in under a minute — then get redirected to your Google profile. Every visit is tracked so you can see scans, submits, and redirects.",
  },
  {
    question: "Does Flonion work with Google and WhatsApp?",
    answer:
      "Yes. Connect Google Business Profile to read and reply to reviews from one inbox. Share review links over WhatsApp or SMS. Google stays the system of record — Flonion never posts anything without your approval.",
  },
  {
    question: "How does the AI reply drafting work?",
    answer:
      "When you open a review, Flonion drafts a reply in your chosen tone (Professional, Friendly, or Formal). Every draft is clearly labelled “AI draft · edit before posting” and stays in an editable field until you approve and post it yourself.",
  },
  {
    question: "Is my customer data secure?",
    answer:
      "Customer details are used only to send the review request you created. Connections use scoped OAuth tokens, secrets stay server-side, and team access follows least-privilege roles. Disconnecting Google revokes access immediately.",
  },
  {
    question: "Do I need technical skills to use this?",
    answer:
      "Not at all. If you can use WhatsApp, you can use Flonion. Onboarding is a 4-step wizard (business basics → platforms → review settings → invite team), and the dashboard always shows the single next action.",
  },
  {
    question: "Is pricing available in INR?",
    answer:
      "Yes, plans are priced in INR with a 14-day free trial. Start free, upgrade when review volume or seats demand it — downgrade takes effect at the end of your billing cycle.",
  },
];

export const featureItems: FeatureItem[] = [
  {
    icon: <QrCode size={22} class="text-primary-foreground" />,
    title: "QR review capture",
    description:
      "A scannable link + print-ready A6 table stand. Customers submit in under 60 seconds; scans, submits, and redirects are tracked per link.",
    span: true,
  },
  {
    icon: <Sparkles size={22} class="text-primary-foreground" />,
    title: "AI reply drafts",
    description:
      "One click drafts a reply in three tones. Every suggestion is labelled “AI draft · edit before posting” — you always approve before anything goes public.",
    span: true,
  },
  {
    icon: <LayoutDashboard size={22} class="text-primary-foreground" />,
    title: "Reputation dashboard",
    description:
      "Average rating, total reviews, QR scans (30d), and unreplied count — with the next best action on top.",
  },
  {
    icon: <SearchCheck size={22} class="text-primary-foreground" />,
    title: "Local SEO checklist",
    description:
      "Profile completeness score with prioritised fixes, keywords, competitors, and photo guidance.",
  },
  {
    icon: <CalendarCheck size={22} class="text-primary-foreground" />,
    title: "Bookings",
    description:
      "Guests pick a labelled slot (Free / Booked / Past) and get a timezone-aware confirmation. No double-booking.",
  },
  {
    icon: <BellRing size={22} class="text-primary-foreground" />,
    title: "Marketplace, tasks & meetings",
    description:
      "Find local partners, run the team kanban with keyboard-friendly “Move to…” actions, and schedule partner meetings.",
  },
];

export const howItWorksSteps = [
  {
    step: "1",
    title: "Create your link & QR",
    description:
      "Add your platforms (Google, Yelp, Facebook, JustDial) and print the A6 table stand. Takes under 60 seconds.",
  },
  {
    step: "2",
    title: "Customers scan & submit",
    description:
      "They rate, optionally polish wording with clearly-labelled AI drafts, and submit. Works on flaky connections too.",
  },
  {
    step: "3",
    title: "They land on Google",
    description:
      "One tap opens your Google profile with a “Copy my review” helper, so the words they wrote travel with them.",
  },
  {
    step: "4",
    title: "You reply in minutes",
    description:
      "The inbox collects every review. Pick a tone, edit the AI draft, post — and watch unreplied hit zero.",
  },
];

export const testimonialItems: TestimonialItem[] = [
  {
    rating: 5,
    quote: "Flonion has doubled our Google reviews in just two months!",
    name: "Rajesh K.",
    business: "Swaad Restaurant, Pune",
    avatarColor: "primary",
  },
  {
    rating: 5,
    quote:
      "Finally, a simple way to manage our reputation without needing a tech team.",
    name: "Ananya S.",
    business: "Bloom Salon, Bengaluru",
    avatarColor: "secondary",
  },
  {
    rating: 5,
    quote:
      "Our customers love the easy QR review link. Replies take me minutes now.",
    name: "Vikram M.",
    business: "Heritage Silks, Jaipur",
    avatarColor: "tertiary",
  },
];

export const businessLogos: BusinessLogo[] = [
  { icon: <Store size={18} class="text-primary" />, name: "Annapoorna Foods" },
  { icon: <Store size={18} class="text-secondary" />, name: "Radiance Salon" },
  {
    icon: <Store size={18} class="text-star-text" />,
    name: "The Corner Store",
  },
  { icon: <Store size={18} class="text-secondary" />, name: "AutoWorks" },
];

export const dashboardStats = [
  {
    label: "Total Reviews",
    value: 842,
    change: "+12% this week",
  },
  {
    label: "Average Rating",
    value: "4.8",
    progress: 90,
  },
];

export const pricingTiers: PricingTier[] = [
  {
    name: "Starter",
    monthlyPrice: 0,
    annualPrice: 0,
    description:
      "Perfect for small businesses just getting started with online reputation.",
    features: [
      "50 AI-powered reviews/month",
      "1 user seat",
      "WhatsApp & SMS collection",
      "Google Business integration",
      "Basic reputation dashboard",
      "Email support",
    ],
    cta: "Get Started Free",
    ctaHref: "/signup",
  },
  {
    name: "Business",
    monthlyPrice: 29,
    annualPrice: 290,
    description:
      "For growing businesses that need multi-platform presence and AI marketing.",
    badge: "Most Popular",
    features: [
      "500 AI-powered reviews/month",
      "5 user seats",
      "Multi-platform (Google, Facebook, Justdial)",
      "AI marketing content generation",
      "Real-time notifications & alerts",
      "Advanced analytics & insights",
      "Priority email & chat support",
    ],
    cta: "Start Free Trial",
    ctaHref: "/signup",
    highlighted: true,
  },
  {
    name: "Enterprise",
    monthlyPrice: 99,
    annualPrice: 990,
    description:
      "For large organizations requiring custom solutions and dedicated support.",
    features: [
      "Unlimited AI-powered reviews",
      "Unlimited user seats",
      "All Business features included",
      "Custom API access & integrations",
      "Dedicated account manager",
      "Custom branding & white-label",
      "SLA guarantee (99.9% uptime)",
      "Onboarding & training session",
    ],
    cta: "Contact Sales",
    ctaHref: "/contact",
  },
];

export const comparisonFeatures: ComparisonFeature[] = [
  {
    category: "Review Collection",
    features: [
      {
        name: "AI-powered reviews/month",
        starter: "50",
        business: "500",
        enterprise: "Unlimited",
      },
      {
        name: "WhatsApp & SMS collection",
        starter: true,
        business: true,
        enterprise: true,
      },
      {
        name: "Automated follow-ups",
        starter: false,
        business: true,
        enterprise: true,
      },
      {
        name: "Custom review request templates",
        starter: false,
        business: true,
        enterprise: true,
      },
    ],
  },
  {
    category: "Platforms",
    features: [
      {
        name: "Google Business",
        starter: true,
        business: true,
        enterprise: true,
      },
      { name: "Facebook", starter: false, business: true, enterprise: true },
      { name: "Justdial", starter: false, business: true, enterprise: true },
      {
        name: "Custom platform integration",
        starter: false,
        business: false,
        enterprise: true,
      },
    ],
  },
  {
    category: "AI & Marketing",
    features: [
      {
        name: "Basic dashboard",
        starter: true,
        business: true,
        enterprise: true,
      },
      {
        name: "AI marketing content generation",
        starter: false,
        business: true,
        enterprise: true,
      },
      {
        name: "Sentiment analysis",
        starter: false,
        business: true,
        enterprise: true,
      },
      {
        name: "Competitor benchmarking",
        starter: false,
        business: false,
        enterprise: true,
      },
    ],
  },
  {
    category: "Team & Support",
    features: [
      {
        name: "User seats",
        starter: "1",
        business: "5",
        enterprise: "Unlimited",
      },
      {
        name: "Email support",
        starter: true,
        business: true,
        enterprise: true,
      },
      {
        name: "Priority chat support",
        starter: false,
        business: true,
        enterprise: true,
      },
      {
        name: "Dedicated account manager",
        starter: false,
        business: false,
        enterprise: true,
      },
      {
        name: "SLA guarantee",
        starter: false,
        business: false,
        enterprise: true,
      },
    ],
  },
];

export const pricingFaqItems: PricingFaqItem[] = [
  {
    question: "Can I switch plans at any time?",
    answer:
      "Yes, you can upgrade or downgrade your plan at any time. When upgrading, you'll be charged the prorated difference. When downgrading, the change takes effect at the end of your current billing cycle.",
  },
  {
    question: "Is there a free trial for paid plans?",
    answer:
      "Absolutely! Both Business and Enterprise plans come with a 14-day free trial. No credit card required to start. You'll only be charged after the trial ends.",
  },
  {
    question: "What payment methods do you accept?",
    answer:
      "We accept all major credit and debit cards (Visa, Mastercard, RuPay), UPI, and net banking. For Enterprise plans, we also support invoice-based payments.",
  },
  {
    question: "What happens when I reach my review limit?",
    answer:
      "On the Starter plan, collection pauses until the next billing cycle. On Business and Enterprise, you'll receive a notification and can choose to upgrade or wait for the next cycle.",
  },
  {
    question: "Do you offer refunds?",
    answer:
      "Yes, we offer a full refund within 7 days of any new subscription or upgrade. Contact our support team and we'll process it promptly.",
  },
];
