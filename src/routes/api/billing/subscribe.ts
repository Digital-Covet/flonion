import { Effect, Predicate, Schema } from "effect";
import {
  cashfreePlanId,
  newSubscriptionId,
} from "~/lib/payments/subscriptions";
import {
  chargeFor,
  effectivePlan,
  isUpgrade,
  PLAN_IDS,
  PLANS,
} from "~/lib/plans";
import {
  BadRequest,
  Conflict,
  NotFound,
  RawResponse,
  UpstreamError,
} from "~/server/effect/errors";
import {
  catchAll,
  orElseAll,
  rateLimit,
  readJsonBody,
  recoverAll,
  requireBusinessContext,
  requireSession,
  requireTeamManager,
} from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Billing } from "~/server/effect/services/billing";
import { catchUniqueViolation, Db } from "~/server/effect/services/db";

const SUBSCRIBE_RATE_LIMIT = 5;
const SUBSCRIBE_WINDOW_MS = 60 * 60 * 1000;

const PlanIdSchema = Schema.Literals(PLAN_IDS);
const BillingSchema = Schema.Literals(["monthly", "yearly"]);

/** Indian mobile number, as Cashfree's mandate flows require. */
const IndianMobile = Schema.String.pipe(
  Schema.check(Schema.isPattern(/^[6-9]\d{9}$/)),
);

function normalizePhone(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[\s()-]/g, "").replace(/^(\+91|0091|0)/, "");
  return Schema.is(IndianMobile)(digits) ? digits : null;
}

/**
 * Starts a Cashfree subscription for a paid plan and returns the session the
 * browser opens checkout with. The amount comes from `chargeFor`, never from
 * the request. Nothing is granted here: the plan changes only once
 * `Billing.sync` sees the authorised mandate.
 */
export const POST = handler(
  "billing.subscribe",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const ctx = yield* requireBusinessContext(session.user.id);
    yield* requireTeamManager(
      ctx,
      "Only the business owner or an admin can change the plan",
    );
    yield* rateLimit(
      `billing-subscribe:${ctx.businessId}`,
      SUBSCRIBE_RATE_LIMIT,
      SUBSCRIBE_WINDOW_MS,
    );

    const raw = yield* readJsonBody(
      () => new BadRequest({ message: "Invalid request body" }),
    );
    const body = (Predicate.isObject(raw) ? raw : {}) as Record<
      string,
      unknown
    >;

    const { planId, billing } = body;
    if (
      !Schema.is(PlanIdSchema)(planId) ||
      !Schema.is(BillingSchema)(billing)
    ) {
      return yield* new BadRequest({ message: "Invalid plan" });
    }
    const plan = PLANS.find((p) => p.id === planId);
    const charge = plan ? chargeFor(plan, billing) : null;
    if (!plan || !charge) {
      return yield* new BadRequest({
        message: "That plan can't be bought online",
      });
    }

    const db = yield* Db;
    const [business, user] = yield* Effect.all(
      [
        db.use((p) =>
          p.business.findUnique({
            where: { id: ctx.businessId },
            select: { plan: true, planExpiresAt: true, phone: true },
          }),
        ),
        db.use((p) =>
          p.user.findUnique({
            where: { id: session.user.id },
            select: { name: true, email: true },
          }),
        ),
      ],
      { concurrency: "unbounded" },
    );
    if (!business || !user) {
      return yield* new NotFound({ message: "No business found" });
    }

    if (!isUpgrade(effectivePlan(business), plan.id)) {
      return yield* new Conflict({
        message: "Your business is already on this plan or higher",
      });
    }

    // A business may have one live mandate. An abandoned checkout is retired
    // first so it doesn't block a fresh attempt.
    const billingService = yield* Billing;
    const existing = yield* db.use((p) =>
      p.billingSubscription.findUnique({
        where: { liveBusinessId: ctx.businessId },
      }),
    );
    if (existing) {
      const current = yield* billingService
        .abandonIfStale(existing)
        .pipe(orElseAll(() => existing));
      if (current.liveBusinessId) {
        return yield* new Conflict({
          message:
            current.status === "BANK_APPROVAL_PENDING"
              ? "A mandate is waiting for your bank's approval. Try again once it's resolved."
              : "A subscription is already in progress for this business. Finish or wait for it before starting another.",
        });
      }
    }

    const phone =
      normalizePhone(body.phone) ?? normalizePhone(business.phone ?? "");
    if (!phone) {
      return yield* new RawResponse({
        response: Response.json(
          { error: "Enter a 10-digit Indian mobile number", field: "phone" },
          { status: 400 },
        ),
      });
    }

    yield* billingService.ensurePlan(plan, billing).pipe(
      recoverAll(
        new UpstreamError({
          status: 502,
          message:
            "Payments are unavailable right now. Please try again later.",
        }),
      ),
    );

    // Inserted before Cashfree is called: the unique `liveBusinessId` turns a
    // concurrent second request into a P2002 here instead of a second mandate.
    const sub = yield* db
      .use((p) =>
        p.billingSubscription.create({
          data: {
            subscriptionId: newSubscriptionId(),
            businessId: ctx.businessId,
            liveBusinessId: ctx.businessId,
            createdById: session.user.id,
            planId: plan.id,
            billing,
            cfPlanId: cashfreePlanId(plan.id, billing),
            amount: charge.total,
          },
        }),
      )
      .pipe(
        catchUniqueViolation(
          () =>
            new Conflict({
              message:
                "A subscription is already in progress for this business.",
            }),
        ),
      );

    const subsSessionId = yield* billingService
      .createSubscription({
        sub,
        plan,
        customer: { name: user.name, email: user.email, phone },
      })
      .pipe(
        // Nothing was authorised, so free the slot for a retry.
        catchAll(() =>
          db
            .use((p) =>
              p.billingSubscription.update({
                where: { id: sub.id },
                data: { status: "FAILED", liveBusinessId: null },
              }),
            )
            .pipe(
              orElseAll(() => undefined),
              Effect.andThen(
                Effect.fail(
                  new UpstreamError({
                    status: 502,
                    message: "Couldn't start checkout. Please try again.",
                  }),
                ),
              ),
            ),
        ),
      );

    // Saved only once Cashfree accepted it, and never over an existing one.
    if (!business.phone) {
      yield* db
        .use((p) =>
          p.business.update({ where: { id: ctx.businessId }, data: { phone } }),
        )
        .pipe(orElseAll(() => undefined));
    }

    return Response.json(
      { subsSessionId, subscriptionId: sub.subscriptionId },
      { status: 201 },
    );
  }),
);
