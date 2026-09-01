import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

const VALID_DAYS = new Set([0, 1, 2, 3, 4, 5, 6]);
const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DURATION_OPTIONS = new Set([15, 30, 45, 60]);

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const business = await prisma.business.findUnique({
      where: { userId: session.user.id },
      select: {
        workingDays: true,
        workingStartTime: true,
        workingEndTime: true,
        bookingStartTime: true,
        bookingEndTime: true,
        slotDuration: true,
        timezone: true,
      },
    });

    if (!business) {
      return Response.json({ error: "No business found" }, { status: 400 });
    }

    return Response.json({ settings: business });
  } catch (err) {
    console.error("[schedule-settings] GET failed:", err);
    return Response.json({ error: "Failed to load settings" }, { status: 500 });
  }
}

export async function PUT(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const {
      workingDays,
      workingStartTime,
      workingEndTime,
      bookingStartTime,
      bookingEndTime,
      slotDuration,
    } = body;

    const updates: Record<string, string | number> = {};

    if (workingDays !== undefined) {
      if (!Array.isArray(workingDays) || !workingDays.every((d: unknown) => typeof d === "number" && VALID_DAYS.has(d))) {
        return Response.json({ error: "workingDays must be an array of day numbers (0-6)" }, { status: 400 });
      }
      updates.workingDays = workingDays.join(",");
    }

    if (workingStartTime !== undefined) {
      if (typeof workingStartTime !== "string" || !TIME_RE.test(workingStartTime)) {
        return Response.json({ error: "workingStartTime must be HH:MM format" }, { status: 400 });
      }
      updates.workingStartTime = workingStartTime;
    }

    if (workingEndTime !== undefined) {
      if (typeof workingEndTime !== "string" || !TIME_RE.test(workingEndTime)) {
        return Response.json({ error: "workingEndTime must be HH:MM format" }, { status: 400 });
      }
      updates.workingEndTime = workingEndTime;
    }

    if (bookingStartTime !== undefined) {
      if (typeof bookingStartTime !== "string" || !TIME_RE.test(bookingStartTime)) {
        return Response.json({ error: "bookingStartTime must be HH:MM format" }, { status: 400 });
      }
      updates.bookingStartTime = bookingStartTime;
    }

    if (bookingEndTime !== undefined) {
      if (typeof bookingEndTime !== "string" || !TIME_RE.test(bookingEndTime)) {
        return Response.json({ error: "bookingEndTime must be HH:MM format" }, { status: 400 });
      }
      updates.bookingEndTime = bookingEndTime;
    }

    if (slotDuration !== undefined) {
      if (typeof slotDuration !== "number" || !DURATION_OPTIONS.has(slotDuration)) {
        return Response.json({ error: "slotDuration must be 15, 30, 45, or 60" }, { status: 400 });
      }
      updates.slotDuration = slotDuration;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json({ error: "No fields to update" }, { status: 400 });
    }

    const business = await prisma.business.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    if (!business) {
      return Response.json({ error: "No business found" }, { status: 400 });
    }

    await prisma.business.update({
      where: { id: business.id },
      data: updates,
    });

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
