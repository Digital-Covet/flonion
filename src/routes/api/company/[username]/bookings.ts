import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { APP_DOMAIN } from "~/lib/constants";
import { sendEmail } from "~/services/email";
import { renderMeetingRequestEmail } from "~/services/email-templates";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(event: APIEvent) {
  const url = new URL(event.request.url);
  const segments = url.pathname.split("/");
  const username = decodeURIComponent(
    segments[segments.indexOf("company") + 1] ?? "",
  );

  if (!username) {
    return Response.json(
      { error: "Business username is required" },
      { status: 400 },
    );
  }

  let body: {
    slotId?: string;
    name?: string;
    email?: string;
    phone?: string;
    message?: string;
  };

  try {
    body = await event.request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { slotId, name, email, phone, message } = body;

  if (typeof slotId !== "string" || !slotId) {
    return Response.json({ error: "slotId is required" }, { status: 400 });
  }
  if (typeof name !== "string" || !name.trim()) {
    return Response.json({ error: "Name is required" }, { status: 400 });
  }
  if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
    return Response.json(
      { error: "A valid email is required" },
      { status: 400 },
    );
  }
  if (typeof phone !== "string" || !phone.trim()) {
    return Response.json(
      { error: "Phone number is required" },
      { status: 400 },
    );
  }

  const business = await prisma.business.findUnique({
    where: { username },
    select: {
      id: true,
      name: true,
      userId: true,
      user: { select: { email: true, name: true } },
    },
  });

  if (!business) {
    return Response.json({ error: "Business not found" }, { status: 404 });
  }

  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: slotId },
    select: {
      id: true,
      businessId: true,
      date: true,
      startTime: true,
      endTime: true,
      isBooked: true,
    },
  });

  if (!slot) {
    return Response.json({ error: "Slot not found" }, { status: 404 });
  }

  if (slot.businessId !== business.id) {
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

  const trimmedName = name.trim();
  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPhone = phone.trim();
  const trimmedMessage =
    typeof message === "string" && message.trim() ? message.trim() : null;

  let meetingId: string;

  try {
    const meeting = await prisma.$transaction(async (tx) => {
      const updatedSlot = await tx.availabilitySlot.update({
        where: { id: slotId, isBooked: false },
        data: { isBooked: true },
      });

      return tx.meetingRequest.create({
        data: {
          slotId: updatedSlot.id,
          businessId: business.id,
          guestName: trimmedName,
          guestEmail: trimmedEmail,
          guestPhone: trimmedPhone,
          message: trimmedMessage,
        },
        select: { id: true },
      });
    });

    meetingId = meeting.id;
  } catch {
    return Response.json(
      {
        error:
          "This slot was just booked by someone else. Please choose another.",
      },
      { status: 409 },
    );
  }

  try {
    const slotDate = new Date(slot.date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const { html, text } = renderMeetingRequestEmail({
      ownerName: business.user.name ?? business.user.email,
      requesterName: trimmedName,
      businessName: business.name,
      date: slotDate,
      startTime: slot.startTime,
      endTime: slot.endTime,
      message: trimmedMessage ?? undefined,
      acceptUrl: `${APP_DOMAIN}/api/marketplace/meetings/${meetingId}?action=accept`,
      rejectUrl: `${APP_DOMAIN}/api/marketplace/meetings/${meetingId}?action=reject`,
    });

    await sendEmail({
      to: business.user.email,
      toName: business.user.name,
      subject: `New meeting request from ${trimmedName}`,
      text,
      html,
    });
  } catch (err) {
    console.error("[company/bookings] Failed to send owner notification:", err);
  }

  return Response.json({ success: true, meetingId });
}
