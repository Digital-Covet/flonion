import { Data, Schema } from "effect";

/*
 * Server-only. The errors a route handler may fail with, and the one place
 * they become HTTP responses. Every JSON error keeps the `{ error: message }`
 * body the client code already reads, so each route passes the exact message
 * it returned before the migration.
 */

export class Unauthorized extends Schema.TaggedError<Unauthorized>()(
  "Unauthorized",
  { message: Schema.String },
) {}

export class Forbidden extends Schema.TaggedError<Forbidden>()("Forbidden", {
  message: Schema.String,
}) {}

export class NotFound extends Schema.TaggedError<NotFound>()("NotFound", {
  message: Schema.String,
}) {}

export class BadRequest extends Schema.TaggedError<BadRequest>()("BadRequest", {
  message: Schema.String,
}) {}

export class Conflict extends Schema.TaggedError<Conflict>()("Conflict", {
  message: Schema.String,
}) {}

export class RateLimited extends Schema.TaggedError<RateLimited>()(
  "RateLimited",
  {
    message: Schema.String,
    /** Sent as `Retry-After` only when set, so existing routes stay byte-identical. */
    retryAfterSec: Schema.optionalKey(Schema.Number),
  },
) {}

/** A dependency (Cashfree, Google, the mail API) failed on its side. */
export class UpstreamError extends Schema.TaggedError<UpstreamError>()(
  "UpstreamError",
  {
    message: Schema.String,
    status: Schema.Literals([500, 502, 503]),
  },
) {}

/**
 * For the responses that are not `{ error }` JSON: empty bodies (the Cashfree
 * webhook's 413/401/503), plain text, or extra headers. Failing with it from
 * deep inside a program short-circuits straight to that response.
 */
export class RawResponse extends Data.TaggedError("RawResponse")<{
  readonly response: Response;
}> {}

/** A 302 from an API route, or `redirect()` from a server function. */
export class Redirect extends Data.TaggedError("Redirect")<{
  readonly location: string;
  /** 302 unless set; 301 for links that moved for good. */
  readonly status?: 301 | 302;
}> {}

/**
 * A Prisma call failed. Never mapped to a specific status: a route that
 * expects a particular code (a unique violation, say) catches it and fails
 * with the matching HTTP error instead; anything left over is a 500.
 */
export class DbError extends Schema.TaggedError<DbError>()("DbError", {
  code: Schema.optionalKey(Schema.String),
  cause: Schema.Defect(),
}) {}

export type HttpError =
  | Unauthorized
  | Forbidden
  | NotFound
  | BadRequest
  | Conflict
  | RateLimited
  | UpstreamError
  | RawResponse
  | Redirect;

const STATUS = {
  Unauthorized: 401,
  Forbidden: 403,
  NotFound: 404,
  BadRequest: 400,
  Conflict: 409,
  RateLimited: 429,
} as const;

export function httpErrorToResponse(error: HttpError): Response {
  switch (error._tag) {
    case "RawResponse":
      return error.response;
    case "Redirect":
      return new Response(null, {
        status: error.status ?? 302,
        headers: { Location: error.location },
      });
    case "UpstreamError":
      return Response.json({ error: error.message }, { status: error.status });
    case "RateLimited":
      return Response.json(
        { error: error.message },
        {
          status: 429,
          headers:
            error.retryAfterSec === undefined
              ? undefined
              : { "Retry-After": String(error.retryAfterSec) },
        },
      );
    default:
      return Response.json(
        { error: error.message },
        { status: STATUS[error._tag] },
      );
  }
}
