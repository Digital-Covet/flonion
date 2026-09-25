import { randomBytes } from "node:crypto";
import { Effect } from "effect";
import { COMPANY_NAME } from "~/lib/constants";
import { inspectOwnedBusiness } from "~/lib/empty-business";
import { isValidRole } from "~/lib/roles";
import { appOrigin } from "~/server/effect/config";
import { BadRequest, RawResponse, UpstreamError } from "~/server/effect/errors";
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
import { Db } from "~/server/effect/services/db";
import { Mailer } from "~/server/effect/services/mailer";
import { renderTeamInvitationEmail } from "~/services/email-templates";

const INVITE_RATE_LIMIT = 20;
const INVITE_WINDOW_MS = 60 * 60 * 1000;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export const POST = handler(
  "team.invite",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const ctx = yield* requireBusinessContext(session.user.id);
    yield* requireTeamManager(
      ctx,
      "Only admins or the business owner can send invitations",
    );

    // Every accepted call sends mail from our domain. Without a cap one
    // account can use this as a mail cannon and burn the sending domain's
    // reputation.
    yield* rateLimit(
      `invite:${ctx.businessId}`,
      INVITE_RATE_LIMIT,
      INVITE_WINDOW_MS,
      {
        message: "Too many invitations sent. Please try again later.",
      },
    );

    const db = yield* Db;
    const inviter = yield* db.use((p) =>
      p.user.findUnique({
        where: { id: session.user.id },
        select: { name: true, email: true },
      }),
    );

    return yield* Effect.gen(function* () {
      const { email, role } = yield* readJsonObject(
        () => new BadRequest({ message: "Invalid request body" }),
      );

      if (typeof email !== "string" || !email.trim()) {
        return yield* new BadRequest({ message: "Email is required" });
      }
      if (!EMAIL_RE.test(email.trim())) {
        return yield* new BadRequest({ message: "Invalid email format" });
      }

      const roleValue =
        typeof role === "string" && isValidRole(role) ? role : "member";
      const normalizedEmail = email.trim().toLowerCase();

      if (normalizedEmail === inviter?.email?.toLowerCase()) {
        return yield* new BadRequest({ message: "You cannot invite yourself" });
      }

      // Anything the accept endpoint would reject is rejected here instead, so
      // the inviter learns immediately rather than the invitee hitting a dead
      // link.
      const existingUser = yield* db.use((p) =>
        p.user.findUnique({
          where: { email: normalizedEmail },
          select: {
            id: true,
            businessId: true,
            business: { select: { id: true } },
          },
        }),
      );

      if (existingUser?.businessId === ctx.businessId) {
        return yield* new BadRequest({
          message: "User is already a team member",
        });
      }
      if (existingUser?.businessId && !existingUser.business) {
        return yield* new BadRequest({
          message: "That account is already part of another team",
        });
      }

      // Owning a business is no longer a hard block: accept-invite offers to
      // discard one that is completely untouched. Only a business with data in
      // it makes the invitation unacceptable.
      const ownedBusiness = existingUser?.business;
      if (existingUser && ownedBusiness) {
        const owned = yield* db.use((p) =>
          inspectOwnedBusiness(p, ownedBusiness.id, existingUser.id),
        );
        if (owned && !owned.empty) {
          return yield* new RawResponse({
            response: Response.json(
              {
                error:
                  "That account already owns a business with data in it and cannot join a team",
                blockers: owned.blockers,
              },
              { status: 400 },
            ),
          });
        }
      }

      const existingInvitation = yield* db.use((p) =>
        p.invitation.findFirst({
          where: {
            email: normalizedEmail,
            businessId: ctx.businessId,
            status: "pending",
            expiresAt: { gt: new Date() },
          },
        }),
      );
      if (existingInvitation) {
        return yield* new BadRequest({
          message: "Invitation already sent to this email",
        });
      }

      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      const invitation = yield* db.use((p) =>
        p.invitation.create({
          data: {
            email: normalizedEmail,
            businessId: ctx.businessId,
            role: roleValue,
            invitedById: session.user.id,
            token,
            expiresAt,
          },
        }),
      );

      const acceptUrl = `${yield* appOrigin}/accept-invite?token=${token}`;
      const { html, text } = renderTeamInvitationEmail({
        inviterName: inviter?.name || "Your team",
        companyName: COMPANY_NAME,
        acceptUrl,
        role: roleValue,
      });

      // Delivery is handled apart from creation: a provider failure once fell
      // into the generic 400 and left a pending row behind that then blocked
      // every retry as a duplicate.
      const mailer = yield* Mailer;
      yield* mailer
        .send({
          to: normalizedEmail,
          subject: `You've been invited to join ${COMPANY_NAME}`,
          text,
          html,
        })
        .pipe(
          Effect.catchCause((cause) =>
            db
              .use((p) => p.invitation.delete({ where: { id: invitation.id } }))
              .pipe(
                orElseAll(() => undefined),
                Effect.andThen(
                  Effect.sync(() =>
                    console.error("[team/invite] delivery failed:", cause),
                  ),
                ),
                Effect.andThen(
                  Effect.fail(
                    new UpstreamError({
                      status: 502,
                      message:
                        "Couldn't send the invitation email. Please check the address and try again.",
                    }),
                  ),
                ),
              ),
          ),
        );

      return Response.json(
        {
          id: invitation.id,
          email: invitation.email,
          role: invitation.role,
          expiresAt: invitation.expiresAt,
        },
        { status: 201 },
      );
    }).pipe(
      recoverUnexpected(
        new BadRequest({ message: "Invalid request body" }),
        "[team/invite] failed:",
      ),
    );
  }),
);
