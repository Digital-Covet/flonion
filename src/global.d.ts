/// <reference types="@solidjs/start/env" />

/** Set by `src/middleware.ts` so its rejection guard registers only once. */
declare var __revmeRejectionGuard: boolean | undefined;

declare namespace Env {
  interface Env {
    GOOGLE_CLIENT_ID: string;
    GOOGLE_CLIENT_SECRET: string;
    GOOGLE_REDIRECT_URI: string;
    DEEPSEEK_API_KEY: string;
  }
}

declare namespace App {
  /**
   * What `src/middleware.ts` stashes on the request for server functions to
   * read. `@solidjs/start` declares this interface with an `any` index
   * signature, so these fields buy inference but no typo safety: read them
   * only through `currentSession` in `src/server/effect/guards.ts`.
   */
  interface RequestEventLocals {
    /** `undefined` means middleware never ran for this path; `null` means it ran and found no session. */
    session?: Awaited<
      ReturnType<typeof import("~/lib/server-auth").getSessionFromHeaders>
    >;
    onboardingCompleted?: boolean;
  }
}
