import { Duration, Effect, Schedule, Schema } from "effect";

/** Transient: network, timeout, a 5xx, a failed refresh, missing config. */
export class GoogleUnavailable extends Schema.TaggedError<GoogleUnavailable>()(
  "GoogleUnavailable",
  { message: Schema.String, cause: Schema.optionalKey(Schema.Defect()) },
) {}

/** Ceiling on a single upstream request. */
export const OUTBOUND_TIMEOUT = Duration.seconds(10);

export interface RequestOptions {
  /** Retry network errors, timeouts and 5xx. Only for idempotent reads. */
  readonly retry?: boolean;
}

/**
 * `fetch` with a deadline. Interruption, the timeout included, aborts the
 * underlying request instead of leaving it running. A non-2xx response is
 * returned, not failed: callers read Google's error bodies.
 */
export function request(
  url: string,
  init: RequestInit = {},
  options: RequestOptions = {},
): Effect.Effect<Response, GoogleUnavailable> {
  const once = Effect.tryPromise({
    try: (signal) => fetch(url, { ...init, signal }),
    catch: (cause) =>
      new GoogleUnavailable({ message: "Google request failed", cause }),
  }).pipe(
    Effect.timeoutOrElse({
      duration: OUTBOUND_TIMEOUT,
      orElse: () =>
        Effect.fail(new GoogleUnavailable({ message: "Google timed out" })),
    }),
  );
  if (!options.retry) return once;
  return once.pipe(
    Effect.flatMap((res) =>
      res.status >= 500
        ? Effect.fail(
            new GoogleUnavailable({ message: `Google answered ${res.status}` }),
          )
        : Effect.succeed(res),
    ),
    Effect.retry({
      schedule: Schedule.exponential("200 millis").pipe(Schedule.jittered),
      times: 2,
    }),
  );
}
