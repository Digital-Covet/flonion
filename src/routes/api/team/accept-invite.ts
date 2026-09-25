import { Effect, Schema } from "effect";
import { ClaimConflictError, inspectOwnedBusiness } from "~/lib/empty-business";
import {
  BadRequest,
  NotFound,
  RawResponse,
  UpstreamError,
} from "~/server/effect/errors";
import {
  readJsonObject,
  recoverUnexpected,
  requireSession,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";

const json = (body: unknown, status: number) =>
  new RawResponse({ response: Response.json(body, { status }) });

export const POST = handler(
  "team.accept-invite",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const { token, confirmDeleteOwnedBusiness } = yield* readJsonObject(
      () => new BadRequest({ message: "Invalid request body" }),
    );

    if (!Schema.is(Schema.NonEmptyString)(token)) {
      return yield* new BadRequest({ message: "Token is required" });
    }

    const db = yield* Db;
    const invitation = yield* db.use((p) =>
      p.invitation.findUnique({
        where: { token },
        select: {
          id: true,
          email: true,
          businessId: true,
          role: true,
          status: true,
          expiresAt: true,
        },
      }),
    );
    if (!invitation) {
      return yield* new NotFound({ message: "Invalid invitation" });
    }

    const currentUser = yield* db.use((p) =>
      p.user.findUnique({
        where: { id: session.user.id },
        select: {
          email: true,
          businessId: true,
          business: { select: { id: true } },
        },
      }),
    );
    if (
      !currentUser ||
      currentUser.email?.toLowerCase() !== invitation.email.toLowerCase()
    ) {
      return yield* new BadRequest({
        message: "This invitation is for a different email address",
      });
    }

    // Re-clicking the link after a successful accept should be a no-op, not
    // an error, so the membership check runs before the status check.
    if (currentUser.businessId === invitation.businessId) {
      return { success: true, businessId: invitation.businessId };
    }

    if (invitation.status !== "pending") {
      return yield* new BadRequest({
        message: "Invitation is no longer pending",
      });
    }

    if (new Date() > invitation.expiresAt) {
      yield* db.use((p) =>
        p.invitation.update({
          where: { id: invitation.id },
          data: { status: "expired" },
        }),
      );
      return yield* new BadRequest({ message: "Invitation has expired" });
    }

    // Belonging to someone else's team is checked before ownership so the
    // two cases can't be confused: `businessId` pointing anywhere other than
    // the user's own business means they are already a member somewhere.
    if (
      currentUser.businessId &&
      currentUser.businessId !== currentUser.business?.id
    ) {
      return yield* new BadRequest({
        message: "You are already part of a team",
      });
    }

    // One business per user, so accepting means giving up ownership. That is
    // only allowed when the owned business is untouched, and never without
    // saying so first -- the confirmation round-trip is the whole point.
    let ownedBusinessId: string | null = null;
    const ownedRef = currentUser.business;
    if (ownedRef) {
      const owned = yield* db.use((p) =>
        inspectOwnedBusiness(p, ownedRef.id, session.user.id),
      );
      if (!owned) {
        return yield* new NotFound({ message: "Business not found" });
      }
      if (!owned.empty) {
        return yield* json(
          {
            error:
              "You already own a business with data in it. Invitations can only be accepted by an account that doesn't own one.",
            blockers: owned.blockers,
          },
          400,
        );
      }
      if (confirmDeleteOwnedBusiness !== true) {
        return yield* json(
          {
            requiresConfirmation: true,
            ownedBusiness: { id: owned.id, name: owned.name },
            error: `Accepting will permanently delete "${owned.name}", the empty business you own.`,
          },
          409,
        );
      }
      ownedBusinessId = owned.id;
    }

    // `onboardingCompleted` gates the whole app in middleware.ts. Joining a
    // team is the other way to finish onboarding -- without this the invitee
    // is bounced back to /onboarding forever, since business creation is
    // closed to them.
    //
    // One transaction, so a concurrent accept rolls the membership update
    // back instead of committing it alongside a no-op.
    yield* db
      .transaction(
        Effect.gen(function* () {
          const tx = yield* Db;
          const accepted = yield* tx.use((p) =>
            p.invitation.updateMany({
              where: { id: invitation.id, status: "pending" },
              data: { status: "accepted" },
            }),
          );
          if (accepted.count === 0) {
            return yield* new ClaimConflictError({
              code: "not_pending",
              blockers: [],
            });
          }

          if (ownedBusinessId) {
            const discardId = ownedBusinessId;
            // Re-checked inside the transaction: the pre-flight above ran on a
            // separate connection and the owner could have added a task since.
            // The remaining window -- writing to their own business between
            // this check and the delete -- is left open deliberately; closing
            // it costs Serializable isolation plus 40001 retries on this hot
            // path.
            const owned = yield* tx.use((p) =>
              inspectOwnedBusiness(p, discardId, session.user.id),
            );
            if (!owned?.empty) {
              return yield* new ClaimConflictError({
                code: "owns_business",
                blockers: owned?.blockers ?? [],
              });
            }

            // Guarded by userId so a concurrent ownership change aborts the
            // whole accept instead of deleting a business that is no longer
            // theirs.
            const removed = yield* tx.use((p) =>
              p.business.deleteMany({
                where: { id: discardId, userId: session.user.id },
              }),
            );
            if (removed.count !== 1) {
              return yield* new ClaimConflictError({
                code: "not_pending",
                blockers: [],
              });
            }
          }

          // Any request to join elsewhere is moot now.
          yield* tx.use((p) =>
            p.joinRequest.updateMany({
              where: { userId: session.user.id, status: "pending" },
              data: { status: "cancelled", pendingUserId: null },
            }),
          );

          // LAST write in the transaction, and it must stay last.
          //
          // `User.businessId -> Business.id` is onDelete: SetNull under the
          // default foreignKeys relation mode, so deleting the owned business
          // fires a real Postgres trigger clearing every user row pointing at
          // it. Set membership first and that trigger merely fails to match --
          // correctness resting on a side effect not noticing a row mutated
          // microseconds earlier. Move the delete out of this transaction
          // later and it would clear the membership instead, stranding the
          // user with businessId NULL *and* onboardingCompleted true, a state
          // the middleware onboarding gate never repairs. Deleting first makes
          // the ordering safe regardless of how the FK action is implemented.
          yield* tx.use((p) =>
            p.user.update({
              where: { id: session.user.id },
              data: {
                businessId: invitation.businessId,
                role: invitation.role,
                onboardingCompleted: true,
              },
            }),
          );
        }),
        // The default 5s budget is tight now the callback also runs an
        // inspection query and a cascading delete.
        { timeout: 15_000 },
      )
      .pipe(
        Effect.catchTag(
          "ClaimConflictError",
          (err): Effect.Effect<never, RawResponse | BadRequest> =>
            err.code === "owns_business"
              ? Effect.fail(
                  json(
                    {
                      error:
                        "Your business changed while you were accepting. Refresh and try again.",
                      blockers: err.blockers,
                    },
                    409,
                  ),
                )
              : Effect.fail(
                  new BadRequest({
                    message: "Invitation is no longer pending",
                  }),
                ),
        ),
      );

    return { success: true, businessId: invitation.businessId };
  }).pipe(
    recoverUnexpected(
      new UpstreamError({
        status: 500,
        message: "Couldn't accept the invitation. Please try again.",
      }),
      "[team/accept-invite] failed:",
    ),
  ),
);
