import { Cause, Effect, Exit, Option } from "effect";
import { getRequestEvent } from "solid-js/web";
import { Redirect } from "./errors";
import { RequestContext } from "./request-context";
import { type AppServices, getRuntime } from "./runtime";

/*
 * Server-only. Import it from a server-only module that a `"use server"`
 * query reaches through `await import(...)`, never from a file the client
 * bundle also loads.
 */

/**
 * Runs a program for a `"use server"` query or action and returns its value.
 *
 * - A `Redirect` failure becomes the router's `redirect()` throw, so the
 *   client navigates as it did with `requireSession()`.
 * - Any other failure is re-thrown as the error itself: server functions
 *   report errors by throwing, and the query's caller already handles that.
 */
export async function runServerFn<A, E>(
  program: Effect.Effect<A, E, AppServices | RequestContext>,
): Promise<A> {
  // Read before the first `await`: the request's AsyncLocalStorage store
  // is not guaranteed to survive one.
  const event = getRequestEvent();
  if (!event) throw new Error("runServerFn called outside a request");

  const exit = await getRuntime().runPromiseExit(
    program.pipe(
      Effect.provideService(RequestContext, RequestContext.fromEvent(event)),
    ),
  );
  if (Exit.isSuccess(exit)) return exit.value;

  const error = Cause.findErrorOption(exit.cause);
  if (Option.isSome(error) && error.value instanceof Redirect) {
    const { redirect } = await import("@solidjs/router");
    const { location, status } = error.value;
    throw status
      ? redirect(location, status)
      : redirect(location, { revalidate: [] });
  }
  throw Cause.squash(exit.cause);
}
