import type { BusinessInfo } from "~/components/app/context";
import { api } from "~/components/onboarding/ui";
import {
  isHttpUrl,
  KEYWORD_MAX_LENGTH,
  KEYWORDS_MAX,
  phoneProblem,
  splitKeywordList,
  usernameProblem,
} from "~/features/settings/business-fields";
import { REVIEW_PLATFORMS } from "~/features/settings/review-platforms";

/**
 * Editable mirror of the business row. `placeId` and `logo` are carried
 * through untouched: `POST /api/business` is a full upsert, so a payload that
 * omits them writes `null` and quietly drops the Google place match and the
 * logo the owner uploaded elsewhere.
 */
export type SettingsForm = {
  businessName: string;
  sector: string;
  phone: string;
  address: string;
  description: string;
  username: string;
  links: Record<string, string>;
  keywords: string[];
  placeId: string;
  logo: string | null;
};

export type SettingsField =
  | "businessName"
  | "phone"
  | "username"
  | `link:${string}`;

export function toForm(business: BusinessInfo): SettingsForm {
  return {
    businessName: business.businessName,
    sector: business.sector,
    phone: business.phone,
    address: business.address,
    description: business.description,
    username: business.username,
    links: Object.fromEntries(
      REVIEW_PLATFORMS.map((p) => [p.slug, business.reviewLinks[p.slug] ?? ""]),
    ),
    keywords: splitKeywordList(business.keywords).slice(0, KEYWORDS_MAX),
    placeId: business.placeId,
    logo: business.logo,
  };
}

/** Stable string used to tell a touched form from an untouched one. */
export function snapshot(form: SettingsForm): string {
  return JSON.stringify({
    ...form,
    links: Object.fromEntries(
      REVIEW_PLATFORMS.map((p) => [p.slug, form.links[p.slug]?.trim() ?? ""]),
    ),
  });
}

/** Trimmed, empty-dropped links in the shape the API stores. */
export function cleanLinks(form: SettingsForm): Record<string, string> {
  return Object.fromEntries(
    REVIEW_PLATFORMS.map((p) => [
      p.slug,
      form.links[p.slug]?.trim() ?? "",
    ]).filter(([, value]) => value),
  );
}

export function hasAnyLink(form: SettingsForm): boolean {
  return Object.keys(cleanLinks(form)).length > 0;
}

export function addKeywords(current: readonly string[], raw: string): string[] {
  const next = [...current];
  for (const keyword of splitKeywordList(raw)) {
    if (next.length >= KEYWORDS_MAX) break;
    if (next.some((k) => k.toLowerCase() === keyword.toLowerCase())) continue;
    next.push(keyword.slice(0, KEYWORD_MAX_LENGTH));
  }
  return next;
}

/**
 * Field problems we can name without asking the server. The username's
 * availability is not here: that needs a round-trip and is reported next to
 * the field as it is typed.
 */
export function validate(
  form: SettingsForm,
): Partial<Record<SettingsField, string>> {
  const found: Partial<Record<SettingsField, string>> = {};

  if (!form.businessName.trim())
    found.businessName = "Enter your business name.";

  const phone = phoneProblem(form.phone);
  if (phone) found.phone = phone;

  if (form.username) {
    const problem = usernameProblem(form.username);
    if (problem) found.username = problem;
  }

  for (const platform of REVIEW_PLATFORMS) {
    const value = form.links[platform.slug]?.trim() ?? "";
    if (value && !isHttpUrl(value))
      found[`link:${platform.slug}`] =
        "Paste the full link, starting with https://";
  }

  return found;
}

/** The section a given field lives in, so a failed save can open that panel. */
export const FIELD_SECTION: Record<string, "profile" | "link" | "platforms"> = {
  businessName: "profile",
  phone: "profile",
  username: "link",
};

export function sectionForField(field: SettingsField) {
  return field.startsWith("link:")
    ? ("platforms" as const)
    : (FIELD_SECTION[field] ?? ("profile" as const));
}

export type SaveResult =
  | { kind: "saved"; business: Partial<BusinessInfo> }
  | { kind: "unauthorized" }
  /** Server rejected a specific field; `field` opens the right panel. */
  | { kind: "rejected"; message: string; field?: SettingsField }
  | { kind: "failed"; message: string };

/**
 * Saves every section in one request. `reviewLink` stays in step with
 * `reviewLinks` — the public page and the QR redirect still read the single
 * link, and Google is the preferred default when it is set.
 */
export async function saveSettings(form: SettingsForm): Promise<SaveResult> {
  const links = cleanLinks(form);

  const { ok, status, data } = await api<BusinessInfo>("/api/business", {
    method: "POST",
    body: {
      businessName: form.businessName.trim(),
      sector: form.sector,
      phone: form.phone.trim(),
      address: form.address.trim(),
      description: form.description.trim(),
      username: form.username,
      reviewLinks: links,
      reviewLink: links.google ?? Object.values(links)[0] ?? "",
      keywords: form.keywords.join(", "),
      placeId: form.placeId,
      logo: form.logo,
    },
  });

  if (status === 401) return { kind: "unauthorized" };

  if (!ok) {
    const message = data.error ?? "We couldn't save your settings.";
    if (/username/i.test(message))
      return { kind: "rejected", message, field: "username" };
    if (/business name/i.test(message))
      return { kind: "rejected", message, field: "businessName" };
    const platform = REVIEW_PLATFORMS.find((p) =>
      new RegExp(`the ${p.label} link`, "i").test(message),
    );
    if (platform)
      return { kind: "rejected", message, field: `link:${platform.slug}` };
    return { kind: "failed", message };
  }

  return { kind: "saved", business: data };
}
