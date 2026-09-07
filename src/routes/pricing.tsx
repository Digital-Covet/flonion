import { createSignal } from "solid-js";
import ComparisonTable from "~/components/landing/ComparisonTable";
import Footer from "~/components/landing/Footer";
import MobileMenu from "~/components/landing/MobileMenu";
import Navbar from "~/components/landing/Navbar";
import PricingFAQ from "~/components/landing/PricingFAQ";
import PricingSection from "~/components/landing/PricingSection";

export default function PricingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = createSignal(false);

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
        <PricingSection />
        <ComparisonTable />
        <PricingFAQ />
      </main>

      <Footer />
    </div>
  );
}
