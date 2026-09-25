import { Effect, Exit } from "effect";
import { inspectOwnedBusiness } from "~/lib/empty-business";
import { appOrigin } from "~/server/effect/config";
import {
  BadRequest,
  Conflict,
  NotFound,
  RateLimited,
  RawResponse,
  UpstreamError,
} from "~/server/effect/errors";
import {
  clientIp,
  rateLimit,
  readJsonObject,
  recoverUnexpected,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { catchUniqueViolation, Db } from "~/server/effect/services/db";
import { Mailer } from "~/server/effect/services/mailer";
import { renderJoinRequestReceivedEmail } from "~/services/email-templates";

const REQUEST_RATE_LIMIT = 5;
const REQUEST_WINDOW_MS = 24 * 60 * 60 * 1000;

const IP_RATE_LIMIT = 20;
const IP_WINDOW_MS = 60 * 60 * 1000;

/** How long a rejected applicant has to wait before asking the same team again. */
const REJECTION_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const MAX_MESSAGE_LENGTH = 300;

/** Owner plus a handful of admins. Capped so one request can't fan out widely. */
const MAX_NOTIFIED_ADMINS = 5;

const json = (body: unknown, status: number) =>
  new RawResponse({ response: Response.json(body, { status }) });

/** Asks to join an existing business. */
export const POST = handler(
  "team.join-request.create",
  Effect.gen(function* () {
    const session = yield* requireSession();

    // Two keys: a per-user cap alone is defeated by making fresh accounts, and
    // an IP cap alone punishes shared networks.
    yield* rateLimit(
      `join-request:${session.user.id}`,
      REQUEST_RATE_LIMIT,
      REQUEST_WINDOW_MS,
      { message: "Too many join requests. Please try again tomorrow." },
    );
    yield* rateLimit(
      `join-request-ip:${yield* clientIp}`,
      IP_RATE_LIMIT,
      IP_WINDOW_MS,
      { message: "Too many join requests. Please try again later." },
    );

    return yield* Effect.gen(function* () {
      const { businessId, message, confirmDeleteOwnedBusiness } =
        yield* readJsonObject(
          () => new BadRequest({ message: "Invalid request body" }),
        );

      const db = yield* Db;
      const currentUser = yield* db.use((p) =>
        p.user.findUnique({
          where: { id: session.user.id },
          select: {
            id: true,
            name: true,
            email: true,
            businessId: true,
            business: { select: { id: true } },
          },
        }),
      );
      if (!currentUser) {
        return yield* new NotFound({ message: "User not found" });
      }

      if (
        currentUser.businessId &&
        currentUser.businessId !== currentUser.business?.id
      ) {
        return yield* new Conflict({
          message: "You are already part of a team",
        });
      }

      // Consent for the escape hatch is captured here, from the person whose
      // business it is. The admin who eventually approves has no visibility
      // into it and cannot meaningfully authorise its deletion, so the answer
      // is persisted on the row and re-verified at approval time.
      const ownedRef = currentUser.business;
      if (ownedRef) {
        const owned = yield* db.use((p) =>
          inspectOwnedBusiness(p, ownedRef.id, session.user.id),
        );
        if (owned && !owned.empty) {
          return yield* json(
            {
              error:
                "You own a business that still has data in it. Delete or hand it over before joining another team.",
              blockers: owned.blockers,
            },
            409,
          );
        }
        if (owned && confirmDeleteOwnedBusiness !== true) {
          return yield* json(
            {
              requiresConfirmation: true,
              ownedBusiness: { id: owned.id, name: owned.name },
              error: `Joining a team will permanently delete "${owned.name}", the empty business you own.`,
            },
            409,
          );
        }
      }

      if (typeof businessId !== "string" || !businessId.trim()) {
        return yield* new BadRequest({ message: "Business is required" });
      }

      const business = yield* db.use((p) =>
        p.business.findUnique({
          where: { id: businessId },
          select: { id: true, name: true, userId: true },
        }),
      );
      if (!business) {
        return yield* new NotFound({ message: "Business not found" });
      }
      if (business.userId === session.user.id) {
        return yield* new BadRequest({
          message: "You can't request to join your own business",
        });
      }

      let normalizedMessage: string | null = null;
      if (message !== undefined && message !== null) {
        if (typeof message !== "string") {
          return yield* new BadRequest({ message: "Invalid message" });
        }
        const trimmed = message.trim();
        if (trimmed.length > MAX_MESSAGE_LENGTH) {
          return yield* new BadRequest({
            message: `Message must be ${MAX_MESSAGE_LENGTH} characters or less`,
          });
        }
        normalizedMessage = trimmed || null;
      }

      // A rejection should not be re-askable immediately, or "reject" becomes
      // a button an admin has to keep pressing.
      const recentRejection = yield* db.use((p) =>
        p.joinRequest.findFirst({
          where: {
            userId: session.user.id,
            businessId: business.id,
            status: "rejected",
            reviewedAt: { gt: new Date(Date.now() - REJECTION_COOLDOWN_MS) },
          },
          select: { id: true },
        }),
      );
      if (recentRejection) {
        return yield* new RateLimited({
          message:
            "That team declined a recent request. You can ask again in 24 hours.",
        });
      }

      const existing = yield* db.use((p) =>
        p.joinRequest.findFirst({
          where: { userId: session.user.id, status: "pending" },
          select: { id: true, businessId: true },
        }),
      );
      if (existing) {
        return yield* new Conflict({
          message:
            existing.businessId === business.id
              ? "You already have a pending request to join this team"
              : "You already have a pending request to join another team",
        });
      }

      const joinRequest = yield* db
        .use((p) =>
          p.joinRequest.create({
            data: {
              businessId: business.id,
              userId: session.user.id,
              // Mirrors `userId` while pending. The unique index on it is what
              // makes a concurrent double-submit a P2002 rather than two live
              // rows.
              pendingUserId: session.user.id,
              message: normalizedMessage,
              consentDeleteOwnedBusiness: confirmDeleteOwnedBusiness === true,
            },
            select: { id: true, createdAt: true },
          }),
        )
        .pipe(
          catchUniqueViolation(
            () =>
              new Conflict({ message: "You already have a pending request" }),
          ),
        );

      // Best effort, and deliberately not rolled back on failure -- unlike
      // /api/team/invite, where the email carries the only copy of the token
      // and a row whose mail never sent is a dead link. Here the row *is* the
      // deliverable: it shows up in the team's queue and on the requester's
      // waiting screen whether or not the provider was up.
      // The owner is fetched by id rather than by `businessId`: that column is
      // NULL for anyone who onboarded before it existed (see
      // business-context.ts), so a membership-scoped query would silently skip
      // them -- the one person who most needs this email.
      const [owner, admins] = yield* Effect.all(
        [
          db.use((p) =>
            p.user.findUnique({
              where: { id: business.userId },
              select: { id: true, email: true, name: true },
            }),
          ),
          db.use((p) =>
            p.user.findMany({
              where: { businessId: business.id, role: "admin" },
              select: { id: true, email: true, name: true },
              take: MAX_NOTIFIED_ADMINS,
            }),
          ),
        ],
        { concurrency: "unbounded" },
      );

      const recipients = [...(owner ? [owner] : []), ...admins].filter(
        (person, index, all) =>
          all.findIndex((other) => other.id === person.id) === index,
      );

      const requester = currentUser.name || currentUser.email;
      const { html, text } = renderJoinRequestReceivedEmail({
        requesterName: requester,
        requesterEmail: currentUser.email,
        businessName: business.name,
        message: normalizedMessage,
        reviewUrl: `${yield* appOrigin}/settings/team`,
      });

      const mailer = yield* Mailer;
      const results = yield* Effect.forEach(
        recipients,
        (recipient) =>
          Effect.exit(
            mailer.send({
              to: recipient.email,
              toName: recipient.name ?? undefined,
              subject: `${requester} wants to join ${business.name}`,
              text,
              html,
            }),
          ),
        { concurrency: "unbounded" },
      );

      const notified = results.filter(Exit.isSuccess).length;
      if (notified < results.length) {
        console.error(
          `[team/join-request] ${results.length - notified} notification(s) failed for business ${business.id}`,
        );
      }

      return Response.json(
        {
          id: joinRequest.id,
          status: "pending",
          businessId: business.id,
          businessName: business.name,
          createdAt: joinRequest.createdAt,
          notified,
        },
        { status: 201 },
      );
    }).pipe(
      recoverUnexpected(
        new UpstreamError({
          status: 500,
          message: "Couldn't send your request. Please try again.",
        }),
        "[team/join-request] failed:",
      ),
    );
  }),
);

/** The caller's own most recent request, whatever its state. */
export const GET = handler(
  "team.join-request.get",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const db = yield* Db;

    const request = yield* db.use((p) =>
      p.joinRequest.findFirst({
        where: { userId: session.user.id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          status: true,
          message: true,
          createdAt: true,
          reviewedAt: true,
          grantedRole: true,
          business: {
            select: { id: true, name: true, username: true, logo: true },
          },
        },
      }),
    );
    if (!request) return { request: null, joined: false };

    const user = yield* db.use((p) =>
      p.user.findUnique({
        where: { id: session.user.id },
        select: { businessId: true },
      }),
    );

    // The waiting screen polls for exactly this: membership landed, so the
    // approval went through and the client can move on to the dashboard.
    return { request, joined: user?.businessId === request.business.id };
  }),
);

/** Withdraws the caller's own pending request. */
export const DELETE = handler(
  "team.join-request.withdraw",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const db = yield* Db;

    // `reviewedById` stays NULL, which is what distinguishes a withdrawal
    // from an approval-time cancellation.
    const cancelled = yield* db.use((p) =>
      p.joinRequest.updateMany({
        where: { userId: session.user.id, status: "pending" },
        data: { status: "cancelled", pendingUserId: null },
      }),
    );
    if (cancelled.count === 0) {
      return yield* new NotFound({ message: "No pending request" });
    }
    return { success: true };
  }),
);
