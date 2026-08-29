import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";
import { sendEmail } from "~/services/email";
import {
  renderMeetingRequestEmail,
} from "~/services/email-templates";
import { APP_DOMAIN } from "~/lib/constants";

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(event.request.url);
  const type = url.searchParams.get("type") ?? "all";
  const statusFilter = url.searchParams.get("status") ?? undefined;

  try {
    const userBusiness = await prisma.business.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });

    const where: Record<string, unknown> = {};

    if (type === "incoming" && userBusiness) {
      where.businessId = userBusiness.id;
    } else if (type === "outgoing") {
      where.requesterId = session.user.id;
    } else {
      where.OR = [
        { requesterId: session.user.id },
        ...(userBusiness ? [{ businessId: userBusiness.id }] : []),
      ];
    }

    if (statusFilter) {
      where.status = statusFilter;
    }

    const meetings = await prisma.meetingRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        slot: { select: { date: true, startTime: true, endTime: true } },
        business: { select: { id: true, name: true, logo: true, username: true } },
        requester: { select: { id: true, name: true, email: true, image: true } },
      },
    });

    return Response.json({ meetings });
  } catch (err) {
    console.error("[marketplace/meetings] query failed:", err);
    return Response.json({ error: "Failed to load meetings" }, { status: 500 });
  }
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { slotId, businessId, message } = body;

    if (typeof slotId !== "string" || typeof businessId !== "string") {
      return Response.json(
        { error: "slotId and businessId are required" },
        { status: 400 },
      );
    }

    const slot = await prisma.availabilitySlot.findUnique({
      where: { id: slotId },
      include: {
        business: {
          select: { id: true, name: true, userId: true, user: { select: { email: true, name: true } } },
        },
      },
    });

    if (!slot) {
      return Response.json({ error: "Slot not found" }, { status: 404 });
    }

    if (slot.businessId !== businessId) {
      return Response.json(
        { error: "Slot does not belong to this business" },
        { status: 400 },
      );
    }

    if (slot.isBooked) {
      return Response.json(
        { error: "This slot is no longer available" },
        { status: 409 },
      );
    }

    if (slot.date < new Date()) {
      return Response.json(
        { error: "Cannot book a slot in the past" },
        { status: 400 },
      );
    }

    if (slot.business.userId === session.user.id) {
      return Response.json(
        { error: "You cannot book a meeting with yourself" },
        { status: 400 },
      );
    }

    const meeting = await prisma.$transaction(async (tx) => {
      const updatedSlot = await tx.availabilitySlot.update({
        where: { id: slotId, isBooked: false },
        data: { isBooked: true },
      });

      return tx.meetingRequest.create({
        data: {
          slotId: updatedSlot.id,
          businessId,
          requesterId: session.user.id,
          message: typeof message === "string" && message.trim() ? message.trim() : null,
        },
        include: {
          slot: true,
          business: { select: { name: true } },
        },
      });
    });

    const ownerEmail = slot.business.user.email;
    const ownerName = slot.business.user.name;
    const requesterName = session.user.name || session.user.email;
    const slotDate = new Date(slot.date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    try {
      const { html, text } = renderMeetingRequestEmail({
        ownerName,
        requesterName,
        businessName: slot.business.name,
        date: slotDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        message: meeting.message ?? undefined,
        acceptUrl: `${APP_DOMAIN}/api/marketplace/meetings/${meeting.id}?action=accept`,
        rejectUrl: `${APP_DOMAIN}/api/marketplace/meetings/${meeting.id}?action=reject`,
      });

      await sendEmail({
        to: ownerEmail,
        toName: ownerName,
        subject: `New meeting request from ${requesterName}`,
        text,
        html,
      });
    } catch (err) {
      console.error("[marketplace/meetings] Failed to send notification email:", err);
    }

    return Response.json({ meeting });
  } catch {
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
