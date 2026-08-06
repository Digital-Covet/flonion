import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "@/db/prisma";
import { toSlug } from "~/lib/slug";

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);

  try {
    const body = await event.request.json();

    const { text, rating, keywords, id } = body;

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return Response.json(
        { error: "rating must be a number between 1 and 5" },
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
          rating,
          reviewerName: isOwner
            ? session.user.name
            : session?.user.name ?? "Anonymous",
          keywords: typeof keywords === "string" ? keywords : existing.keywords,
        },
        select: {
          id: true,
          userId: true,
        },
      });

      const user = await prisma.user.findUnique({
        where: { id: review.userId },
        select: { business: { select: { name: true } } },
      });

      const businessName = user?.business?.name;
      const slug = businessName ? toSlug(businessName) : "unknown";

      return Response.json({ url: `/company/${slug}/review/${review.id}` });
    }

    if (!session) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
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
      select: { business: { select: { name: true } } },
    });

    const businessName = user?.business?.name;
    const slug = businessName ? toSlug(businessName) : "unknown";

    return Response.json({ url: `/company/${slug}/review/${review.id}` });
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
