import { Cause, Effect, Option, Predicate, Schema } from "effect";
import {
  type BusinessContext,
  businessContextSelect,
  canManageTeam,
  toBusinessContext,
} from "~/lib/business-context";
import { type FieldLimit, findOversizedField } from "~/lib/input-limits";
import { getClientIp } from "~/lib/rate-limit";
import {
  BadRequest,
  Forbidden,
  type HttpError,
  NotFound,
  RateLimited,
  Redirect,
  Unauthorized,
} from "./errors";
import { RequestContext } from "./request-context";
import { type AppSession, Auth } from "./services/auth";
import { Db } from "./services/db";
import { RateLimiter } from "./services/rate-limiter";

/*
 * The checks route handlers repeat. Each takes the message its route returned
 * before the migration, so response bodies stay exactly as they were.
 */

/**
 * The session for this request. Middleware has usually resolved it already;
 * `undefined` on `event.locals` means it never ran for this path (the public
 * prefixes), `null` that it ran and found nobody. Only the former falls
 * through to a lookup, whose result is then stashed for the rest of the
 * request.
 */
export const currentSession: Effect.Effect<
  Option.Option<AppSession>,
  never,
  RequestContext | Auth
> = Effect.gen(function* () {
  const { locals, request } = yield* RequestContext;
  const stashed = locals.session;
  if (stashed !== undefined) return Option.fromNullOr(stashed);
  const auth = yield* Auth;
  const session = yield* auth.getSession(request.headers);
  locals.session = Option.getOrNull(session);
  return session;
});

/**
 * For server functions and pages: like `requireSession`, but a signed-out
 * caller is sent to the login page, as server functions always did.
 */
export const requireSessionOrLogin: Effect.Effect<
  AppSession,
  Redirect,
  RequestContext | Auth
> = currentSession.pipe(
  Effect.flatMap(
    Option.match({
      onNone: () => Effect.fail(new Redirect({ location: "/login" })),
      onSome: Effect.succeed,
    }),
  ),
);

export const requireSession = (
  message = "Unauthorized",
): Effect.Effect<AppSession, Unauthorized, RequestContext | Auth> =>
  currentSession.pipe(
    Effect.flatMap(
      Option.match({
        onNone: () => Effect.fail(new Unauthorized({ message })),
        onSome: Effect.succeed,
      }),
    ),
  );

/** The business the user acts in; fails `NotFound` when they have none. */
export const requireBusinessContext = Effect.fn("requireBusinessContext")(
  function* (userId: string, message = "No business found") {
    const db = yield* Db;
    const user = yield* db.use((p) =>
      p.user.findUnique({
        where: { id: userId },
        select: businessContextSelect,
      }),
    );
    const ctx = toBusinessContext(userId, user);
    if (!ctx) return yield* new NotFound({ message });
    return ctx;
  },
);

/** Owners and admins only. */
export const requireTeamManager = (
  ctx: BusinessContext,
  message: string,
): Effect.Effect<void, Forbidden> =>
  canManageTeam(ctx) ? Effect.void : Effect.fail(new Forbidden({ message }));

export interface RateLimitOptions {
  readonly message?: string;
  /** Adds `Retry-After`; off by default so existing 429s stay unchanged. */
  readonly retryAfter?: boolean;
}

/** Fixed-window limit on `key`; fails `RateLimited` once it is spent. */
export const rateLimit = Effect.fn("rateLimit")(function* (
  key: string,
  max: number,
  windowMs: number,
  options: RateLimitOptions = {},
) {
  const limiter = yield* RateLimiter;
  const result = yield* limiter.check(key, max, windowMs);
  if (result.allowed) return result;
  const message =
    options.message ?? "Too many attempts. Please try again later.";
  return yield* options.retryAfter
    ? new RateLimited({
        message,
        retryAfterSec: Math.max(
          1,
          Math.ceil((result.resetAt - Date.now()) / 1000),
        ),
      })
    : new RateLimited({ message });
});

/** Best-effort caller address for rate-limit keys; never for authorization. */
export const clientIp: Effect.Effect<string, never, RequestContext> =
  RequestContext.use((ctx) => Effect.sync(() => getClientIp(ctx.request)));

/** The raw JSON body; `onError` decides the response for a malformed one. */
export const readJsonBody = <E>(
  onError: (cause: unknown) => E,
): Effect.Effect<unknown, E, RequestContext> =>
  RequestContext.use((ctx) =>
    Effect.tryPromise({
      try: () => ctx.request.json() as Promise<unknown>,
      catch: onError,
    }),
  );

/**
 * The JSON body decoded with `schema`. A body that is not JSON and one that
 * does not match both go to `onError`, which returns the route's own 400.
 */
export const decodeJsonBody = <S extends Schema.Constraint, E>(
  schema: S,
  onError: (cause: unknown) => E,
): Effect.Effect<S["Type"], E, RequestContext | S["DecodingServices"]> =>
  readJsonBody(onError).pipe(
    Effect.flatMap((body) =>
      Schema.decodeUnknownEffect(schema)(body).pipe(Effect.mapError(onError)),
    ),
  );

/** The query string decoded with `schema` (a repeated key keeps its last value). */
export const decodeSearchParams = <S extends Schema.Constraint, E>(
  schema: S,
  onError: (cause: unknown) => E,
): Effect.Effect<S["Type"], E, RequestContext | S["DecodingServices"]> =>
  RequestContext.use((ctx) =>
    Schema.decodeUnknownEffect(schema)(
      Object.fromEntries(ctx.url.searchParams),
    ).pipe(Effect.mapError(onError)),
  );

/**
 * Runs `fallback` in place of any failure or defect, letting interruption
 * through. The stand-in for the pre-migration bare `catch {}` blocks, which
 * swallowed everything that went wrong, bugs included.
 */
export const catchAll =
  <E, A2, E2, R2>(
    fallback: (
      /** The typed failure, when there is one (not a defect). */
      error: Option.Option<E>,
      cause: Cause.Cause<E>,
    ) => Effect.Effect<A2, E2, R2>,
  ) =>
  <A, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A | A2, E2, R | R2> =>
    Effect.catchCause(self, (cause) =>
      Cause.hasInterruptsOnly(cause)
        ? Effect.failCause(cause as Cause.Cause<never>)
        : fallback(Cause.findErrorOption(cause), cause),
    );

/** `catchAll`, answering with `error`: `catch { return 4xx/5xx }`. */
export const recoverAll =
  <E2>(error: E2) =>
  <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E2, R> =>
    catchAll<E, never, E2, never>(() => Effect.fail(error))(self);

/** `catchAll`, carrying on with `value`: a `catch` that falls back to a default. */
export const orElseAll =
  <A2>(value: () => A2) =>
  <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A | A2, never, R> =>
    catchAll<E, A2, never, never>(() => Effect.sync(value))(self);

const HTTP_ERROR_TAGS = new Set<string>([
  "Unauthorized",
  "Forbidden",
  "NotFound",
  "BadRequest",
  "Conflict",
  "RateLimited",
  "UpstreamError",
  "RawResponse",
  "Redirect",
]);

/**
 * Replaces everything *unexpected* (a `DbError`, a domain error, a defect)
 * with `error`, letting a deliberate HTTP answer through. The stand-in for a
 * handler whose whole body sat in `try { ... } catch { return 400 }`: its
 * explicit `return Response.json(..., 4xx)` lines were not caught.
 */
export const recoverUnexpected =
  <E2>(
    error: E2,
    /** Logs the unexpected cause under this label, as the old `catch` did. */
    logAs?: string,
  ) =>
  <A, E, R>(
    self: Effect.Effect<A, E, R>,
  ): Effect.Effect<A, Extract<E, HttpError> | E2, R> =>
    catchAll<E, never, Extract<E, HttpError> | E2, never>((failure, cause) => {
      if (
        Option.isSome(failure) &&
        HTTP_ERROR_TAGS.has((failure.value as { _tag?: string })._tag ?? "")
      ) {
        return Effect.fail(failure.value as Extract<E, HttpError>);
      }
      if (logAs) console.error(logAs, Cause.pretty(cause));
      return Effect.fail(error);
    })(self);

/**
 * Fails with the route's 400 when a field is over its limit, with the same
 * message `oversizedFieldResponse` produced.
 */
export const checkFieldLimits = (
  fields: FieldLimit[],
): Effect.Effect<void, BadRequest> => {
  const field = findOversizedField(fields);
  return field
    ? Effect.fail(
        new BadRequest({
          message: `${field.label} must be ${field.max} characters or less`,
        }),
      )
    : Effect.void;
};

/**
 * The business `businessId`, provided `userId` owns it. Anything else is the
 * 403 these routes have always answered with the body "Unauthorized".
 */
export const requireOwnedBusiness = Effect.fn("requireOwnedBusiness")(
  function* (businessId: string, userId: string) {
    const db = yield* Db;
    const business = yield* db.use((p) =>
      p.business.findUnique({
        where: { id: businessId },
        select: { userId: true },
      }),
    );
    if (!business || business.userId !== userId) {
      return yield* new Forbidden({ message: "Unauthorized" });
    }
  },
);

/**
 * The JSON body as an object. Not JSON, or `null`, goes to `onError`; this
 * is where the pre-migration `const { a } = await request.json()` threw.
 */
export const readJsonObject = <E>(
  onError: (cause: unknown) => E,
): Effect.Effect<Record<string, unknown>, E, RequestContext> =>
  readJsonBody(onError).pipe(
    Effect.flatMap((body) =>
      body === null || body === undefined
        ? Effect.fail(onError(body))
        : Effect.succeed(
            (Predicate.isObject(body) ? body : {}) as Record<string, unknown>,
          ),
    ),
  );

/** `id` then `businessId`, each a non-empty string, with the routes' messages. */
export const requireItemRef = (
  body: Record<string, unknown>,
): Effect.Effect<{ id: string; businessId: string }, BadRequest> => {
  const isId = Schema.is(Schema.NonEmptyString);
  if (!isId(body.id)) {
    return Effect.fail(new BadRequest({ message: "id is required" }));
  }
  if (!isId(body.businessId)) {
    return Effect.fail(new BadRequest({ message: "businessId is required" }));
  }
  return Effect.succeed({ id: body.id, businessId: body.businessId });
};

/** A required, non-empty query parameter; missing answers `message` (400). */
export const requireQueryParam = (
  name: string,
  message: string,
): Effect.Effect<string, BadRequest, RequestContext> =>
  RequestContext.use(({ url }) => {
    const value = url.searchParams.get(name);
    return value
      ? Effect.succeed(value)
      : Effect.fail(new BadRequest({ message }));
  });

/**
 * The business the user is a member of, by the `User.businessId` column.
 * These routes have always used membership, not ownership.
 */
export const requireMemberBusinessId = Effect.fn("requireMemberBusinessId")(
  function* (userId: string) {
    const db = yield* Db;
    const user = yield* db.use((p) =>
      p.user.findUnique({
        where: { id: userId },
        select: { businessId: true },
      }),
    );
    if (!user?.businessId) {
      return yield* new NotFound({ message: "No business found" });
    }
    return user.businessId;
  },
);
