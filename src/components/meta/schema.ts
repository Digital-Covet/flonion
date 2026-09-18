import type { FaqItem } from "~/components/landing/Faq";
import { absoluteUrl, SITE_ORIGIN } from "~/lib/site";

/**
 * JSON-LD builders.
 *
 * Deliberately no `aggregateRating` anywhere: Google treats a rating a business
 * publishes about itself as "self-serving" and disallows it for `Organization`
 * and `LocalBusiness`, and inventing one is a structured-data violation. Add it
 * back only when real, on-page-visible review data exists.
 */

const ORGANIZATION_ID = `${SITE_ORIGIN}/#organization`;
const WEBSITE_ID = `${SITE_ORIGIN}/#website`;

export function organizationSchema() {
  return {
    "@type": "Organization",
    "@id": ORGANIZATION_ID,
    name: "Flonion",
    url: SITE_ORIGIN,
    logo: absoluteUrl("/favicon.svg"),
    email: "support@flonion.com",
    description:
      "Flonion helps local businesses collect genuine reviews, reply faster with AI drafts, and improve their local search presence.",
  };
}

export function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": WEBSITE_ID,
    name: "Flonion",
    url: SITE_ORIGIN,
    publisher: { "@id": ORGANIZATION_ID },
    inLanguage: "en-IN",
  };
}

export function softwareApplicationSchema() {
  return {
    "@type": "SoftwareApplication",
    name: "Flonion",
    url: SITE_ORIGIN,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Collect genuine Google reviews with QR codes, draft replies with AI, and improve your local search presence from one dashboard.",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
      url: absoluteUrl("/pricing"),
    },
  };
}

/** The homepage graph: one script with everything `@id`-linked together. */
export function homeGraph() {
  return {
    "@context": "https://schema.org",
    "@graph": [
      organizationSchema(),
      websiteSchema(),
      softwareApplicationSchema(),
    ],
  };
}

/**
 * FAQ markup. Google restricted FAQ rich results to authoritative government
 * and health sites in 2023, so this is unlikely to earn a rich result for a
 * commercial product — it stays because it is accurate and cheap, not because
 * it will show stars.
 */
export function faqSchema(items: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
