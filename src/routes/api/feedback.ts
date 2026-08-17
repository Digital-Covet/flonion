import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

const CATEGORIES = [
  "General",
  "Bug Report",
  "Feature Request",
  "Improvement",
  "Other",
] as const;

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { name, email, category, rating, message } = body;

    if (typeof name !== "string" || !name.trim()) {
      return Response.json({ error: "Name is required" }, { status: 400 });
    }

    if (typeof email !== "string" || !email.trim()) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    if (
      typeof category !== "string" ||
      !(CATEGORIES as readonly string[]).includes(category)
    ) {
      return Response.json(
        { error: "Valid category is required" },
        { status: 400 },
      );
    }

    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return Response.json(
        { error: "Rating must be an integer between 1 and 5" },
        { status: 400 },
      );
    }

    if (typeof message !== "string" || !message.trim()) {
      return Response.json({ error: "Message is required" }, { status: 400 });
    }

    const feedback = await prisma.feedback.create({
      data: {
        userId: session.user.id,
        name: name.trim(),
        email: email.trim(),
        category,
        rating: ratingNum,
        message: message.trim(),
      },
    });

    return Response.json({ id: feedback.id, success: true });
  } catch {
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
