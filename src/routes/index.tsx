import { createSignal } from "solid-js";
import CTASection from "~/components/landing/CTASection";
import FAQSection from "~/components/landing/FAQSection";
import FeaturesSection from "~/components/landing/FeaturesSection";
import Footer from "~/components/landing/Footer";
import HeroSection from "~/components/landing/HeroSection";
import HowItWorksSection from "~/components/landing/HowItWorksSection";
import MobileMenu from "~/components/landing/MobileMenu";
import Navbar from "~/components/landing/Navbar";
import TestimonialsSection from "~/components/landing/TestimonialsSection";
import TrustedBySection from "~/components/landing/TrustedBySection";

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);

  const toggleMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <div class="overflow-x-hidden bg-background text-foreground antialiased">
      <a
        href="#main-content"
        class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:min-h-11 focus:rounded-control focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <Navbar mobileMenuOpen={mobileMenuOpen()} onToggleMenu={toggleMenu} />
      <MobileMenu open={mobileMenuOpen()} onClose={closeMenu} />

      <main id="main-content" class="relative z-10 pt-[68px]">
        <HeroSection />
        <TrustedBySection />
        <FeaturesSection />
        <HowItWorksSection />
        <TestimonialsSection />
        <FAQSection />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
