/**
 * Marketplace categories.
 *
 * Businesses never pick a category during onboarding -- they type a free-text
 * sector plus review keywords. The marketplace derives one category from those
 * two fields so cards can be labelled and filtered without a migration.
 *
 * The match is a deliberately simple case-insensitive substring scan: the same
 * keyword lists drive the card label (`matchBusinessToCategory`) and the SQL
 * filter in `~/lib/partners-query`, so a card can never be labelled one thing
 * and filtered as another.
 */

export const MARKETPLACE_CATEGORIES = [
  "Food & Dining",
  "Beauty & Wellness",
  "Health & Medical",
  "Retail & Grocery",
  "Home Services",
  "Automotive",
  "Education & Training",
  "Events & Photography",
  "Fitness & Sports",
  "Professional Services",
] as const;

export type MarketplaceCategory = (typeof MARKETPLACE_CATEGORIES)[number];

/** Fallback for a business whose sector matches nothing below. */
export const DEFAULT_CATEGORY: MarketplaceCategory = "Professional Services";

/**
 * Keywords are matched as substrings, so short ones are avoided where they
 * would collide ("bar" in "barber", "spa" in "space").
 */
export const CATEGORY_KEYWORDS: Record<MarketplaceCategory, readonly string[]> =
  {
    "Food & Dining": [
      "restaurant",
      "cafe",
      "café",
      "coffee",
      "bakery",
      "bakers",
      "dhaba",
      "hotel",
      "canteen",
      "catering",
      "caterer",
      "sweet shop",
      "mithai",
      "tiffin",
      "cloud kitchen",
      "food",
      "dining",
      "pizzeria",
      "juice",
      "ice cream",
    ],
    "Beauty & Wellness": [
      "salon",
      "saloon",
      "parlour",
      "parlor",
      "barber",
      "beauty",
      "spa",
      "nail",
      "makeup",
      "mehndi",
      "grooming",
      "skin care",
      "skincare",
      "massage",
      "ayurveda",
      "wellness",
    ],
    "Health & Medical": [
      "clinic",
      "hospital",
      "doctor",
      "dental",
      "dentist",
      "pharmacy",
      "chemist",
      "medical",
      "diagnostic",
      "pathology",
      "physio",
      "optician",
      "eye care",
      "veterinary",
      "vet clinic",
      "nursing",
      "therapist",
    ],
    "Retail & Grocery": [
      "store",
      "shop",
      "retail",
      "grocery",
      "kirana",
      "supermarket",
      "mart",
      "boutique",
      "apparel",
      "clothing",
      "footwear",
      "jewellery",
      "jewelry",
      "electronics",
      "mobile shop",
      "hardware",
      "stationery",
      "furniture",
      "florist",
    ],
    "Home Services": [
      "plumber",
      "plumbing",
      "electrician",
      "carpenter",
      "painter",
      "cleaning",
      "housekeeping",
      "pest control",
      "interior",
      "renovation",
      "construction",
      "contractor",
      "packers",
      "movers",
      "appliance repair",
      "laundry",
      "dry clean",
      "tailor",
    ],
    Automotive: [
      "automotive",
      "garage",
      "car wash",
      "car service",
      "bike service",
      "mechanic",
      "auto repair",
      "tyre",
      "tire",
      "spare parts",
      "workshop",
      "driving school",
      "car rental",
    ],
    "Education & Training": [
      "school",
      "college",
      "academy",
      "coaching",
      "tuition",
      "tutor",
      "institute",
      "training",
      "classes",
      "education",
      "learning",
      "playschool",
      "daycare",
      "language",
      "music class",
    ],
    "Events & Photography": [
      "photography",
      "photographer",
      "videography",
      "event",
      "wedding",
      "banquet",
      "decor",
      "decoration",
      "dj ",
      "party",
      "florals",
      "studio",
    ],
    "Fitness & Sports": [
      "gym",
      "fitness",
      "yoga",
      "zumba",
      "crossfit",
      "pilates",
      "sports",
      "swimming",
      "martial arts",
      "karate",
      "dance",
      "trainer",
      "turf",
    ],
    "Professional Services": [
      "consultant",
      "consulting",
      "agency",
      "marketing",
      "advertising",
      "design",
      "software",
      "technology",
      "web design",
      "web services",
      "it services",
      "accountant",
      "chartered",
      "tax",
      "legal",
      "lawyer",
      "advocate",
      "insurance",
      "real estate",
      "property",
      "travel",
      "logistics",
      "printing",
      "security",
      "recruitment",
    ],
  };

/**
 * Best category for a business, or `null` when nothing matches -- callers
 * decide whether to fall back to {@link DEFAULT_CATEGORY} or leave the card
 * unlabelled. Earlier categories win, so a "salon and spa cafe" lands in
 * Food & Dining only if it mentions no beauty keyword.
 */
export function matchBusinessToCategory(
  sector: string | null,
  keywords: string | null,
): MarketplaceCategory | null {
  const haystack = `${sector ?? ""} ${keywords ?? ""}`.toLowerCase();
  if (!haystack.trim()) return null;

  for (const category of MARKETPLACE_CATEGORIES) {
    const words = CATEGORY_KEYWORDS[category];
    if (words.some((word) => haystack.includes(word))) return category;
  }
  return null;
}
