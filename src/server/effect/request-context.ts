import { Context } from "effect";

/**
 * What both an API route's `APIEvent` and a server function's request event
 * carry. Kept structural so either can build a `RequestContext`.
 */
export interface RequestEventLike {
  readonly request: Request;
  readonly locals: App.RequestEventLocals;
  readonly params?: Record<string, string>;
}

/** The request being handled, provided per call by `handler`/`runServerFn`. */
export class RequestContext extends Context.Service<
  RequestContext,
  {
    readonly request: Request;
    readonly url: URL;
    readonly params: Readonly<Record<string, string>>;
    /** Where middleware stashes the session; read it through the guards. */
    readonly locals: App.RequestEventLocals;
  }
>()("revme/RequestContext") {
  static fromEvent(event: RequestEventLike): RequestContext["Service"] {
    return RequestContext.of({
      request: event.request,
      url: new URL(event.request.url),
      params: event.params ?? {},
      locals: event.locals,
    });
  }
}
