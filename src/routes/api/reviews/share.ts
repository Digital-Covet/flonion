import type { APIEvent } from "@solidjs/start/server";
import type { SharedReview } from "@/features/reviews/review-types";
import { getSessionFromHeaders } from "~/lib/server-auth";

const sharedReviews = new Map<string, SharedReview>();

function generateId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 8; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();

    const { text, rating } = body;

    if (!text || typeof text !== "string" || !text.trim()) {
      return Response.json(
        { error: "Missing required field: text" },
        { status: 400 },
      );
    }

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      return Response.json(
        { error: "rating must be a number between 1 and 5" },
        { status: 400 },
      );
    }

    const id = generateId();
    const review: SharedReview = {
      id,
      text: text.trim(),
      rating,
      createdAt: Date.now(),
    };

    sharedReviews.set(id, review);

    return Response.json({ url: `/review/${id}` });
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

  const review = sharedReviews.get(id);

  if (!review) {
    return Response.json({ error: "Review not found" }, { status: 404 });
  }

  return Response.json(review);
}
