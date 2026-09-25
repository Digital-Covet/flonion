import { Effect } from "effect";
import { meetingDecisionUrl } from "~/lib/meeting-decision";
import { BadRequest, Conflict, NotFound } from "~/server/effect/errors";
import {
  clientIp,
  orElseAll,
  rateLimit,
  readJsonObject,
  recoverAll,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";
import { Db } from "~/server/effect/services/db";
import { Mailer } from "~/server/effect/services/mailer";
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

const tooManyBookings = {
  message: "Too many booking requests. Please try again later.",
};

export const POST = handler(
  "company.bookings.create",
  Effect.gen(function* () {
    const { url } = yield* RequestContext;
    const segments = url.pathname.split("/");
    const username = decodeURIComponent(
      segments[segments.indexOf("company") + 1] ?? "",
    );
    if (!username) {
      return yield* new BadRequest({
        message: "Business username is required",
      });
    }

    const { slotId, name, email, phone, message } = yield* readJsonObject(
      () => new BadRequest({ message: "Invalid request body" }),
    );

    if (typeof slotId !== "string" || !slotId) {
      return yield* new BadRequest({ message: "slotId is required" });
    }
    if (typeof name !== "string" || !name.trim()) {
      return yield* new BadRequest({ message: "Name is required" });
    }
    if (typeof email !== "string" || !EMAIL_RE.test(email.trim())) {
      return yield* new BadRequest({ message: "A valid email is required" });
    }
    if (typeof phone !== "string" || !phone.trim()) {
      return yield* new BadRequest({ message: "Phone number is required" });
    }
    if (
      name.trim().length > MAX_NAME_LENGTH ||
      email.trim().length > MAX_EMAIL_LENGTH ||
      phone.trim().length > MAX_PHONE_LENGTH ||
      (typeof message === "string" &&
        message.trim().length > MAX_MESSAGE_LENGTH)
    ) {
      return yield* new BadRequest({
        message: "One or more fields are too long",
      });
    }

    yield* rateLimit(
      `booking-ip:${yield* clientIp}`,
      IP_BOOKING_LIMIT,
      IP_BOOKING_WINDOW_MS,
      tooManyBookings,
    );

    const db = yield* Db;
    const business = yield* db.use((p) =>
      p.business.findUnique({
        where: { username, status: "active" },
        select: {
          id: true,
          name: true,
          userId: true,
          user: { select: { email: true, name: true } },
        },
      }),
    );
    if (!business) {
      return yield* new NotFound({ message: "Business not found" });
    }

    const slot = yield* db.use((p) =>
      p.availabilitySlot.findUnique({
        where: { id: slotId },
        select: {
          id: true,
          businessId: true,
          date: true,
          startTime: true,
          endTime: true,
          isBooked: true,
        },
      }),
    );
    if (!slot) return yield* new NotFound({ message: "Slot not found" });
    if (slot.businessId !== business.id) {
      return yield* new BadRequest({
        message: "Slot does not belong to this business",
      });
    }
    if (slot.isBooked) {
      return yield* new Conflict({
        message: "This slot is no longer available",
      });
    }
    if (slot.date < new Date()) {
      return yield* new BadRequest({
        message: "Cannot book a slot in the past",
      });
    }

    // Counted only once the request is otherwise bookable, so invalid
    // requests cannot use up a business's daily allowance.
    yield* rateLimit(
      `booking-business:${business.id}`,
      BUSINESS_BOOKING_LIMIT,
      BUSINESS_BOOKING_WINDOW_MS,
      tooManyBookings,
    );

    const trimmedName = name.trim();
    const trimmedMessage =
      typeof message === "string" && message.trim() ? message.trim() : null;

    // `isBooked: false` in the update makes a concurrent booking of the same
    // slot fail and roll back rather than double-book it.
    const meeting = yield* db
      .transaction(
        Effect.gen(function* () {
          const tx = yield* Db;
          const updatedSlot = yield* tx.use((p) =>
            p.availabilitySlot.update({
              where: { id: slotId, isBooked: false },
              data: { isBooked: true },
            }),
          );
          return yield* tx.use((p) =>
            p.meetingRequest.create({
              data: {
                slotId: updatedSlot.id,
                businessId: business.id,
                guestName: trimmedName,
                guestEmail: email.trim().toLowerCase(),
                guestPhone: phone.trim(),
                message: trimmedMessage,
              },
              select: { id: true },
            }),
          );
        }),
      )
      .pipe(
        recoverAll(
          new Conflict({
            message:
              "This slot was just booked by someone else. Please choose another.",
          }),
        ),
      );

    // Best effort: the booking stands whether or not the owner is emailed.
    const mailer = yield* Mailer;
    yield* Effect.suspend(() => {
      const { html, text } = renderMeetingRequestEmail({
        ownerName: business.user.name ?? business.user.email,
        requesterName: trimmedName,
        businessName: business.name,
        date: new Date(slot.date).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        startTime: slot.startTime,
        endTime: slot.endTime,
        message: trimmedMessage ?? undefined,
        acceptUrl: meetingDecisionUrl(meeting.id, "accept"),
        rejectUrl: meetingDecisionUrl(meeting.id, "reject"),
      });
      return mailer.send({
        to: business.user.email,
        toName: business.user.name,
        subject: `New meeting request from ${trimmedName}`,
        text,
        html,
      });
    }).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          console.error(
            "[company/bookings] Failed to send owner notification:",
            cause,
          ),
        ),
      ),
      orElseAll(() => undefined),
    );

    return { success: true, meetingId: meeting.id };
  }),
);
