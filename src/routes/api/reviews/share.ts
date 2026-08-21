import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "@/db/prisma";

const MAX_TEXT_LENGTH = 5000;
const MAX_NAME_LENGTH = 100;
const MAX_KEYWORDS_LENGTH = 500;

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);

  try {
    const body = await event.request.json();

    const { text, rating, keywords, id, reviewerName } = body;

    if (id && rating !== 0 && (typeof rating !== "number" || rating < 1 || rating > 5)) {
      return Response.json(
        { error: "rating must be a number between 1 and 5" },
        { status: 400 },
      );
    }

    if (typeof text === "string" && text.length > MAX_TEXT_LENGTH) {
      return Response.json(
        { error: "text is too long" },
        { status: 400 },
      );
    }

    if (typeof reviewerName === "string" && reviewerName.length > MAX_NAME_LENGTH) {
      return Response.json(
        { error: "reviewerName is too long" },
        { status: 400 },
      );
    }

    if (typeof keywords === "string" && keywords.length > MAX_KEYWORDS_LENGTH) {
      return Response.json(
        { error: "keywords is too long" },
        { status: 400 },
      );
    }

    if (id) {
      const existing = await prisma.sharedReview.findUnique({ where: { id } });
      if (!existing) {
        return Response.json({ error: "Review not found" }, { status: 404 });
      }

      const isOwner = session && existing.userId === session.session.userId;

      const review = await prisma.sharedReview.update({
        where: { id },
        data: {
          text: typeof text === "string" ? text.trim() : "",
          rating: rating !== 0 ? rating : existing.rating,
          reviewerName: isOwner
            ? session.user.name
            : (typeof reviewerName === "string" && reviewerName.trim()
                ? reviewerName.trim()
                : session?.user.name ?? "Anonymous"),
          // `keywords` is owner-configured SEO input that is served back to every
          // visitor and fed into the AI prompt. Anonymous callers must not set it.
          keywords: isOwner && typeof keywords === "string" ? keywords : existing.keywords,
        },
        select: {
          id: true,
          userId: true,
        },
      });

      const user = await prisma.user.findUnique({
        where: { id: review.userId },
        select: { business: { select: { name: true, username: true } } },
      });

      const username = user?.business?.username || "unknown";

      return Response.json({ url: `/company/${username}/review/${review.id}` });
    }

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!id) {
      const existing = await prisma.sharedReview.findFirst({
        where: { userId: session.session.userId },
        orderBy: { createdAt: "desc" },
        select: { id: true, userId: true },
      });
      if (existing) {
        const existingUser = await prisma.user.findUnique({
          where: { id: existing.userId },
          select: { business: { select: { name: true, username: true } } },
        });
        const username = existingUser?.business?.username || "unknown";
        return Response.json({ url: `/company/${username}/review/${existing.id}` });
      }
    }

    if (typeof rating !== "number" || rating < 0 || rating > 5) {
      return Response.json(
        { error: "rating must be a number between 0 and 5" },
        { status: 400 },
      );
    }

    const review = await prisma.sharedReview.create({
      data: {
        text: typeof text === "string" ? text.trim() : "",
        rating,
        reviewerName: session.user.name,
        keywords: typeof keywords === "string" ? keywords : null,
        userId: session.session.userId,
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: session.session.userId },
      select: { business: { select: { name: true, username: true } } },
    });

    const username = user?.business?.username || "unknown";

    return Response.json({ url: `/company/${username}/review/${review.id}` });
  } catch {
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const id = url.searchParams.get("id");

  if (!id) {
    return Response.json({ error: "Missing id parameter" }, { status: 400 });
  }

  const review = await prisma.sharedReview.findUnique({
    where: { id },
    select: {
      id: true,
      text: true,
      rating: true,
      reviewerName: true,
      keywords: true,
      createdAt: true,
      user: {
        select: {
          business: {
            select: {
              logo: true,
              name: true,
              phone: true,
              address: true,
              placeId: true,
              reviewLink: true,
              reviewLinks: true,
            },
          },
        },
      },
    },
  });

  if (!review) {
    return Response.json({ error: "Review not found" }, { status: 404 });
  }

  return Response.json({
    ...review,
    business: review.user?.business ?? null,
    user: undefined,
  });
}
