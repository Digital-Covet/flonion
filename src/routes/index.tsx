import { createSignal } from "solid-js";
import { useReducedMotion } from "~/hooks/useReducedMotion";
import Navbar from "~/components/landing/Navbar";
import MobileMenu from "~/components/landing/MobileMenu";
import HeroSection from "~/components/landing/HeroSection";
import TrustedBySection from "~/components/landing/TrustedBySection";
import FeaturesSection from "~/components/landing/FeaturesSection";
import TestimonialsSection from "~/components/landing/TestimonialsSection";
import FAQSection from "~/components/landing/FAQSection";
import CTASection from "~/components/landing/CTASection";
import Footer from "~/components/landing/Footer";

export default function App() {
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);
  const reducedMotion = useReducedMotion();

  const toggleMenu = () => setMobileMenuOpen((prev) => !prev);
  const closeMenu = () => setMobileMenuOpen(false);

  return (
    <div class="bg-bg text-fg antialiased overflow-x-hidden">
      <div
        id="scroll-bg-overlay"
        class="scroll-color-wash pointer-events-none fixed inset-0 z-0 opacity-0"
        aria-hidden="true"
      />

      <Navbar mobileMenuOpen={mobileMenuOpen()} onToggleMenu={toggleMenu} />
      <MobileMenu open={mobileMenuOpen()} onClose={closeMenu} />

      <main class="relative z-10 pt-18">
        <HeroSection reducedMotion={reducedMotion()} />
        <TrustedBySection />
        <FeaturesSection />
        <TestimonialsSection />
        <FAQSection />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}
