import type { APIEvent } from "@solidjs/start/server";
import { Cause, Effect, Exit, Option } from "effect";
import { type DbError, type HttpError, httpErrorToResponse } from "./errors";
import { RequestContext } from "./request-context";
import { type AppServices, getRuntime } from "./runtime";

/**
 * What a route program may fail with. Domain errors (`CashfreeFailure`,
 * Google's auth error, ...) are deliberately not in this union: each route
 * must decide which status and message they become, so the compiler flags a
 * route that forgot to.
 */
export type HandledError = HttpError | DbError;

export type RouteProgram<A, E extends HandledError> = Effect.Effect<
  A,
  E,
  AppServices | RequestContext
>;

type Runner = {
  readonly runPromiseExit: <A, E>(
    effect: Effect.Effect<A, E, AppServices>,
  ) => Promise<Exit.Exit<A, E>>;
};

/**
 * Turns a finished program into the response. A `Response` value is sent
 * as-is (redirects, custom headers); anything else is JSON. A mapped error
 * gets its status and `{ error }` body. A `DbError` or a defect is logged in
 * full and answered with a bare 500, so internals never reach the client.
 */
export function exitToResponse(
  name: string,
  exit: Exit.Exit<unknown, HandledError>,
): Response {
  if (Exit.isSuccess(exit)) {
    return exit.value instanceof Response
      ? exit.value
      : Response.json(exit.value);
  }

  const error = Cause.findErrorOption(exit.cause);
  if (Option.isSome(error) && error.value._tag !== "DbError") {
    return httpErrorToResponse(error.value);
  }

  console.error(`[api] ${name} failed\n${Cause.pretty(exit.cause)}`);
  return Response.json({ error: "Internal server error" }, { status: 500 });
}

/** `handler` against an explicit runtime; tests pass one built from fakes. */
export function makeHandler(runner: () => Runner) {
  return <A, E extends HandledError>(
    name: string,
    program: RouteProgram<A, E>,
  ) =>
    async (event: APIEvent): Promise<Response> => {
      // `event.request.signal` is deliberately not wired to interruption: a
      // client that disconnects must not cut a payment call or a write off
      // halfway, which the pre-Effect handlers never did either.
      const exit = await runner().runPromiseExit(
        program.pipe(
          Effect.withSpan(`api.${name}`),
          Effect.provideService(
            RequestContext,
            RequestContext.fromEvent(event),
          ),
        ),
      );
      return exitToResponse(name, exit);
    };
}

/**
 * Adapts a route program to a SolidStart API handler:
 *
 * ```ts
 * export const POST = handler("billing.cancel", Effect.gen(function* () { ... }));
 * ```
 */
export const handler = makeHandler(getRuntime);
