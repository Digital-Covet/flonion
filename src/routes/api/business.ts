import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import {
  getPlatformLabel,
  type ReviewLinksMap,
} from "~/features/settings/review-platforms";
import { fetchBusinessRating } from "~/lib/google-business-rating";
import {
  MAX_LONG_FIELD,
  MAX_MEDIUM_FIELD,
  MAX_SHORT_FIELD,
  MAX_URL_LENGTH,
  oversizedFieldResponse,
} from "~/lib/input-limits";
import { httpUrl, imageSrc, sanitizeReviewLinks } from "~/lib/safe-url";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { loadBusinessInfo } from "~/server/business-data";

const USERNAME_REGEX = /^[a-z0-9-]+$/;
const RESERVED_USERNAMES = [
  "admin",
  "api",
  "review",
  "qr",
  "dashboard",
  "settings",
  "login",
  "signup",
];
const MAX_USERNAME_LENGTH = 15;

/**
 * Kept for any client that still fetches this directly; pages read the same
 * data through `getBusiness()` instead. Both share `loadBusinessInfo` so the
 * two responses cannot drift.
 */
export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json(await loadBusinessInfo(session.user.id));
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Guard: block users who belong to a business they do not own (invited
  // members). Owners keep write access — their own `businessId` points at their
  // own business, and this route doubles as the Settings save endpoint.
  const existingUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { businessId: true, business: { select: { id: true } } },
  });

  if (
    existingUser?.businessId &&
    existingUser.businessId !== existingUser.business?.id
  ) {
    return Response.json(
      {
        error: "You are already part of a team. Cannot create a new business.",
      },
      { status: 400 },
    );
  }

  try {
    const body = await event.request.json();
    const {
      placeId,
      reviewLink,
      reviewLinks,
      logo,
      businessName,
      username,
      phone,
      address,
      sector,
      keywords,
      description,
    } = body;

    if (typeof businessName !== "string" || !businessName.trim()) {
      return Response.json(
        { error: "Business name is required" },
        { status: 400 },
      );
    }

    // Validate username if provided
    let normalizedUsername: string | null = null;
    if (typeof username === "string" && username.trim()) {
      const trimmed = username.trim().toLowerCase();

      if (trimmed.length > MAX_USERNAME_LENGTH) {
        return Response.json(
          {
            error: `Username must be ${MAX_USERNAME_LENGTH} characters or less`,
          },
          { status: 400 },
        );
      }

      if (!USERNAME_REGEX.test(trimmed)) {
        return Response.json(
          {
            error:
              "Username can only contain lowercase letters, numbers, and hyphens",
          },
          { status: 400 },
        );
      }

      if (RESERVED_USERNAMES.includes(trimmed)) {
        return Response.json(
          { error: "This username is reserved" },
          { status: 400 },
        );
      }

      // Check uniqueness (excluding current user)
      const existing = await prisma.business.findFirst({
        where: {
          username: trimmed,
          userId: { not: session.user.id },
        },
      });

      if (existing) {
        return Response.json(
          { error: "Username is already taken" },
          { status: 400 },
        );
      }

      normalizedUsername = trimmed;
    }

    const tooLong = oversizedFieldResponse([
      { label: "Business name", value: businessName, max: MAX_SHORT_FIELD },
      { label: "Phone", value: phone, max: MAX_SHORT_FIELD },
      { label: "Sector", value: sector, max: MAX_SHORT_FIELD },
      { label: "Place ID", value: placeId, max: MAX_SHORT_FIELD },
      { label: "Address", value: address, max: MAX_MEDIUM_FIELD },
      { label: "Keywords", value: keywords, max: MAX_MEDIUM_FIELD },
      { label: "Description", value: description, max: MAX_LONG_FIELD },
      // `logo` is bounded by `imageSrc` below, which also allows an inline
      // `data:` image and so cannot share the plain URL ceiling.
      { label: "Review link", value: reviewLink, max: MAX_URL_LENGTH },
    ]);
    if (tooLong) return tooLong;

    // Review links are navigated to on the public review page, so anything
    // other than an http(s) URL (e.g. `javascript:`) is stored XSS.
    const safeReviewLink = httpUrl(reviewLink);
    if (
      typeof reviewLink === "string" &&
      reviewLink.trim() &&
      !safeReviewLink
    ) {
      return Response.json(
        { error: "Review link must be a full http(s) URL" },
        { status: 400 },
      );
    }

    let safeReviewLinks: ReviewLinksMap | undefined;
    if (
      typeof reviewLinks === "object" &&
      reviewLinks !== null &&
      !Array.isArray(reviewLinks)
    ) {
      const sanitized = sanitizeReviewLinks(reviewLinks);
      if (!sanitized.ok) {
        return Response.json(
          {
            error: `The ${getPlatformLabel(sanitized.slug, {})} link must be a full http(s) URL`,
          },
          { status: 400 },
        );
      }
      safeReviewLinks = sanitized.links;
    }

    // The logo is rendered on the public review page, the company profile and
    // every marketplace card. It gets the same treatment as the links above
    // rather than a bare `typeof` check: an unvalidated string here is an
    // arbitrary scheme, an unbounded `data:` URI, or an off-origin tracker that
    // fires on every visitor's page load. Onboarding inlines small images, so
    // `imageSrc` allows a bounded `data:` image as well as an http(s) URL.
    const safeLogo = imageSrc(logo);
    if (typeof logo === "string" && logo.trim() && !safeLogo) {
      return Response.json(
        { error: "Logo must be a full http(s) link or an inline image" },
        { status: 400 },
      );
    }

    const data = {
      placeId: typeof placeId === "string" ? placeId : null,
      reviewLink: safeReviewLink,
      reviewLinks: safeReviewLinks,
      logo: safeLogo,
      name: businessName.trim(),
      username: normalizedUsername,
      phone: typeof phone === "string" ? phone : null,
      address: typeof address === "string" ? address : null,
      sector: typeof sector === "string" ? sector : null,
      keywords: typeof keywords === "string" ? keywords : null,
      description:
        typeof description === "string" && description.trim()
          ? description.trim()
          : null,
    };

    const [business] = await prisma.$transaction([
      prisma.business.upsert({
        where: { userId: session.user.id },
        create: { userId: session.user.id, ...data },
        update: data,
      }),
    ]);

    await prisma.user.update({
      where: { id: session.user.id },
      data: { onboardingCompleted: true, businessId: business.id },
    });

    // Someone who gave up waiting on a team and made their own business would
    // otherwise leave a live row in that team's queue, which an admin can only
    // resolve by clicking approve and getting an error.
    await prisma.joinRequest.updateMany({
      where: { userId: session.user.id, status: "pending" },
      data: { status: "cancelled", pendingUserId: null },
    });

    // Google's aggregate rating is cached on the business so the marketplace
    // can rank on it without an API round-trip per card. A failed lookup keeps
    // whatever was stored before rather than blocking the save.
    let ratedBusiness = business;
    if (business.placeId) {
      try {
        const rating = await fetchBusinessRating(
          session.user.id,
          business.placeId,
        );
        if (rating) {
          ratedBusiness = await prisma.business.update({
            where: { id: business.id },
            data: { rating: rating.rating, reviewCount: rating.reviewCount },
          });
        }
      } catch (err) {
        console.error("[business] rating cache update failed:", err);
      }
    }

    const savedLinks =
      ratedBusiness.reviewLinks &&
      typeof ratedBusiness.reviewLinks === "object" &&
      !Array.isArray(ratedBusiness.reviewLinks)
        ? (ratedBusiness.reviewLinks as Record<string, string>)
        : {};

    return Response.json({
      placeId: ratedBusiness.placeId ?? "",
      reviewLink: ratedBusiness.reviewLink ?? "",
      reviewLinks: savedLinks,
      logo: ratedBusiness.logo ?? null,
      businessName: ratedBusiness.name,
      username: ratedBusiness.username ?? "",
      phone: ratedBusiness.phone ?? "",
      address: ratedBusiness.address ?? "",
      sector: ratedBusiness.sector ?? "",
      keywords: ratedBusiness.keywords ?? "",
      description: ratedBusiness.description ?? "",
      rating: ratedBusiness.rating ?? 0,
      reviewCount: ratedBusiness.reviewCount ?? 0,
      onboardingCompleted: true,
    });
  } catch (err) {
    // The uniqueness probe above is a check-then-write; a concurrent claim of the
    // same username surfaces here as P2002 and must not read "Invalid request body".
    if (
      err &&
      typeof err === "object" &&
      (err as { code?: string }).code === "P2002"
    ) {
      return Response.json(
        { error: "Username is already taken" },
        { status: 400 },
      );
    }
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function PATCH(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { username } = body;

    if (typeof username !== "string" || !username.trim()) {
      return Response.json({ error: "Username is required" }, { status: 400 });
    }

    const trimmed = username.trim().toLowerCase();

    if (trimmed.length > MAX_USERNAME_LENGTH) {
      return Response.json(
        {
          available: false,
          error: `Username must be ${MAX_USERNAME_LENGTH} characters or less`,
        },
        { status: 400 },
      );
    }

    if (!USERNAME_REGEX.test(trimmed)) {
      return Response.json(
        {
          available: false,
          error:
            "Username can only contain lowercase letters, numbers, and hyphens",
        },
        { status: 400 },
      );
    }

    if (RESERVED_USERNAMES.includes(trimmed)) {
      return Response.json(
        { available: false, error: "This username is reserved" },
        { status: 400 },
      );
    }

    const existing = await prisma.business.findFirst({
      where: {
        username: trimmed,
        userId: { not: session.user.id },
      },
    });

    return Response.json({
      available: !existing,
      error: existing ? "Username is already taken" : null,
    });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
