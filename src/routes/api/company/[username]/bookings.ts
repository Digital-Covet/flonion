import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { meetingDecisionUrl } from "~/lib/meeting-decision";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";
import { sendEmail } from "~/services/email";
import { renderMeetingRequestEmail } from "~/services/email-templates";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 254;
const MAX_PHONE_LENGTH = 32;
const MAX_MESSAGE_LENGTH = 1000;

// Anonymous, and every booking locks a slot and emails the owner. Without a
// cap one caller can book out a business's whole calendar.
const IP_BOOKING_LIMIT = 5;
const IP_BOOKING_WINDOW_MS = 60 * 60 * 1000;
const BUSINESS_BOOKING_LIMIT = 20;
const BUSINESS_BOOKING_WINDOW_MS = 24 * 60 * 60 * 1000;

function rateLimited() {
  return Response.json(
    { error: "Too many booking requests. Please try again later." },
    { status: 429 },
  );
}

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
  if (
    name.trim().length > MAX_NAME_LENGTH ||
    email.trim().length > MAX_EMAIL_LENGTH ||
    phone.trim().length > MAX_PHONE_LENGTH ||
    (typeof message === "string" && message.trim().length > MAX_MESSAGE_LENGTH)
  ) {
    return Response.json(
      { error: "One or more fields are too long" },
      { status: 400 },
    );
  }

  if (
    !checkRateLimit(
      `booking-ip:${getClientIp(event.request)}`,
      IP_BOOKING_LIMIT,
      IP_BOOKING_WINDOW_MS,
    ).allowed
  ) {
    return rateLimited();
  }

  const business = await prisma.business.findUnique({
    where: { username, status: "active" },
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

  // Counted only once the request is otherwise bookable, so invalid requests
  // cannot use up a business's daily allowance.
  if (
    !checkRateLimit(
      `booking-business:${business.id}`,
      BUSINESS_BOOKING_LIMIT,
      BUSINESS_BOOKING_WINDOW_MS,
    ).allowed
  ) {
    return rateLimited();
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
      acceptUrl: meetingDecisionUrl(meetingId, "accept"),
      rejectUrl: meetingDecisionUrl(meetingId, "reject"),
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
