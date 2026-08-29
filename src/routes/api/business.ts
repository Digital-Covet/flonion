import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";
import { fetchBusinessRating } from "~/lib/google-business-rating";

const USERNAME_REGEX = /^[a-z0-9-]+$/;
const RESERVED_USERNAMES = ["admin", "api", "review", "qr", "dashboard", "settings", "login", "signup"];
const MAX_USERNAME_LENGTH = 15;

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      onboardingCompleted: true,
      role: true,
      businessId: true,
      business: true,
      team: true,
    },
  });

  // Members have no `business` of their own — the business they work in is the
  // one `businessId` points at. Reading only the owner relation is what left
  // Settings, the sidebar and task assignees blank for invited users.
  const business = user?.team ?? user?.business ?? null;
  const isOwner = !!business && business.userId === session.user.id;

  const reviewLinks =
    business?.reviewLinks &&
    typeof business.reviewLinks === "object" &&
    !Array.isArray(business.reviewLinks)
      ? (business.reviewLinks as Record<string, string>)
      : {};

  let teamMembers: Array<{ id: string; name: string; email: string; image: string | null }> = [];
  if (business?.id) {
    const members = await prisma.user.findMany({
      where: { businessId: business.id },
      select: { id: true, name: true, email: true, image: true },
    });
    teamMembers = members;
  }

  return Response.json({
    ownerId: business?.userId ?? null,
    isOwner,
    role: user?.role ?? "member",
    placeId: business?.placeId ?? "",
    reviewLink: business?.reviewLink ?? "",
    reviewLinks,
    logo: business?.logo ?? null,
    businessName: business?.name ?? "",
    username: business?.username ?? "",
    phone: business?.phone ?? "",
    address: business?.address ?? "",
    sector: business?.sector ?? "",
    keywords: business?.keywords ?? "",
    description: business?.description ?? "",
    rating: business?.rating ?? 0,
    reviewCount: business?.reviewCount ?? 0,
    onboardingCompleted: user?.onboardingCompleted ?? false,
    teamMembers,
  });
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

  if (existingUser?.businessId && existingUser.businessId !== existingUser.business?.id) {
    return Response.json(
      { error: "You are already part of a team. Cannot create a new business." },
      { status: 400 },
    );
  }

  try {
    const body = await event.request.json();
    const { placeId, reviewLink, reviewLinks, logo, businessName, username, phone, address, sector, keywords, description } = body;

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
          { error: `Username must be ${MAX_USERNAME_LENGTH} characters or less` },
          { status: 400 },
        );
      }

      if (!USERNAME_REGEX.test(trimmed)) {
        return Response.json(
          { error: "Username can only contain lowercase letters, numbers, and hyphens" },
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

    const data = {
      placeId: typeof placeId === "string" ? placeId : null,
      reviewLink: typeof reviewLink === "string" ? reviewLink : null,
      reviewLinks:
        typeof reviewLinks === "object" && reviewLinks !== null && !Array.isArray(reviewLinks)
          ? reviewLinks
          : undefined,
      logo: typeof logo === "string" ? logo : null,
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
    if (err && typeof err === "object" && (err as { code?: string }).code === "P2002") {
      return Response.json(
        { error: "Username is already taken" },
        { status: 400 },
      );
    }
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
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
      return Response.json(
        { error: "Username is required" },
        { status: 400 },
      );
    }

    const trimmed = username.trim().toLowerCase();

    if (trimmed.length > MAX_USERNAME_LENGTH) {
      return Response.json(
        { available: false, error: `Username must be ${MAX_USERNAME_LENGTH} characters or less` },
        { status: 400 },
      );
    }

    if (!USERNAME_REGEX.test(trimmed)) {
      return Response.json(
        { available: false, error: "Username can only contain lowercase letters, numbers, and hyphens" },
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
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
