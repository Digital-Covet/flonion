import { Config, Effect, Option, Redacted } from "effect";

/*
 * Typed reads of the environment. Each is an Effect evaluated when it runs,
 * not at import, so a missing variable breaks only the feature that needs it.
 */

/**
 * A secret that may be unset. Empty counts as unset, matching the `!value`
 * checks it replaces. Never fails: a malformed value cannot occur for a plain
 * string, and treating it as unset is the safe side for a secret.
 */
export const optionalSecret = (
  name: string,
): Effect.Effect<Option.Option<Redacted.Redacted<string>>> =>
  Config.option(Config.Redacted(name)).pipe(
    Effect.map(Option.filter((value) => Redacted.value(value) !== "")),
    Effect.orElseSucceed(() => Option.none()),
  );

/**
 * The app's public origin for links in emails and redirects: from env, never
 * from the request's Host header. Unset or empty falls back to local dev.
 */
export const appOrigin: Effect.Effect<string> = Config.String(
  "BETTER_AUTH_URL",
).pipe(
  Effect.orElseSucceed(() => ""),
  Effect.map((value) => value || "http://localhost:3000"),
);

/**
 * A variable the feature cannot work without. Missing or empty is a defect,
 * which the route adapter answers with a 500, as the `getEnv` helpers it
 * replaces did by throwing.
 */
export const requiredEnv = (name: string): Effect.Effect<string> =>
  Config.String(name).pipe(
    Effect.orElseSucceed(() => ""),
    Effect.flatMap((value) =>
      value
        ? Effect.succeed(value)
        : Effect.die(new Error(`Missing environment variable: ${name}`)),
    ),
  );
