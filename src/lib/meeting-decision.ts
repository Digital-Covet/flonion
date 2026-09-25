import type { Prisma } from "@generated/prisma/client";
import { Effect, Option } from "effect";
import { APP_DOMAIN } from "~/lib/constants";
import { sign, verifySignature } from "~/lib/crypto";
import { generateIcsInvite } from "~/lib/ics";
import { zonedWallTimeToUtc } from "~/lib/timezone-label";
import { orElseAll } from "~/server/effect/guards";
import { Db } from "~/server/effect/services/db";
import { Google } from "~/server/effect/services/google";
import { Mailer } from "~/server/effect/services/mailer";
import {
  renderMeetingConfirmationOwnerEmail,
  renderMeetingConfirmationVisitorEmail,
  renderMeetingDecisionEmail,
} from "~/services/email-templates";

export type MeetingAction = "accept" | "reject";

const SIGNATURE_PURPOSE = "meeting-decision";

/** How long an emailed accept/reject link stays usable. */
const DECISION_LINK_TTL_SECONDS = 14 * 24 * 60 * 60;

/** Schedule settings are documented as IST; used if a stored zone is invalid. */
const FALLBACK_TIMEZONE = "Asia/Kolkata";

/**
 * Ceilings on the visitor-supplied text that reaches the .ics attachment.
 * `ics.ts` folds safely on any input, so this is belt-and-braces: an invite
 * does not need a 1000-character message body, and a bounded attachment keeps
 * the outbound email small.
 */
const MAX_INVITE_SUMMARY = 200;
const MAX_INVITE_DESCRIPTION = 2000;

function clampForInvite(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

export function isMeetingAction(value: unknown): value is MeetingAction {
  return value === "accept" || value === "reject";
}

/**
 * Signed link for the owner's decision email. The expiry is part of the
 * signed payload, so it cannot be extended by editing the URL.
 */
export function meetingDecisionUrl(
  meetingId: string,
  action: MeetingAction,
): string {
  const exp = Math.floor(Date.now() / 1000) + DECISION_LINK_TTL_SECONDS;
  const sig = sign(`${meetingId}:${action}:${exp}`, SIGNATURE_PURPOSE);
  const params = new URLSearchParams({ action, exp: String(exp), sig });
  return `${APP_DOMAIN}/api/marketplace/meetings/${encodeURIComponent(meetingId)}?${params}`;
}

export function verifyMeetingDecision(
  meetingId: string,
  action: MeetingAction,
  exp: string | null,
  sig: string | null,
): boolean {
  if (!exp || !sig || !/^\d+$/.test(exp)) return false;
  if (Number(exp) < Math.floor(Date.now() / 1000)) return false;
  return verifySignature(
    `${meetingId}:${action}:${exp}`,
    sig,
    SIGNATURE_PURPOSE,
  );
}

const MEETING_SELECT = {
  id: true,
  slotId: true,
  status: true,
  message: true,
  guestName: true,
  guestEmail: true,
  guestPhone: true,
  slot: true,
  business: {
    select: {
      name: true,
      userId: true,
      timezone: true,
      user: { select: { email: true, name: true } },
    },
  },
  requester: { select: { id: true, name: true, email: true } },
} satisfies Prisma.MeetingRequestSelect;

type DecidedMeeting = Prisma.MeetingRequestGetPayload<{
  select: typeof MEETING_SELECT;
}>;

export type MeetingDecisionResult =
  | { ok: true; status: "accepted" | "rejected" }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "forbidden" }
  | { ok: false; reason: "already_decided"; status: string };

/**
 * Accept or reject a pending meeting request, then create the Meet space and
 * send the emails.
 *
 * The pending -> decided transition is claimed with a conditional update, so
 * two concurrent decisions (a link scanner and the owner, or a double click)
 * cannot both proceed and create duplicate Meet links or emails.
 *
 * @param ownerUserId - When set, the meeting must belong to this user. Pass
 *   null only when the caller holds a verified signed decision link.
 */
export const decideMeeting = Effect.fn("decideMeeting")(function* (
  meetingId: string,
  action: MeetingAction,
  ownerUserId: string | null,
) {
  const db = yield* Db;
  const meeting = yield* db.use((p) =>
    p.meetingRequest.findUnique({
      where: { id: meetingId },
      select: MEETING_SELECT,
    }),
  );

  if (!meeting) {
    return { ok: false, reason: "not_found" } as MeetingDecisionResult;
  }

  if (ownerUserId !== null && meeting.business.userId !== ownerUserId) {
    return { ok: false, reason: "forbidden" } as MeetingDecisionResult;
  }

  const newStatus = action === "accept" ? "accepted" : "rejected";

  const claimed = yield* db.transaction(
    Effect.gen(function* () {
      const tx = yield* Db;
      const { count } = yield* tx.use((p) =>
        p.meetingRequest.updateMany({
          where: { id: meetingId, status: "pending" },
          data: { status: newStatus },
        }),
      );
      if (count === 0) return false;

      if (action === "reject") {
        yield* tx.use((p) =>
          p.availabilitySlot.update({
            where: { id: meeting.slotId },
            data: { isBooked: false },
          }),
        );
      }
      return true;
    }),
  );

  if (!claimed) {
    const current = yield* db.use((p) =>
      p.meetingRequest.findUnique({
        where: { id: meetingId },
        select: { status: true },
      }),
    );
    return {
      ok: false,
      reason: "already_decided",
      status: current?.status ?? meeting.status,
    } as MeetingDecisionResult;
  }

  let meetUri: string | undefined;
  if (action === "accept") {
    const google = yield* Google;
    const meetLink = yield* google.createMeetLink(meeting.business.userId);
    if (Option.isSome(meetLink)) {
      yield* db.use((p) =>
        p.meetingRequest.update({
          where: { id: meetingId },
          data: {
            meetUri: meetLink.value.meetUri,
            meetSpaceId: meetLink.value.spaceId,
          },
        }),
      );
      meetUri = meetLink.value.meetUri;
    }
  }

  // Best-effort: the decision stands whether or not the emails go out.
  yield* sendDecisionEmails(meeting, action, meetUri).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        console.error("[marketplace/meetings] Failed to send email:", cause),
      ),
    ),
    orElseAll(() => undefined),
  );

  return { ok: true, status: newStatus } as MeetingDecisionResult;
});

/**
 * Slot dates are stored as the calendar day at UTC midnight and times as
 * wall-clock HH:MM in the business's zone.
 */
function slotInstants(
  slot: DecidedMeeting["slot"],
  timeZone: string,
): { start: Date; end: Date } | null {
  const day = slot.date.toISOString().slice(0, 10);
  for (const zone of [timeZone, FALLBACK_TIMEZONE]) {
    const start = zonedWallTimeToUtc(day, slot.startTime, zone);
    const end = zonedWallTimeToUtc(day, slot.endTime, zone);
    if (start && end) return { start, end };
  }
  return null;
}

const sendDecisionEmails = Effect.fn("sendDecisionEmails")(function* (
  meeting: DecidedMeeting,
  action: MeetingAction,
  meetUri: string | undefined,
) {
  const mailer = yield* Mailer;
  const slotDate = new Date(meeting.slot.date).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  const visitorEmail = meeting.requester?.email ?? meeting.guestEmail;
  const visitorName = meeting.requester?.name ?? meeting.guestName;

  if (action === "reject") {
    if (!visitorEmail) return;
    const { html, text } = renderMeetingDecisionEmail({
      requesterName: visitorName ?? "Guest",
      businessName: meeting.business.name,
      date: slotDate,
      startTime: meeting.slot.startTime,
      endTime: meeting.slot.endTime,
      decision: "rejected",
    });

    yield* mailer.send({
      to: visitorEmail,
      toName: visitorName ?? undefined,
      subject: `Your meeting request with ${meeting.business.name} was rejected`,
      text,
      html,
    });
    return;
  }

  const ownerName = meeting.business.user.name ?? meeting.business.user.email;
  const instants = slotInstants(meeting.slot, meeting.business.timezone);

  // A malformed slot must not produce an invite with NaN times; send the
  // emails without the attachment instead.
  const attachments = instants
    ? [
        {
          name: "invite.ics",
          content: generateIcsInvite({
            summary: clampForInvite(
              `Meeting: ${visitorName} & ${meeting.business.name}`,
              MAX_INVITE_SUMMARY,
            ),
            description: clampForInvite(
              [
                `Visitor: ${visitorName}`,
                `Email: ${visitorEmail}`,
                `Phone: ${meeting.guestPhone}`,
                meeting.message ? `Message: ${meeting.message}` : "",
                meetUri ? `Google Meet: ${meetUri}` : "",
              ]
                .filter(Boolean)
                .join("\n"),
              MAX_INVITE_DESCRIPTION,
            ),
            location: meetUri ?? "Google Meet",
            organizer: { name: ownerName, email: meeting.business.user.email },
            attendees: [
              { name: visitorName ?? "Guest", email: visitorEmail ?? "" },
              { name: ownerName, email: meeting.business.user.email },
            ],
            start: instants.start,
            end: instants.end,
          }).base64,
          mime_type: "text/calendar; method=REQUEST",
        },
      ]
    : undefined;

  if (visitorEmail) {
    const { html, text } = renderMeetingConfirmationVisitorEmail({
      visitorName: visitorName ?? "Guest",
      businessName: meeting.business.name,
      date: slotDate,
      startTime: meeting.slot.startTime,
      endTime: meeting.slot.endTime,
      meetUri,
    });

    yield* mailer.send({
      to: visitorEmail,
      toName: visitorName ?? undefined,
      subject: `Your meeting with ${meeting.business.name} is confirmed!`,
      text,
      html,
      attachments,
    });
  }

  const { html, text } = renderMeetingConfirmationOwnerEmail({
    ownerName,
    visitorName: visitorName ?? "Guest",
    visitorEmail: visitorEmail ?? "",
    visitorPhone: meeting.guestPhone ?? "",
    visitorMessage: meeting.message,
    businessName: meeting.business.name,
    date: slotDate,
    startTime: meeting.slot.startTime,
    endTime: meeting.slot.endTime,
    meetUri,
  });

  yield* mailer.send({
    to: meeting.business.user.email,
    toName: meeting.business.user.name,
    subject: `Meeting confirmed with ${visitorName ?? "Guest"}`,
    text,
    html,
    attachments,
  });
});
