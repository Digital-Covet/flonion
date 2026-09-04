import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";
import { sendEmail } from "~/services/email";
import { renderMeetingDecisionEmail } from "~/services/email-templates";
import { APP_DOMAIN } from "~/lib/constants";
import { createMeetLink } from "~/lib/google-meet";

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = new URL(event.request.url);
  const id = url.pathname.split("/").pop();
  const action = url.searchParams.get("action");

  if (!id || !action) {
    return new Response("Invalid request", { status: 400 });
  }

  if (action !== "accept" && action !== "reject") {
    return new Response("Invalid action", { status: 400 });
  }

  const meeting = await prisma.meetingRequest.findUnique({
    where: { id },
    include: {
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

  // Same check PATCH performs. This handler is reached from a one-click link in
  // the notification email, but the link only identifies the meeting -- without
  // this any signed-in user could decide someone else's booking, and the accept
  // branch below spends the *business owner's* Google tokens to make a Meet
  // space.
  if (meeting.business.userId !== session.user.id) {
    return new Response("Forbidden", { status: 403 });
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

  // Auto-create a Google Meet link when the meeting is accepted.
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

    const { html, text } = renderMeetingDecisionEmail({
      requesterName: meeting.requester.name || meeting.requester.email,
      businessName: meeting.business.name,
      date: slotDate,
      startTime: meeting.slot.startTime,
      endTime: meeting.slot.endTime,
      decision: newStatus as "accepted" | "rejected",
      meetUri,
    });

    await sendEmail({
      to: meeting.requester.email,
      toName: meeting.requester.name,
      subject: `Your meeting request with ${meeting.business.name} was ${newStatus}`,
      text,
      html,
    });
  } catch (err) {
    console.error("[marketplace/meetings] Failed to send decision email:", err);
  }

  const dashboardUrl = `${APP_DOMAIN}/collaborations/meeting-schedular`;
  return new Response(
    `<!DOCTYPE html><html><head><title>Meeting ${newStatus}</title>
    <meta http-equiv="refresh" content="3;url=${dashboardUrl}" />
    <style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f6f7f9;}
    .card{background:#fff;padding:2rem;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);text-align:center;max-width:400px;}
    h2{margin:0 0 .5rem;color:#111;}p{color:#555;margin:.5rem 0 1.5rem;}</style></head>
    <body><div class="card"><h2>Meeting ${newStatus === "accepted" ? "Accepted" : "Rejected"}</h2>
    <p>${newStatus === "accepted"
      ? "You have accepted the meeting request. The requester has been notified."
      : "You have rejected the meeting request. The slot has been freed."}</p>
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
      include: {
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

    // Auto-create a Google Meet link when the meeting is accepted.
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

      const { html, text } = renderMeetingDecisionEmail({
        requesterName: meeting.requester.name || meeting.requester.email,
        businessName: meeting.business.name,
        date: slotDate,
        startTime: meeting.slot.startTime,
        endTime: meeting.slot.endTime,
        decision: newStatus as "accepted" | "rejected",
        meetUri,
      });

      await sendEmail({
        to: meeting.requester.email,
        toName: meeting.requester.name,
        subject: `Your meeting request with ${meeting.business.name} was ${newStatus}`,
        text,
        html,
      });
    } catch (err) {
      console.error("[marketplace/meetings] Failed to send decision email:", err);
    }

    return Response.json({ meeting: { ...meeting, status: newStatus } });
  } catch {
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
