import type { APIEvent } from "@solidjs/start/server";
import { APP_DOMAIN } from "~/lib/constants";
import {
  decideMeeting,
  isMeetingAction,
  type MeetingAction,
  type MeetingDecisionResult,
  verifyMeetingDecision,
} from "~/lib/meeting-decision";
import { getSessionFromHeaders } from "~/lib/server-auth";

function meetingIdFrom(event: APIEvent): string | undefined {
  const id = new URL(event.request.url).pathname.split("/").pop();
  return id ? decodeURIComponent(id) : undefined;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function htmlPage(title: string, body: string, status = 200): Response {
  return new Response(
    `<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title>
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <style>body{font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;background:#f6f7f9;}
    .card{background:#fff;padding:2rem;border-radius:12px;box-shadow:0 2px 8px rgba(0,0,0,.08);text-align:center;max-width:400px;}
    h2{margin:0 0 .5rem;color:#111;}p{color:#555;margin:.5rem 0 1.5rem;}
    button{font:inherit;border:0;border-radius:8px;padding:.75rem 1.5rem;color:#fff;cursor:pointer;}
    .accept{background:#15803d;}.reject{background:#b91c1c;}</style></head>
    <body><div class="card">${body}</div></body></html>`,
    { status, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

/**
 * Renders a confirmation page and changes nothing.
 *
 * Mail security scanners (Outlook Safe Links, Mimecast, Proofpoint) fetch
 * links in incoming mail. When this GET accepted or rejected directly, a
 * scanner could decide the request before the owner saw it. The decision now
 * needs the POST that the page's button sends.
 */
export async function GET(event: APIEvent) {
  const url = new URL(event.request.url);
  const id = meetingIdFrom(event);
  const action = url.searchParams.get("action");
  const exp = url.searchParams.get("exp");
  const sig = url.searchParams.get("sig");

  if (!id || !isMeetingAction(action)) {
    return new Response("Invalid request", { status: 400 });
  }

  const signed = verifyMeetingDecision(id, action, exp, sig);
  if (!signed && !(await getSessionFromHeaders(event.request.headers))) {
    return htmlPage(
      "Link expired",
      `<h2>This link is no longer valid</h2>
      <p>Sign in to accept or reject the request from your dashboard.</p>
      <p><a href="${APP_DOMAIN}/collaborations/meeting-schedular">Open dashboard</a></p>`,
      401,
    );
  }

  const verb = action === "accept" ? "Accept" : "Reject";
  const hiddenFields = signed
    ? `<input type="hidden" name="exp" value="${escapeHtml(exp ?? "")}" />
       <input type="hidden" name="sig" value="${escapeHtml(sig ?? "")}" />`
    : "";

  return htmlPage(
    `${verb} meeting request`,
    `<h2>${verb} this meeting request?</h2>
    <p>${
      action === "accept"
        ? "The requester will be notified and a Google Meet link created if your Google account is connected."
        : "The requester will be notified and the slot freed."
    }</p>
    <form method="post">
      <input type="hidden" name="action" value="${action}" />
      ${hiddenFields}
      <button type="submit" class="${action}">${verb} meeting</button>
    </form>`,
  );
}

/**
 * Form target of the confirmation page. Authorized by the signed link fields
 * or, when they are absent or invalid, by the meeting owner's session.
 */
export async function POST(event: APIEvent) {
  const id = meetingIdFrom(event);
  if (!id) return new Response("Invalid request", { status: 400 });

  let form: FormData;
  try {
    form = await event.request.formData();
  } catch {
    return new Response("Invalid request", { status: 400 });
  }

  const action = form.get("action");
  if (!isMeetingAction(action)) {
    return new Response("Invalid action", { status: 400 });
  }

  const exp = form.get("exp");
  const sig = form.get("sig");
  let ownerUserId: string | null = null;

  // A present-but-invalid signature must NOT bypass the ownership check.
  if (
    !verifyMeetingDecision(
      id,
      action,
      typeof exp === "string" ? exp : null,
      typeof sig === "string" ? sig : null,
    )
  ) {
    const session = await getSessionFromHeaders(event.request.headers);
    if (!session) return new Response("Unauthorized", { status: 401 });
    ownerUserId = session.user.id;
  }

  const result = await decideMeeting(id, action, ownerUserId);
  return decisionPage(result, action);
}

function decisionPage(
  result: MeetingDecisionResult,
  action: MeetingAction,
): Response {
  if (!result.ok) {
    if (result.reason === "not_found") {
      return new Response("Meeting not found", { status: 404 });
    }
    if (result.reason === "forbidden") {
      return new Response("Forbidden", { status: 403 });
    }
    return htmlPage(
      "Already decided",
      `<h2>Already ${escapeHtml(result.status)}</h2>
      <p>This meeting request has already been ${escapeHtml(result.status)}.</p>`,
      409,
    );
  }

  const dashboardUrl = `${APP_DOMAIN}/collaborations/meeting-schedular`;
  return htmlPage(
    `Meeting ${result.status}`,
    `<meta http-equiv="refresh" content="3;url=${dashboardUrl}" />
    <h2>Meeting ${action === "accept" ? "Accepted" : "Rejected"}</h2>
    <p>${
      action === "accept"
        ? "You have accepted the meeting request. The requester has been notified."
        : "You have rejected the meeting request. The slot has been freed."
    }</p>
    <p style="font-size:13px;color:#999;">Redirecting to dashboard...</p>`,
  );
}

export async function PATCH(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = meetingIdFrom(event);
  if (!id) {
    return Response.json({ error: "Meeting ID is required" }, { status: 400 });
  }

  let action: unknown;
  try {
    ({ action } = await event.request.json());
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!isMeetingAction(action)) {
    return Response.json(
      { error: "action must be 'accept' or 'reject'" },
      { status: 400 },
    );
  }

  const result = await decideMeeting(id, action, session.user.id);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return Response.json({ error: "Meeting not found" }, { status: 404 });
    }
    if (result.reason === "forbidden") {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }
    return Response.json(
      { error: `Meeting has already been ${result.status}` },
      { status: 400 },
    );
  }

  return Response.json({ meeting: { id, status: result.status } });
}
