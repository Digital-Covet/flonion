import { Effect } from "effect";
import { clearOAuthStateCookie, consumeOAuthState } from "~/lib/oauth-state";
import { requiredEnv } from "~/server/effect/config";
import { catchAll, requireSession } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";
import { Google, request } from "~/server/effect/services/google";

/**
 * Every exit from this handler is a redirect to an allowlisted in-app path.
 * Nothing from the query string or from Google is ever reflected into a
 * response body — previously `error`, `state`, and thrown error messages were
 * interpolated into inline HTML and a `<script>` block.
 */
function redirect(path: string, params: Record<string, string> = {}): Response {
  const query = new URLSearchParams(params).toString();
  const location = query
    ? `${path}${path.includes("?") ? "&" : "?"}${query}`
    : path;

  return new Response(null, {
    status: 302,
    headers: {
      Location: location,
      "Set-Cookie": clearOAuthStateCookie(),
      "Cache-Control": "no-store",
    },
  });
}

const exchangeCode = Effect.fn("google.callback.exchangeCode")(function* (
  userId: string,
  code: string,
  returnTo: string,
) {
  const response = yield* request("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: yield* requiredEnv("GOOGLE_CLIENT_ID"),
      client_secret: yield* requiredEnv("GOOGLE_CLIENT_SECRET"),
      redirect_uri: yield* requiredEnv("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const details = yield* Effect.promise(() =>
      response.text().catch(() => ""),
    );
    console.error("[google/callback] token exchange failed:", details);
    return redirect(returnTo, { google: "exchange_failed" });
  }

  const tokenData = yield* Effect.promise(() => response.json());
  const google = yield* Google;
  yield* google.storeTokens(userId, {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: Date.now() + tokenData.expires_in * 1000,
    tokenType: tokenData.token_type,
  });

  return redirect(returnTo, { connected: "true" });
});

export const GET = handler(
  "google.callback",
  Effect.gen(function* () {
    const session = yield* requireSession();
    const { request: req, url } = yield* RequestContext;

    // Validated against the signed, HttpOnly state cookie issued by
    // /api/google/auth. A mismatch means the flow was not started by this user.
    const returnTo = consumeOAuthState(
      req.headers,
      url.searchParams.get("state"),
    );
    if (!returnTo) return redirect("/settings", { google: "invalid_state" });

    if (url.searchParams.get("error")) {
      return redirect(returnTo, { google: "denied" });
    }

    const code = url.searchParams.get("code");
    if (!code) return redirect(returnTo, { google: "missing_code" });

    return yield* exchangeCode(session.user.id, code, returnTo).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          console.error("[google/callback] unexpected failure:", cause),
        ),
      ),
      catchAll(() => Effect.succeed(redirect(returnTo, { google: "error" }))),
    );
  }),
);
