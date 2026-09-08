import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { APP_DOMAIN } from "~/lib/constants";
import { verifySignature } from "~/lib/crypto";
import { createMeetLink } from "~/lib/google-meet";
import { generateIcsInvite } from "~/lib/ics";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { sendEmail } from "~/services/email";
import {
  renderMeetingConfirmationOwnerEmail,
  renderMeetingConfirmationVisitorEmail,
  renderMeetingDecisionEmail,
} from "~/services/email-templates";

export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const id = url.pathname.split("/").pop();
  const action = url.searchParams.get("action");
  const sig = url.searchParams.get("sig");

  if (!id || !action) {
    return new Response("Invalid request", { status: 400 });
  }

  if (action !== "accept" && action !== "reject") {
    return new Response("Invalid action", { status: 400 });
  }

  // Allow authorization via valid HMAC signature OR active session (verified
  // against the meeting owner after it is fetched). A present-but-invalid
  // `sig` must NOT bypass the ownership check.
  let hmacAuthorized = false;
  if (sig) {
    hmacAuthorized = verifySignature(
      `${id}:${action}`,
      sig,
      "meeting-decision",
    );
  }

  let session: Awaited<ReturnType<typeof getSessionFromHeaders>> = null;
  if (!hmacAuthorized) {
    session = await getSessionFromHeaders(event.request.headers);
    if (!session) {
      return new Response("Unauthorized", { status: 401 });
    }
    // Session-based auth is verified against the meeting owner below.
  }

  const meeting = await prisma.meetingRequest.findUnique({
    where: { id },
    select: {
      id: true,
      slotId: true,
      status: true,
      message: true,
      meetUri: true,
      meetSpaceId: true,
      guestName: true,
      guestEmail: true,
      guestPhone: true,
      slot: true,
      business: {
        select: {
          name: true,
          userId: true,
          user: { select: { email: true, name: true } },
        },
      },
      requester: { select: { id: true, name: true, email: true } },
    },
  });

  if (!meeting) {
    return new Response("Meeting not found", { status: 404 });
  }

  // If authorized via session (not a valid HMAC), verify ownership.
  if (!hmacAuthorized) {
    if (!session || meeting.business.userId !== session.user.id) {
      return new Response("Forbidden", { status: 403 });
    }
  }

  if (meeting.status !== "pending") {
    return new Response(
      `This meeting request has already been ${meeting.status}.`,
      { status: 400 },
    );
  }

  const newStatus = action === "accept" ? "accepted" : "rejected";

  await prisma.$transaction(async (tx) => {
    await tx.meetingRequest.update({
      where: { id },
      data: { status: newStatus },
    });

    if (action === "reject") {
      await tx.availabilitySlot.update({
        where: { id: meeting.slotId },
        data: { isBooked: false },
      });
    }
  });

  let meetUri: string | undefined;
  if (action === "accept") {
    const meetLink = await createMeetLink(meeting.business.userId);
    if (meetLink) {
      await prisma.meetingRequest.update({
        where: { id },
        data: { meetUri: meetLink.meetUri, meetSpaceId: meetLink.spaceId },
      });
      meetUri = meetLink.meetUri;
    }
  }

  try {
    const slotDate = new Date(meeting.slot.date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    if (action === "accept") {
      const ics = generateIcsInvite({
        summary: `Meeting: ${meeting.requester?.name ?? meeting.guestName} & ${meeting.business.name}`,
        description: [
          `Visitor: ${meeting.requester?.name ?? meeting.guestName}`,
          `Email: ${meeting.requester?.email ?? meeting.guestEmail}`,
          `Phone: ${meeting.guestPhone}`,
          meeting.message ? `Message: ${meeting.message}` : "",
          meetUri ? `Google Meet: ${meetUri}` : "",
        ]
          .filter(Boolean)
          .join("\\n"),
        location: meetUri ?? "Google Meet",
        organizer: {
          name: meeting.business.user.name ?? meeting.business.user.email,
          email: meeting.business.user.email,
        },
        attendees: [
          {
            name: meeting.requester?.name ?? meeting.guestName ?? "Guest",
            email: meeting.requester?.email ?? meeting.guestEmail ?? "",
          },
          {
            name: meeting.business.user.name ?? meeting.business.user.email,
            email: meeting.business.user.email,
          },
        ],
        start: new Date(`T${meeting.slot.startTime}`),
        end: new Date(`T${meeting.slot.endTime}`),
      });

      const icsAttachment = {
        name: "invite.ics",
        content: ics.base64,
        mime_type: "text/calendar; method=REQUEST",
      };

      // Send confirmation email to visitor.
      const visitorEmail = meeting.requester?.email ?? meeting.guestEmail;
      const visitorName = meeting.requester?.name ?? meeting.guestName;
      if (visitorEmail) {
        const { html, text } = renderMeetingConfirmationVisitorEmail({
          visitorName: visitorName ?? "Guest",
          businessName: meeting.business.name,
          date: slotDate,
          startTime: meeting.slot.startTime,
          endTime: meeting.slot.endTime,
          meetUri,
        });

        await sendEmail({
          to: visitorEmail,
          toName: visitorName ?? undefined,
          subject: `Your meeting with ${meeting.business.name} is confirmed!`,
          text,
          html,
          attachments: [icsAttachment],
        });
      }

      // Send confirmation email to owner.
      const { html, text } = renderMeetingConfirmationOwnerEmail({
        ownerName: meeting.business.user.name ?? meeting.business.user.email,
        visitorName: visitorName ?? "Guest",
        visitorEmail: meeting.requester?.email ?? meeting.guestEmail ?? "",
        visitorPhone: meeting.guestPhone ?? "",
        visitorMessage: meeting.message,
        businessName: meeting.business.name,
        date: slotDate,
        startTime: meeting.slot.startTime,
        endTime: meeting.slot.endTime,
        meetUri,
      });

      await sendEmail({
        to: meeting.business.user.email,
        toName: meeting.business.user.name,
        subject: `Meeting confirmed with ${visitorName ?? "Guest"}`,
        text,
        html,
        attachments: [icsAttachment],
      });
    } else {
      // Rejection: send decision email to visitor.
      const recipientEmail = meeting.requester?.email ?? meeting.guestEmail;
      const recipientName = meeting.requester?.name ?? meeting.guestName;

      if (recipientEmail) {
        const { html, text } = renderMeetingDecisionEmail({
          requesterName: recipientName ?? "Guest",
          businessName: meeting.business.name,
          date: slotDate,
          startTime: meeting.slot.startTime,
          endTime: meeting.slot.endTime,
          decision: "rejected",
        });

        await sendEmail({
          to: recipientEmail,
          toName: recipientName ?? undefined,
          subject: `Your meeting request with ${meeting.business.name} was rejected`,
          text,
          html,
        });
      }
    }
  } catch (err) {
    console.error("[marketplace/meetings] Failed to send email:", err);
  }

  const dashboardUrl = `${APP_DOMAIN}/collaborations/meeting-schedular`;
  return new Response(
    `<!DOCTYPE html><html><head><title>Meeting ${newStatus}</title>
    <meta http-equiv="refresh" content="3;url=${dashboardUrl}" />
    <style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f6f7f9;}
    .card{background:#fff;padding:2rem;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);text-align:center;max-width:400px;}
    h2{margin:0 0 .5rem;color:#111;}p{color:#555;margin:.5rem 0 1.5rem;}</style></head>
    <body><div class="card"><h2>Meeting ${newStatus === "accepted" ? "Accepted" : "Rejected"}</h2>
    <p>${
      newStatus === "accepted"
        ? "You have accepted the meeting request. The requester has been notified."
        : "You have rejected the meeting request. The slot has been freed."
    }</p>
    <p style="font-size:13px;color:#999;">Redirecting to dashboard...</p></div></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } },
  );
}

export async function PATCH(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(event.request.url);
  const segments = url.pathname.split("/");
  const id = segments[segments.length - 1];

  if (!id) {
    return Response.json({ error: "Meeting ID is required" }, { status: 400 });
  }

  try {
    const body = await event.request.json();
    const { action } = body;

    if (action !== "accept" && action !== "reject") {
      return Response.json(
        { error: "action must be 'accept' or 'reject'" },
        { status: 400 },
      );
    }

    const meeting = await prisma.meetingRequest.findUnique({
      where: { id },
      select: {
        id: true,
        slotId: true,
        status: true,
        message: true,
        meetUri: true,
        meetSpaceId: true,
        guestName: true,
        guestEmail: true,
        guestPhone: true,
        slot: true,
        business: {
          select: {
            name: true,
            userId: true,
            user: { select: { email: true, name: true } },
          },
        },
        requester: { select: { id: true, name: true, email: true } },
      },
    });

    if (!meeting) {
      return Response.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (meeting.business.userId !== session.user.id) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }

    if (meeting.status !== "pending") {
      return Response.json(
        { error: `Meeting has already been ${meeting.status}` },
        { status: 400 },
      );
    }

    const newStatus = action === "accept" ? "accepted" : "rejected";

    await prisma.$transaction(async (tx) => {
      await tx.meetingRequest.update({
        where: { id },
        data: { status: newStatus },
      });

      if (action === "reject") {
        await tx.availabilitySlot.update({
          where: { id: meeting.slotId },
          data: { isBooked: false },
        });
      }
    });

    let meetUri: string | undefined;
    if (action === "accept") {
      const meetLink = await createMeetLink(meeting.business.userId);
      if (meetLink) {
        await prisma.meetingRequest.update({
          where: { id },
          data: { meetUri: meetLink.meetUri, meetSpaceId: meetLink.spaceId },
        });
        meetUri = meetLink.meetUri;
      }
    }

    try {
      const slotDate = new Date(meeting.slot.date).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      if (action === "accept") {
        const ics = generateIcsInvite({
          summary: `Meeting: ${meeting.requester?.name ?? meeting.guestName} & ${meeting.business.name}`,
          description: [
            `Visitor: ${meeting.requester?.name ?? meeting.guestName}`,
            `Email: ${meeting.requester?.email ?? meeting.guestEmail}`,
            `Phone: ${meeting.guestPhone}`,
            meeting.message ? `Message: ${meeting.message}` : "",
            meetUri ? `Google Meet: ${meetUri}` : "",
          ]
            .filter(Boolean)
            .join("\\n"),
          location: meetUri ?? "Google Meet",
          organizer: {
            name: meeting.business.user.name ?? meeting.business.user.email,
            email: meeting.business.user.email,
          },
          attendees: [
            {
              name: meeting.requester?.name ?? meeting.guestName ?? "Guest",
              email: meeting.requester?.email ?? meeting.guestEmail ?? "",
            },
            {
              name: meeting.business.user.name ?? meeting.business.user.email,
              email: meeting.business.user.email,
            },
          ],
          start: new Date(`T${meeting.slot.startTime}`),
          end: new Date(`T${meeting.slot.endTime}`),
        });

        const icsAttachment = {
          name: "invite.ics",
          content: ics.base64,
          mime_type: "text/calendar; method=REQUEST",
        };

        // Send confirmation email to visitor.
        const visitorEmail = meeting.requester?.email ?? meeting.guestEmail;
        const visitorName = meeting.requester?.name ?? meeting.guestName;
        if (visitorEmail) {
          const { html, text } = renderMeetingConfirmationVisitorEmail({
            visitorName: visitorName ?? "Guest",
            businessName: meeting.business.name,
            date: slotDate,
            startTime: meeting.slot.startTime,
            endTime: meeting.slot.endTime,
            meetUri,
          });

          await sendEmail({
            to: visitorEmail,
            toName: visitorName ?? undefined,
            subject: `Your meeting with ${meeting.business.name} is confirmed!`,
            text,
            html,
            attachments: [icsAttachment],
          });
        }

        // Send confirmation email to owner.
        const { html, text } = renderMeetingConfirmationOwnerEmail({
          ownerName: meeting.business.user.name ?? meeting.business.user.email,
          visitorName: visitorName ?? "Guest",
          visitorEmail: meeting.requester?.email ?? meeting.guestEmail ?? "",
          visitorPhone: meeting.guestPhone ?? "",
          visitorMessage: meeting.message,
          businessName: meeting.business.name,
          date: slotDate,
          startTime: meeting.slot.startTime,
          endTime: meeting.slot.endTime,
          meetUri,
        });

        await sendEmail({
          to: meeting.business.user.email,
          toName: meeting.business.user.name,
          subject: `Meeting confirmed with ${visitorName ?? "Guest"}`,
          text,
          html,
          attachments: [icsAttachment],
        });
      } else {
        // Rejection: send decision email to visitor.
        const recipientEmail = meeting.requester?.email ?? meeting.guestEmail;
        const recipientName = meeting.requester?.name ?? meeting.guestName;

        if (recipientEmail) {
          const { html, text } = renderMeetingDecisionEmail({
            requesterName: recipientName ?? "Guest",
            businessName: meeting.business.name,
            date: slotDate,
            startTime: meeting.slot.startTime,
            endTime: meeting.slot.endTime,
            decision: "rejected",
          });

          await sendEmail({
            to: recipientEmail,
            toName: recipientName ?? undefined,
            subject: `Your meeting request with ${meeting.business.name} was rejected`,
            text,
            html,
          });
        }
      }
    } catch (err) {
      console.error("[marketplace/meetings] Failed to send email:", err);
    }

    return Response.json({ meeting: { ...meeting, status: newStatus } });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
