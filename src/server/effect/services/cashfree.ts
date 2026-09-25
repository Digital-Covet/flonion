import { Cashfree as CashfreeSdk, CFEnvironment } from "cashfree-pg";
import {
  Config,
  Context,
  Effect,
  Layer,
  Redacted,
  Schedule,
  Schema,
} from "effect";
import { CASHFREE_API_VERSION } from "~/lib/payments";

/*
 * Server-only: this holds the Cashfree client secret.
 */

/**
 * Cashfree refused or failed a call. Built only from the status, code and
 * message pulled out of the Axios error, so the client secret in the request
 * headers can never reach a log through a `Cause`.
 */
export class CashfreeFailure extends Schema.TaggedError<CashfreeFailure>()(
  "CashfreeFailure",
  {
    message: Schema.String,
    status: Schema.optionalKey(Schema.Number),
    code: Schema.optionalKey(Schema.String),
  },
) {}

export interface CallOptions {
  /**
   * Retry transient failures (network, 5xx). Only for reads: a create or
   * cancel that timed out may still have happened on Cashfree's side.
   */
  readonly retry?: boolean;
}

export class Cashfree extends Context.Service<
  Cashfree,
  {
    /** Every SDK call goes through here. */
    readonly call: <T>(
      label: string,
      fn: (cf: CashfreeSdk) => Promise<{ data: T }>,
      options?: CallOptions,
    ) => Effect.Effect<T, CashfreeFailure>;
  }
>()("revme/Cashfree") {
  static readonly layer = Layer.sync(Cashfree, () => {
    const client = lazyClient();
    return Cashfree.of({
      call: (label, fn, options = {}) => {
        const once = client.pipe(
          Effect.flatMap((cf) =>
            Effect.tryPromise({
              try: async () => (await fn(cf)).data,
              catch: (err) => toFailure(err),
            }),
          ),
          Effect.tapError((e) =>
            Effect.sync(() =>
              console.error(`[payments] ${label} failed`, {
                status: e.status,
                code: e.code,
                message: e.message,
              }),
            ),
          ),
        );
        return options.retry
          ? once.pipe(
              Effect.retry({
                schedule: Schedule.exponential("250 millis").pipe(
                  Schedule.jittered,
                ),
                times: 2,
                while: isTransient,
              }),
            )
          : once;
      },
    });
  });
}

/** Network errors and 5xx. Missing config is not transient. */
function isTransient(e: CashfreeFailure): boolean {
  if (e === notConfigured) return false;
  return e.status === undefined || e.status >= 500;
}

/**
 * Keeps only Cashfree's status, code and message. A raw AxiosError carries
 * the request config, headers included, so it must never be logged or kept.
 */
function toFailure(err: unknown): CashfreeFailure {
  const response = (
    err as {
      response?: {
        status?: number;
        data?: { code?: string; message?: string };
      };
    }
  )?.response;
  const status = response?.status;
  const code = response?.data?.code;
  const message =
    response?.data?.message ??
    (err instanceof Error && !response
      ? err.message
      : "Cashfree request failed");
  return new CashfreeFailure({
    message,
    ...(status === undefined ? {} : { status }),
    ...(code === undefined ? {} : { code }),
  });
}

/**
 * `CASHFREE_ENV` has no default on purpose: production keys must never be
 * sent to the sandbox by omission, or sandbox keys quietly used in production.
 * Values are trimmed and must be non-empty, as `requireEnv` required.
 */
const CashfreeConfig = Config.all({
  env: Config.String("CASHFREE_ENV"),
  clientId: Config.String("CASHFREE_CLIENT_ID"),
  clientSecret: Config.Redacted("CASHFREE_CLIENT_SECRET"),
}).pipe(
  Config.map(({ env, clientId, clientSecret }) => ({
    env: env.trim(),
    clientId: clientId.trim(),
    clientSecret: Redacted.value(clientSecret).trim(),
  })),
);

const notConfigured = new CashfreeFailure({
  message:
    "[payments] CASHFREE_ENV (sandbox or production), CASHFREE_CLIENT_ID and CASHFREE_CLIENT_SECRET must be set",
});

/**
 * Built on first use and kept once built. A config error is not cached, so
 * setting the variables takes effect without a restart, as before.
 */
function lazyClient(): Effect.Effect<CashfreeSdk, CashfreeFailure> {
  let client: CashfreeSdk | undefined;
  return Effect.suspend(() => {
    if (client) return Effect.succeed(client);
    return CashfreeConfig.pipe(
      Effect.mapError(() => notConfigured),
      Effect.flatMap(({ env, clientId, clientSecret }) => {
        if (
          (env !== "sandbox" && env !== "production") ||
          !clientId ||
          !clientSecret
        ) {
          return Effect.fail(notConfigured);
        }
        const built = new CashfreeSdk(
          env === "production"
            ? CFEnvironment.PRODUCTION
            : CFEnvironment.SANDBOX,
          clientId,
          clientSecret,
          undefined,
          undefined,
          undefined,
          // Keep false. When true, the SDK runs `Sentry.init` with Cashfree's
          // own DSN and 100% trace sampling inside this process, which ships
          // traces of our unrelated requests to a third party.
          false,
        );
        built.XApiVersion = CASHFREE_API_VERSION;
        client = built;
        return Effect.succeed(built);
      }),
    );
  });
}
