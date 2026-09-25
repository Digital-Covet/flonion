import { Effect } from "effect";
import { createOAuthState } from "~/lib/oauth-state";
import { requiredEnv } from "~/server/effect/config";
import { requireSession } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";

const SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/meetings.space.created",
];

export const GET = handler(
  "google.auth",
  Effect.gen(function* () {
    yield* requireSession();

    const clientId = yield* requiredEnv("GOOGLE_CLIENT_ID");
    const redirectUri = yield* requiredEnv("GOOGLE_REDIRECT_URI");

    const { url } = yield* RequestContext;
    const { state, cookie } = createOAuthState(
      url.searchParams.get("returnTo") ?? "",
    );

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      prompt: "consent",
      state,
    });

    return new Response(null, {
      status: 302,
      headers: {
        Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        "Set-Cookie": cookie,
      },
    });
  }),
);
