import { Context, Effect, Layer } from "effect";
import { checkRateLimit } from "~/lib/rate-limit";

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly resetAt: number;
}

export class RateLimiter extends Context.Service<
  RateLimiter,
  {
    readonly check: (
      key: string,
      max: number,
      windowMs: number,
    ) => Effect.Effect<RateLimitResult>;
  }
>()("revme/RateLimiter") {
  /**
   * Shares `checkRateLimit`'s store rather than keeping its own, so a key
   * counts the same whether the route using it has been migrated or not.
   */
  static readonly layer = Layer.succeed(
    RateLimiter,
    RateLimiter.of({
      check: (key, max, windowMs) =>
        Effect.sync(() => checkRateLimit(key, max, windowMs)),
    }),
  );
}
