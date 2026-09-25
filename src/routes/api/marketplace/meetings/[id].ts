import { Effect, Option } from "effect";
import { APP_DOMAIN } from "~/lib/constants";
import {
  decideMeeting,
  isMeetingAction,
  type MeetingAction,
  type MeetingDecisionResult,
  verifyMeetingDecision,
} from "~/lib/meeting-decision";
import {
  BadRequest,
  Forbidden,
  NotFound,
  RawResponse,
} from "~/server/effect/errors";
import {
  currentSession,
  readJsonObject,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";

/** The last path segment; `params` is not relied on for this nested route. */
const meetingId = RequestContext.use(({ url }) =>
  Effect.sync(() => {
    const id = url.pathname.split("/").pop();
    return id ? decodeURIComponent(id) : undefined;
  }),
);

/** The plain-text answers this route has always given the confirmation form. */
const text = (body: string, status: number) =>
  new RawResponse({ response: new Response(body, { status }) });

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
export const GET = handler(
  "marketplace.meetings.confirm-page",
  Effect.gen(function* () {
    const { url } = yield* RequestContext;
    const id = yield* meetingId;
    const action = url.searchParams.get("action");
    const exp = url.searchParams.get("exp");
    const sig = url.searchParams.get("sig");

    if (!id || !isMeetingAction(action)) {
      return yield* text("Invalid request", 400);
    }

    const signed = verifyMeetingDecision(id, action, exp, sig);
    if (!signed && Option.isNone(yield* currentSession)) {
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
  }),
);

/**
 * Form target of the confirmation page. Authorized by the signed link fields
 * or, when they are absent or invalid, by the meeting owner's session.
 */
export const POST = handler(
  "marketplace.meetings.decide-form",
  Effect.gen(function* () {
    const id = yield* meetingId;
    if (!id) return yield* text("Invalid request", 400);

    const { request } = yield* RequestContext;
    const form = yield* Effect.tryPromise({
      try: () => request.formData(),
      catch: () => text("Invalid request", 400),
    });

    const action = form.get("action");
    if (!isMeetingAction(action)) return yield* text("Invalid action", 400);

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
      const session = yield* currentSession;
      if (Option.isNone(session)) return yield* text("Unauthorized", 401);
      ownerUserId = session.value.user.id;
    }

    const result = yield* decideMeeting(id, action, ownerUserId);
    return yield* decisionPage(result, action);
  }),
);

function decisionPage(
  result: MeetingDecisionResult,
  action: MeetingAction,
): Effect.Effect<Response, RawResponse> {
  if (!result.ok) {
    if (result.reason === "not_found") {
      return Effect.fail(text("Meeting not found", 404));
    }
    if (result.reason === "forbidden") {
      return Effect.fail(text("Forbidden", 403));
    }
    return Effect.succeed(
      htmlPage(
        "Already decided",
        `<h2>Already ${escapeHtml(result.status)}</h2>
      <p>This meeting request has already been ${escapeHtml(result.status)}.</p>`,
        409,
      ),
    );
  }

  const dashboardUrl = `${APP_DOMAIN}/collaborations/meeting-schedular`;
  return Effect.succeed(
    htmlPage(
      `Meeting ${result.status}`,
      `<meta http-equiv="refresh" content="3;url=${dashboardUrl}" />
    <h2>Meeting ${action === "accept" ? "Accepted" : "Rejected"}</h2>
    <p>${
      action === "accept"
        ? "You have accepted the meeting request. The requester has been notified."
        : "You have rejected the meeting request. The slot has been freed."
    }</p>
    <p style="font-size:13px;color:#999;">Redirecting to dashboard...</p>`,
    ),
  );
}

export const PATCH = handler(
  "marketplace.meetings.decide",
  Effect.gen(function* () {
    const session = yield* requireSession();

    const id = yield* meetingId;
    if (!id) {
      return yield* new BadRequest({ message: "Meeting ID is required" });
    }

    const { action } = yield* readJsonObject(
      () => new BadRequest({ message: "Invalid request body" }),
    );
    if (!isMeetingAction(action)) {
      return yield* new BadRequest({
        message: "action must be 'accept' or 'reject'",
      });
    }

    const result = yield* decideMeeting(id, action, session.user.id);
    if (!result.ok) {
      if (result.reason === "not_found") {
        return yield* new NotFound({ message: "Meeting not found" });
      }
      if (result.reason === "forbidden") {
        return yield* new Forbidden({ message: "Unauthorized" });
      }
      return yield* new BadRequest({
        message: `Meeting has already been ${result.status}`,
      });
    }

    return { meeting: { id, status: result.status } };
  }),
);
