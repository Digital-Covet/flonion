import { Effect } from "effect";
import { ClaimConflictError, inspectOwnedBusiness } from "~/lib/empty-business";
import { isValidRole } from "~/lib/roles";
import { appOrigin } from "~/server/effect/config";
import {
  BadRequest,
  Conflict,
  NotFound,
  RawResponse,
  UpstreamError,
} from "~/server/effect/errors";
import {
  orElseAll,
  rateLimit,
  readJsonObject,
  recoverUnexpected,
  requireBusinessContext,
  requireSession,
  requireTeamManager,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";
import { Db } from "~/server/effect/services/db";
import { Mailer, type SendEmailOptions } from "~/server/effect/services/mailer";
import {
  renderJoinRequestApprovedEmail,
  renderJoinRequestRejectedEmail,
} from "~/services/email-templates";

const REVIEW_RATE_LIMIT = 100;
const REVIEW_WINDOW_MS = 60 * 60 * 1000;

/**
 * The conflicts that leave the request pending on purpose: each is fixable by
 * the requester, and the approve button should keep working once it is.
 */
const CONFLICTS: Record<
  Exclude<ClaimConflictError["code"], "joined_elsewhere">,
  { status: number; error: string }
> = {
  not_pending: { status: 409, error: "Request is no longer pending" },
  user_gone: { status: 410, error: "That account no longer exists" },
  needs_consent: {
    status: 409,
    error:
      "They own a business and haven't agreed to have it removed. Ask them to withdraw and send the request again.",
  },
  owns_business: {
    status: 409,
    error: "They own a business that still has data in it.",
  },
};

const conflict = (code: ClaimConflictError["code"]) =>
  new ClaimConflictError({ code, blockers: [] });

/** Best effort: the decision is already recorded when this runs. */
const notify = (options: SendEmailOptions, label: string) =>
  Mailer.use((mailer) => mailer.send(options)).pipe(
    Effect.tapCause((cause) =>
      Effect.sync(() =>
        console.error(`[team/join-requests] ${label} email failed:`, cause),
      ),
    ),
    orElseAll(() => undefined),
  );

export const PATCH = handler(
  "team.join-requests.review",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const ctx = yield* requireBusinessContext(session.user.id);
    yield* requireTeamManager(
      ctx,
      "Only admins or the business owner can review join requests",
    );
    yield* rateLimit(
      `join-review:${ctx.businessId}`,
      REVIEW_RATE_LIMIT,
      REVIEW_WINDOW_MS,
      { message: "Too many reviews. Please try again later." },
    );

    return yield* Effect.gen(function* () {
      const { action, role } = yield* readJsonObject(
        () => new BadRequest({ message: "Invalid request body" }),
      );
      if (action !== "approve" && action !== "reject") {
        return yield* new BadRequest({ message: "Invalid action" });
      }

      const grantedRole =
        typeof role === "string" && isValidRole(role) ? role : "member";

      const { params } = yield* RequestContext;
      const db = yield* Db;
      const joinRequest = yield* db.use((p) =>
        p.joinRequest.findUnique({
          where: { id: params.id },
          select: {
            id: true,
            businessId: true,
            userId: true,
            status: true,
            consentDeleteOwnedBusiness: true,
            business: { select: { name: true } },
            user: { select: { email: true, name: true } },
          },
        }),
      );

      // One message for "no such row" and "belongs to another business", so
      // ids from other teams can't be probed for existence.
      if (!joinRequest || joinRequest.businessId !== ctx.businessId) {
        return yield* new NotFound({ message: "Request not found" });
      }
      if (joinRequest.status !== "pending") {
        return yield* new Conflict({ message: "Request is no longer pending" });
      }

      if (action === "reject") {
        // A single guarded statement, so no transaction is needed.
        const rejected = yield* db.use((p) =>
          p.joinRequest.updateMany({
            where: { id: joinRequest.id, status: "pending" },
            data: {
              status: "rejected",
              pendingUserId: null,
              reviewedById: session.user.id,
              reviewedAt: new Date(),
            },
          }),
        );
        if (rejected.count === 0) {
          return yield* new Conflict({
            message: "Request is no longer pending",
          });
        }

        const { html, text } = renderJoinRequestRejectedEmail({
          businessName: joinRequest.business.name,
        });
        yield* notify(
          {
            to: joinRequest.user.email,
            toName: joinRequest.user.name ?? undefined,
            subject: `Your request to join ${joinRequest.business.name}`,
            text,
            html,
          },
          "rejection",
        );
        return { success: true, status: "rejected" };
      }

      yield* db
        .transaction(
          Effect.gen(function* () {
            const tx = yield* Db;
            const claimed = yield* tx.use((p) =>
              p.joinRequest.updateMany({
                where: { id: joinRequest.id, status: "pending" },
                data: {
                  status: "approved",
                  grantedRole,
                  pendingUserId: null,
                  reviewedById: session.user.id,
                  reviewedAt: new Date(),
                },
              }),
            );
            if (claimed.count === 0) return yield* conflict("not_pending");

            // Everything below is re-derived from live state rather than from
            // the snapshot taken when the request was made: days can pass, and
            // the requester may have connected a review profile or joined
            // elsewhere in the meantime.
            const joiner = yield* tx.use((p) =>
              p.user.findUnique({
                where: { id: joinRequest.userId },
                select: {
                  businessId: true,
                  business: { select: { id: true } },
                },
              }),
            );
            if (!joiner) return yield* conflict("user_gone");

            const ownedId = joiner.business?.id ?? null;
            if (joiner.businessId && joiner.businessId !== ownedId) {
              return yield* conflict("joined_elsewhere");
            }

            if (ownedId) {
              // Consent belongs to the requester, and only they can give it.
              // The reviewer cannot authorise deleting a business they can't
              // see.
              if (!joinRequest.consentDeleteOwnedBusiness) {
                return yield* conflict("needs_consent");
              }

              const owned = yield* tx.use((p) =>
                inspectOwnedBusiness(p, ownedId, joinRequest.userId),
              );
              if (!owned?.empty) {
                return yield* new ClaimConflictError({
                  code: "owns_business",
                  blockers: owned?.blockers ?? [],
                });
              }

              // Guarded by userId so a concurrent ownership change aborts the
              // approval instead of deleting a business that is no longer
              // theirs.
              const removed = yield* tx.use((p) =>
                p.business.deleteMany({
                  where: { id: ownedId, userId: joinRequest.userId },
                }),
              );
              if (removed.count !== 1) return yield* conflict("not_pending");
            }

            // LAST write in the transaction, and it must stay last -- see the
            // ordering note in accept-invite.ts. Deleting the owned business
            // fires an onDelete: SetNull trigger over `user.businessId`;
            // setting membership afterwards is what keeps that trigger from
            // clearing the membership we just granted.
            yield* tx.use((p) =>
              p.user.update({
                where: { id: joinRequest.userId },
                data: {
                  businessId: ctx.businessId,
                  role: grantedRole,
                  onboardingCompleted: true,
                },
              }),
            );
          }),
          { timeout: 15_000 },
        )
        .pipe(
          Effect.catchTag("ClaimConflictError", (err) =>
            Effect.gen(function* () {
              if (err.code === "joined_elsewhere") {
                // Repaired outside the transaction, which rolled the approval
                // back. The row leaves the queue rather than sitting there
                // un-approvable.
                yield* db.use((p) =>
                  p.joinRequest.updateMany({
                    where: { id: joinRequest.id },
                    data: {
                      status: "cancelled",
                      grantedRole: null,
                      pendingUserId: null,
                      reviewedById: session.user.id,
                      reviewedAt: new Date(),
                    },
                  }),
                );
                return yield* new RawResponse({
                  response: Response.json(
                    {
                      error: "They have since joined another team",
                      resolved: true,
                    },
                    { status: 409 },
                  ),
                });
              }

              const { status, error } = CONFLICTS[err.code];
              return yield* new RawResponse({
                response: Response.json(
                  { error, blockers: err.blockers },
                  { status },
                ),
              });
            }),
          ),
        );

      const { html, text } = renderJoinRequestApprovedEmail({
        businessName: joinRequest.business.name,
        role: grantedRole,
        dashboardUrl: `${yield* appOrigin}/dashboard`,
      });

      // Never rolled back: the membership is already committed, and a failed
      // courtesy email must not un-grant it.
      yield* notify(
        {
          to: joinRequest.user.email,
          toName: joinRequest.user.name ?? undefined,
          subject: `You've joined ${joinRequest.business.name}`,
          text,
          html,
        },
        "approval",
      );

      return {
        success: true,
        status: "approved",
        role: grantedRole,
        userId: joinRequest.userId,
      };
    }).pipe(
      recoverUnexpected(
        new UpstreamError({
          status: 500,
          message: "Couldn't review the request. Please try again.",
        }),
        "[team/join-requests] failed:",
      ),
    );
  }),
);
