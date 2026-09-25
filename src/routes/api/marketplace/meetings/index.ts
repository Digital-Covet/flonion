import { Effect } from "effect";
import { meetingDecisionUrl } from "~/lib/meeting-decision";
import {
  BadRequest,
  Conflict,
  NotFound,
  UpstreamError,
} from "~/server/effect/errors";
import {
  orElseAll,
  readJsonObject,
  recoverUnexpected,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";
import { Db } from "~/server/effect/services/db";
import { Mailer } from "~/server/effect/services/mailer";
import { renderMeetingRequestEmail } from "~/services/email-templates";

export const GET = handler(
  "marketplace.meetings.list",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const { url } = yield* RequestContext;
    const type = url.searchParams.get("type") ?? "all";
    const category = url.searchParams.get("category") ?? "all";
    const statusFilter = url.searchParams.get("status") ?? undefined;

    const db = yield* Db;
    const userBusiness = yield* db.use((p) =>
      p.business.findUnique({
        where: { userId: session.user.id },
        select: { id: true },
      }),
    );

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
    if (statusFilter) where.status = statusFilter;

    const meetings = yield* db.use((p) =>
      p.meetingRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          slot: { select: { date: true, startTime: true, endTime: true } },
          business: {
            select: { id: true, name: true, logo: true, username: true },
          },
          requester: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
              businessId: true,
            },
          },
        },
      }),
    );

    // Category from the requester's relationship to the business.
    const enriched = meetings.map((meeting) => {
      const requesterBusinessId = meeting.requester?.businessId;
      const meetingCategory =
        requesterBusinessId && requesterBusinessId === meeting.businessId
          ? "team"
          : "partner";
      const direction =
        userBusiness && meeting.businessId === userBusiness.id
          ? "incoming"
          : "outgoing";
      return { ...meeting, category: meetingCategory, direction };
    });

    return {
      meetings:
        category === "all"
          ? enriched
          : enriched.filter((m) => m.category === category),
    };
  }).pipe(
    recoverUnexpected(
      new UpstreamError({ status: 500, message: "Failed to load meetings" }),
      "[marketplace/meetings] query failed:",
    ),
  ),
);

export const POST = handler(
  "marketplace.meetings.request",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const body = yield* readJsonObject(
      () => new BadRequest({ message: "Invalid request body" }),
    );
    const { slotId, businessId, message } = body;

    if (typeof slotId !== "string" || typeof businessId !== "string") {
      return yield* new BadRequest({
        message: "slotId and businessId are required",
      });
    }

    const db = yield* Db;
    const slot = yield* db.use((p) =>
      p.availabilitySlot.findUnique({
        where: { id: slotId },
        include: {
          business: {
            select: {
              id: true,
              name: true,
              userId: true,
              status: true,
              user: { select: { email: true, name: true } },
            },
          },
        },
      }),
    );

    // A suspended business takes no bookings; its slots read as missing.
    if (!slot || slot.business.status !== "active") {
      return yield* new NotFound({ message: "Slot not found" });
    }
    if (slot.businessId !== businessId) {
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
    if (slot.business.userId === session.user.id) {
      return yield* new BadRequest({
        message: "You cannot book a meeting with yourself",
      });
    }

    // `isBooked: false` in the update makes a concurrent booking of the same
    // slot fail here (P2025) and roll back, rather than double-book it.
    const meeting = yield* db.transaction(
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
              businessId,
              requesterId: session.user.id,
              message:
                typeof message === "string" && message.trim()
                  ? message.trim()
                  : null,
            },
            include: {
              slot: true,
              business: { select: { name: true } },
            },
          }),
        );
      }),
    );

    // Best-effort: the booking stands whether or not the owner is emailed.
    // Signed decision links work without a session (the GET handler shows a
    // confirmation page; its POST verifies the signature and expiry).
    const mailer = yield* Mailer;
    yield* Effect.suspend(() => {
      const { html, text } = renderMeetingRequestEmail({
        ownerName: slot.business.user.name,
        requesterName: session.user.name || session.user.email,
        businessName: slot.business.name,
        date: new Date(slot.date).toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        startTime: slot.startTime,
        endTime: slot.endTime,
        message: meeting.message ?? undefined,
        acceptUrl: meetingDecisionUrl(meeting.id, "accept"),
        rejectUrl: meetingDecisionUrl(meeting.id, "reject"),
      });
      return mailer.send({
        to: slot.business.user.email,
        toName: slot.business.user.name,
        subject: `New meeting request from ${session.user.name || session.user.email}`,
        text,
        html,
      });
    }).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          console.error(
            "[marketplace/meetings] Failed to send notification email:",
            cause,
          ),
        ),
      ),
      orElseAll(() => undefined),
    );

    return { meeting };
  }).pipe(
    recoverUnexpected(new BadRequest({ message: "Invalid request body" })),
  ),
);
