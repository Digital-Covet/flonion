import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

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
    select: { onboardingCompleted: true, business: true },
  });

  const business = user?.business;

  const reviewLinks =
    business?.reviewLinks &&
    typeof business.reviewLinks === "object" &&
    !Array.isArray(business.reviewLinks)
      ? (business.reviewLinks as Record<string, string>)
      : {};

  return Response.json({
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
    onboardingCompleted: user?.onboardingCompleted ?? false,
  });
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { placeId, reviewLink, reviewLinks, logo, businessName, username, phone, address, sector, keywords } = body;

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
    };

    const [business] = await prisma.$transaction([
      prisma.business.upsert({
        where: { userId: session.user.id },
        create: { userId: session.user.id, ...data },
        update: data,
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { onboardingCompleted: true },
      }),
    ]);

    const savedLinks =
      business.reviewLinks &&
      typeof business.reviewLinks === "object" &&
      !Array.isArray(business.reviewLinks)
        ? (business.reviewLinks as Record<string, string>)
        : {};

    return Response.json({
      placeId: business.placeId ?? "",
      reviewLink: business.reviewLink ?? "",
      reviewLinks: savedLinks,
      logo: business.logo ?? null,
      businessName: business.name,
      username: business.username ?? "",
      phone: business.phone ?? "",
      address: business.address ?? "",
      sector: business.sector ?? "",
      keywords: business.keywords ?? "",
      onboardingCompleted: true,
    });
  } catch {
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
