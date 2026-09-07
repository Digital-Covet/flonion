import Bell from "lucide-solid/icons/bell";
import BellRing from "lucide-solid/icons/bell-ring";
import Car from "lucide-solid/icons/car";
import LayoutDashboard from "lucide-solid/icons/layout-dashboard";
import MessageCircle from "lucide-solid/icons/message-circle";
import Scissors from "lucide-solid/icons/scissors";
import Smartphone from "lucide-solid/icons/smartphone";
import Sparkles from "lucide-solid/icons/sparkles";
import Store from "lucide-solid/icons/store";
import UtensilsCrossed from "lucide-solid/icons/utensils-crossed";
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
      "We send automated, friendly reminders via WhatsApp/SMS after a purchase, making it easy for customers to leave feedback.",
  },
  {
    question: "Does Flonion work with Google and WhatsApp?",
    answer:
      "Yes, we integrate directly with Google Business Profile and use WhatsApp for easy customer replies.",
  },
  {
    question: "Is my customer data secure?",
    answer:
      "Absolutely. We use bank-grade encryption and follow strict privacy standards to keep your data safe.",
  },
  {
    question: "Do I need technical skills to use this?",
    answer:
      "Not at all! If you can use WhatsApp, you can use Flonion. Our interface is designed for simplicity.",
  },
  {
    question: "Is pricing available in INR?",
    answer:
      "Yes, we offer affordable plans priced in INR with a 14-day free trial so you can see the value first.",
  },
];

export const featureItems: FeatureItem[] = [
  {
    icon: <Smartphone size={24} class="text-primary-foreground" />,
    title: "Automated Review Collection",
    description:
      "Collect reviews via WhatsApp and SMS instantly after every customer visit.",
    mockup: (
      <div class="w-full md:w-48 bg-slate-50 border border-border p-3 rounded-lg shadow-sm relative overflow-hidden group-hover:-translate-y-1 transition-transform">
        <div class="absolute top-0 right-0 w-16 h-16 bg-primary/20 rounded-bl-full" />
        <div class="flex items-center gap-2 mb-2">
          <div class="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center text-white">
            <MessageCircle size={10} />
          </div>
          <div class="text-[10px] font-bold text-card-foreground font-body">
            WhatsApp
          </div>
        </div>
        <div class="bg-white rounded p-2 mb-2">
          <div class="h-1.5 w-full bg-slate-300 rounded mb-1.5" />
          <div class="h-1.5 w-3/4 bg-slate-300 rounded" />
        </div>
        <div class="bg-primary text-white rounded p-1.5 text-[9px] text-center font-bold font-body inline-block">
          Review Us
        </div>
      </div>
    ),
  },
  {
    icon: <LayoutDashboard size={24} class="text-white" />,
    title: "Centralized Reputation Dashboard",
    description:
      "See your Google, Facebook, and Justdial reviews in one simple view.",
    class: "relative overflow-hidden",
  },
  {
    icon: <Sparkles size={24} class="text-white" />,
    title: "AI-Powered Marketing",
    description:
      "Turn your best reviews into social media posts and marketing insights with one click.",
    mockup: (
      <div class="w-full md:w-48 bg-white border border-border p-4 rounded-lg shadow-sm group-hover:-translate-y-1 transition-transform">
        <div class="flex items-center gap-2 mb-3">
          <div class="w-6 h-6 bg-purple rounded-full" />
          <div class="h-3 w-16 bg-slate-300 rounded" />
        </div>
        <div class="h-2 w-full bg-slate-200 rounded mb-2" />
        <div class="h-2 w-3/4 bg-slate-200 rounded mb-4" />
        <div class="bg-purple-muted rounded p-2 text-center text-[10px] text-purple font-bold font-body">
          "Amazing Service!" - ⭐⭐⭐⭐⭐
        </div>
      </div>
    ),
  },
  {
    icon: <BellRing size={24} class="text-primary-foreground" />,
    title: "Multi-Platform Alerts",
    description:
      "Get real-time notifications so you can thank your customers immediately.",
    mockup: (
      <div class="w-full md:w-48 bg-slate-50 border border-border p-3 rounded-lg shadow-sm relative group-hover:-translate-y-1 transition-transform">
        <div class="absolute -top-2 -right-2 w-6 h-6 bg-destructive rounded-full text-white text-[10px] font-bold flex items-center justify-center border-2 border-white">
          3
        </div>
        <div class="flex items-center gap-3 mb-2">
          <div class="w-8 h-8 rounded bg-muted flex items-center justify-center text-primary">
            <Bell size={14} />
          </div>
          <div class="flex-1">
            <div class="h-2 w-full bg-slate-300 rounded mb-1" />
            <div class="h-2 w-1/2 bg-slate-300 rounded" />
          </div>
        </div>
        <div class="bg-white rounded p-2 text-[9px] text-muted-foreground font-body">
          New review from Amit K. on Google
        </div>
      </div>
    ),
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
      "Our customers love the easy WhatsApp review link. Highly recommended!",
    name: "Vikram M.",
    business: "Heritage Silks, Jaipur",
    avatarColor: "tertiary",
  },
];

export const businessLogos: BusinessLogo[] = [
  {
    icon: <UtensilsCrossed size={20} class="text-primary" />,
    name: "Annapoorna Foods",
    color: "primary",
  },
  {
    icon: <Scissors size={20} class="text-purple" />,
    name: "Radiance Salon",
    color: "secondary",
  },
  {
    icon: <Store size={20} class="text-orange" />,
    name: "The Corner Store",
    color: "tertiary",
  },
  {
    icon: <Car size={20} class="text-info" />,
    name: "AutoWorks",
    color: "primary-container",
  },
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
