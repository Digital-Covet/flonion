import type { APIEvent } from "@solidjs/start/server";
import { Effect, Layer, ManagedRuntime, Option } from "effect";
import { type AppSession, Auth } from "./services/auth";
import { Billing } from "./services/billing";
import { Db, type DbClient, toDbError } from "./services/db";
import { Google } from "./services/google";
import { LlmError, LlmModel } from "./services/llm";
import { MailError, Mailer } from "./services/mailer";
import { RateLimiter } from "./services/rate-limiter";

/*
 * Test-only helpers. A test mocks `~/server/effect/runtime` to return
 * `testRuntime.current`, then builds that runtime from these fakes.
 */

export const testRuntime: {
  current: ManagedRuntime.ManagedRuntime<unknown, never> | undefined;
} = { current: undefined };

/** A `Db` whose client is whatever partial Prisma shape the test supplies. */
export function fakeDb(client: Partial<Record<keyof DbClient, unknown>>) {
  const use = <A>(f: (c: DbClient) => Promise<A>) =>
    Effect.tryPromise({
      try: () => f(client as DbClient),
      catch: toDbError,
    });
  const self: Db["Service"] = Db.of({
    use,
    transaction: (program) => Effect.provideService(program, Db, self),
  });
  return Layer.succeed(Db, self);
}

export function fakeAuth(session: AppSession | null) {
  return Layer.succeed(
    Auth,
    Auth.of({ getSession: () => Effect.succeed(Option.fromNullOr(session)) }),
  );
}

export function fakeGoogle(impl: Partial<Google["Service"]>) {
  return Layer.succeed(Google, impl as Google["Service"]);
}

export function fakeBilling(impl: Partial<Billing["Service"]>) {
  return Layer.succeed(Billing, impl as Billing["Service"]);
}

/** A `Mailer` that records what it was asked to send. */
export function fakeMailer(fail = false) {
  const sent: Array<{ to: string; subject: string }> = [];
  const layer = Layer.succeed(
    Mailer,
    Mailer.of({
      send: (options) =>
        Effect.suspend(() => {
          sent.push({ to: options.to, subject: options.subject });
          return fail
            ? Effect.fail(new MailError({ message: "mail down" }))
            : Effect.void;
        }),
    }),
  );
  return { layer, sent };
}

/** An `LlmModel` that answers each call with the next canned text. */
export function fakeLlm(answers: Array<string | Error>) {
  const queue = [...answers];
  return Layer.succeed(
    LlmModel,
    LlmModel.of({
      complete: () =>
        Effect.suspend(() => {
          const next = queue.shift();
          if (next === undefined || next instanceof Error) {
            return Effect.fail(
              new LlmError({ message: String(next ?? "no answer queued") }),
            );
          }
          return Effect.succeed({
            text: next,
            usage: { promptTokens: 10, completionTokens: 5, model: "test" },
          });
        }),
    }),
  );
}

export function useRuntime(
  layers: {
    db?: Layer.Layer<Db>;
    auth?: Layer.Layer<Auth>;
    billing?: Layer.Layer<Billing>;
    google?: Layer.Layer<Google>;
    mailer?: Layer.Layer<Mailer>;
    llm?: Layer.Layer<LlmModel>;
  } = {},
) {
  testRuntime.current = ManagedRuntime.make(
    Layer.mergeAll(
      layers.db ?? fakeDb({}),
      layers.auth ?? fakeAuth(null),
      layers.billing ?? fakeBilling({}),
      layers.google ?? fakeGoogle({}),
      layers.mailer ?? fakeMailer().layer,
      layers.llm ?? fakeLlm([]),
      RateLimiter.layer,
    ),
  ) as ManagedRuntime.ManagedRuntime<unknown, never>;
}

export function fakeEvent(
  init: {
    method?: string;
    body?: unknown;
    rawBody?: string;
    url?: string;
  } = {},
): APIEvent {
  const request = new Request(init.url ?? "http://localhost/api/test", {
    method: init.method ?? "POST",
    body:
      init.rawBody ??
      (init.body === undefined ? undefined : JSON.stringify(init.body)),
    headers: { "content-type": "application/json", "x-real-ip": "203.0.113.1" },
  });
  return { request, params: {}, locals: {} } as unknown as APIEvent;
}

export function fakeSession(userId = "user_1"): AppSession {
  return {
    user: { id: userId, name: "Test User", email: `${userId}@example.com` },
    session: {},
  } as unknown as AppSession;
}
