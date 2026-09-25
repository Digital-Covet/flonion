import { Context, Effect, Layer, Option } from "effect";
import { getSessionFromHeaders } from "~/lib/server-auth";

export type AppSession = NonNullable<
  Awaited<ReturnType<typeof getSessionFromHeaders>>
>;

export class Auth extends Context.Service<
  Auth,
  {
    /**
     * better-auth's session for these headers, `None` when signed out or
     * banned. Never fails: a lookup error counts as signed out, exactly as in
     * `getSessionFromHeaders`, which middleware still calls directly.
     */
    readonly getSession: (
      headers: Headers,
    ) => Effect.Effect<Option.Option<AppSession>>;
  }
>()("revme/Auth") {
  static readonly layer = Layer.succeed(
    Auth,
    Auth.of({
      getSession: (headers) =>
        Effect.promise(() => getSessionFromHeaders(headers)).pipe(
          Effect.map(Option.fromNullOr),
        ),
    }),
  );
}
