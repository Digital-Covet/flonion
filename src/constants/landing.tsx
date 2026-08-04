import Store from "lucide-solid/icons/store";
import Smartphone from "lucide-solid/icons/smartphone";
import LayoutDashboard from "lucide-solid/icons/layout-dashboard";
import Sparkles from "lucide-solid/icons/sparkles";
import BellRing from "lucide-solid/icons/bell-ring";
import UtensilsCrossed from "lucide-solid/icons/utensils-crossed";
import Scissors from "lucide-solid/icons/scissors";
import Car from "lucide-solid/icons/car";
import MessageCircle from "lucide-solid/icons/message-circle";
import Bell from "lucide-solid/icons/bell";
import { FaqItem, FeatureItem, TestimonialItem, BusinessLogo, NavLink } from "~/types/landing";

export const navLinks: NavLink[] = [
  { label: "Features", href: "#features" },
  { label: "How it Works", href: "#how-it-works" },
  { href: "#reviews", label: "Reviews" },
  { href: "#faq", label: "FAQ" },
];

export const faqItems: FaqItem[] = [
  {
    question: "How does Flonion help me get more reviews?",
    answer: "We send automated, friendly reminders via WhatsApp/SMS after a purchase, making it easy for customers to leave feedback.",
  },
  {
    question: "Does Flonion work with Google and WhatsApp?",
    answer: "Yes, we integrate directly with Google Business Profile and use WhatsApp for easy customer replies.",
  },
  {
    question: "Is my customer data secure?",
    answer: "Absolutely. We use bank-grade encryption and follow strict privacy standards to keep your data safe.",
  },
  {
    question: "Do I need technical skills to use this?",
    answer: "Not at all! If you can use WhatsApp, you can use Flonion. Our interface is designed for simplicity.",
  },
  {
    question: "Is pricing available in INR?",
    answer: "Yes, we offer affordable plans priced in INR with a 14-day free trial so you can see the value first.",
  },
];

export const featureItems: FeatureItem[] = [
  {
    icon: <Smartphone size={24} class="text-primary-foreground" />,
    title: "Automated Review Collection",
    description: "Collect reviews via WhatsApp and SMS instantly after every customer visit.",
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
    description: "See your Google, Facebook, and Justdial reviews in one simple view.",
    class: "relative overflow-hidden",
  },
  {
    icon: <Sparkles size={24} class="text-white" />,
    title: "AI-Powered Marketing",
    description: "Turn your best reviews into social media posts and marketing insights with one click.",
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
    description: "Get real-time notifications so you can thank your customers immediately.",
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
    quote: "Finally, a simple way to manage our reputation without needing a tech team.",
    name: "Ananya S.",
    business: "Bloom Salon, Bengaluru",
    avatarColor: "secondary",
  },
  {
    rating: 5,
    quote: "Our customers love the easy WhatsApp review link. Highly recommended!",
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
