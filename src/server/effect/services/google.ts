import {
  Cache,
  Config,
  Context,
  Duration,
  Effect,
  Exit,
  Layer,
  Option,
  Redacted,
  Schema,
} from "effect";
import { decrypt, encrypt } from "~/lib/crypto";
import type { DbError } from "../errors";
import { Db } from "./db";
import { GoogleUnavailable, request } from "./google-http";
import {
  type AccountWithLocations,
  type LocationsApiError,
  walkAccounts,
} from "./google-locations";

export { GoogleUnavailable, request } from "./google-http";
export type { AccountWithLocations } from "./google-locations";
export { LocationsApiError } from "./google-locations";

/*
 * Server-only. Google OAuth tokens are stored per user, encrypted at rest.
 * They once lived in a client-readable cookie, and every caller passed the
 * literal user id "default"; both are fixed, and must stay fixed.
 */

/**
 * The owner's Google grant is gone: no stored tokens, or Google rejected the
 * refresh token outright. Callers prompt a reconnect. Any other failure is
 * transient and must never be reported this way.
 */
export class GoogleAuthRequired extends Schema.TaggedError<GoogleAuthRequired>()(
  "GoogleAuthRequired",
  { message: Schema.String },
) {}

export interface TokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  tokenType: string;
}

export interface MeetLink {
  meetUri: string;
  spaceId: string;
}

export interface BusinessRating {
  rating: number;
  reviewCount: number;
}

const OAuthConfig = Config.all({
  clientId: Config.String("GOOGLE_CLIENT_ID"),
  clientSecret: Config.Redacted("GOOGLE_CLIENT_SECRET"),
});

type Failure = GoogleAuthRequired | GoogleUnavailable | DbError;

export class Google extends Context.Service<
  Google,
  {
    readonly storeTokens: (
      userId: string,
      tokens: TokenSet,
    ) => Effect.Effect<void, DbError>;
    readonly clearTokens: (userId: string) => Effect.Effect<void, DbError>;
    /**
     * Whether the owner has a usable grant. Keyed on the refresh token, not
     * on `expiresAt`: access tokens expire hourly, and checking expiry once
     * showed every owner as disconnected an hour after connecting.
     */
    readonly isConnected: (userId: string) => Effect.Effect<boolean, DbError>;
    /** `isConnected`, cached 30 s and cleared whenever the grant changes. */
    readonly isConnectedCached: (
      userId: string,
    ) => Effect.Effect<boolean, DbError>;
    /** A live access token, refreshed when within a minute of expiring. */
    readonly accessToken: (userId: string) => Effect.Effect<string, Failure>;
    /**
     * Every account and its locations, cached 15 minutes per user. A failure
     * is never cached, so a quota error is retried, not remembered as empty.
     */
    readonly locations: (
      userId: string,
    ) => Effect.Effect<AccountWithLocations[], Failure | LocationsApiError>;
    /** A new Meet space, or `None` on any failure (callers degrade). */
    readonly createMeetLink: (
      userId: string,
    ) => Effect.Effect<Option.Option<MeetLink>>;
    /** The aggregate rating for a place, or `None` when it can't be read. */
    readonly businessRating: (
      userId: string,
      placeId: string,
    ) => Effect.Effect<Option.Option<BusinessRating>>;
  }
>()("revme/Google") {
  static readonly layerWithoutDependencies = Layer.effect(Google, makeGoogle());
  static readonly layer = Google.layerWithoutDependencies.pipe(
    Layer.provide(Db.layer),
  );
}

function makeGoogle() {
  return Effect.gen(function* () {
    const db = yield* Db;

    const readTokenSet = Effect.fn("Google.readTokenSet")(function* (
      userId: string,
    ) {
      const row = yield* db.use((p) =>
        p.googleToken.findUnique({ where: { userId } }),
      );
      if (!row) return Option.none<TokenSet>();

      const accessToken = decrypt(row.accessToken);
      const refreshToken = decrypt(row.refreshToken);

      // Undecryptable rows mean a rotated/incorrect key. Treat as not
      // connected, but say so loudly: silently, this is indistinguishable
      // from "never connected".
      if (!accessToken || !refreshToken) {
        console.error(
          `[google-tokens] stored tokens for user ${userId} could not be decrypted. ` +
            "TOKEN_ENCRYPTION_KEY/COOKIE_SECRET has most likely changed; this user must reconnect Google.",
        );
        return Option.none<TokenSet>();
      }

      return Option.some<TokenSet>({
        accessToken,
        refreshToken,
        expiresAt: row.expiresAt.getTime(),
        tokenType: row.tokenType,
      });
    });

    const isConnected = (userId: string) =>
      readTokenSet(userId).pipe(
        Effect.map(
          (set) => Option.isSome(set) && Boolean(set.value.refreshToken),
        ),
      );

    const connected = yield* Cache.makeWith(isConnected, {
      capacity: 500,
      timeToLive: (exit) =>
        Exit.isSuccess(exit) ? Duration.seconds(30) : Duration.zero,
    });

    // `accessToken` is defined below; the lookup only runs after it exists.
    const locations = yield* Cache.makeWith(
      (userId: string) =>
        Effect.flatMap(accessToken(userId), (token) => walkAccounts(token)),
      {
        capacity: 500,
        timeToLive: (exit) =>
          Exit.isSuccess(exit) ? Duration.minutes(15) : Duration.zero,
      },
    );

    /**
     * A fresh consent can cover a different set of Google accounts, so
     * anything resolved against the old grant is now wrong, not just stale.
     */
    const invalidate = (userId: string) =>
      Effect.all([
        Cache.invalidate(connected, userId),
        Cache.invalidate(locations, userId),
      ]).pipe(Effect.asVoid);

    const storeTokens = Effect.fn("Google.storeTokens")(function* (
      userId: string,
      tokens: TokenSet,
    ) {
      const data = {
        accessToken: encrypt(tokens.accessToken),
        refreshToken: encrypt(tokens.refreshToken),
        expiresAt: new Date(tokens.expiresAt),
        tokenType: tokens.tokenType ?? "Bearer",
      };
      yield* db.use((p) =>
        p.googleToken.upsert({
          where: { userId },
          create: { userId, ...data },
          update: data,
        }),
      );
      yield* invalidate(userId);
    });

    const clearTokens = Effect.fn("Google.clearTokens")(function* (
      userId: string,
    ) {
      yield* db.use((p) => p.googleToken.deleteMany({ where: { userId } }));
      yield* invalidate(userId);
    });

    /**
     * Google only returns a refresh token on the first consent, so the stored
     * one is kept when a refresh response omits it.
     */
    const refresh = Effect.fn("Google.refresh")(function* (
      userId: string,
      tokenSet: TokenSet,
    ) {
      const config = yield* OAuthConfig.pipe(
        Effect.mapError(
          () =>
            new GoogleUnavailable({ message: "Missing Google OAuth env vars" }),
        ),
      );

      const response = yield* request("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: config.clientId,
          client_secret: Redacted.value(config.clientSecret),
          refresh_token: tokenSet.refreshToken,
          grant_type: "refresh_token",
        }),
      });

      if (!response.ok) {
        const body = yield* Effect.promise(() =>
          response.json().catch(() => ({})),
        );

        // Only `invalid_grant` means the grant itself is dead (revoked,
        // expired, consent withdrawn). Deleting the row on any other failure
        // meant one Google 5xx or rate-limit blip disconnected the owner.
        if (body?.error === "invalid_grant") {
          yield* clearTokens(userId);
          return yield* new GoogleAuthRequired({
            message: "Google refresh token was rejected",
          });
        }

        console.error(
          "[google-tokens] refresh failed (tokens kept):",
          response.status,
          body?.error ?? response.statusText,
        );
        return yield* new GoogleUnavailable({
          message: "Failed to refresh access token",
        });
      }

      const data = yield* Effect.tryPromise({
        try: () => response.json(),
        catch: (cause) =>
          new GoogleUnavailable({ message: "Bad token response", cause }),
      });
      const updated: TokenSet = {
        ...tokenSet,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? tokenSet.refreshToken,
        expiresAt: Date.now() + data.expires_in * 1000,
      };

      yield* storeTokens(userId, updated);
      return updated.accessToken;
    });

    function accessToken(userId: string): Effect.Effect<string, Failure> {
      return Effect.gen(function* () {
        const tokenSet = yield* readTokenSet(userId);
        if (Option.isNone(tokenSet)) {
          return yield* new GoogleAuthRequired({
            message: "Not authenticated with Google",
          });
        }
        if (Date.now() < tokenSet.value.expiresAt - 60_000) {
          return tokenSet.value.accessToken;
        }
        return yield* refresh(userId, tokenSet.value);
      });
    }

    /**
     * Resolves `accounts/{account}/locations/{location}` for a place id: the
     * reviews endpoint is keyed by account + location, but a business only
     * stores its place id.
     */
    const findLocationParent = Effect.fn("Google.findLocationParent")(
      function* (token: string, placeId: string) {
        const auth = { headers: { Authorization: `Bearer ${token}` } };
        const accountsResponse = yield* request(
          "https://mybusinessbusinessinformation.googleapis.com/v1/accounts",
          auth,
          { retry: true },
        );
        if (!accountsResponse.ok) return Option.none<string>();

        const accountsData: { accounts?: Array<{ name?: string }> } =
          yield* Effect.promise(() => accountsResponse.json());

        for (const account of accountsData.accounts ?? []) {
          if (!account.name) continue;
          const locationsResponse = yield* request(
            `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
            auth,
            { retry: true },
          );
          if (!locationsResponse.ok) continue;

          const locationsData: {
            locations?: Array<{
              name?: string;
              locationKey?: { placeId?: string };
            }>;
          } = yield* Effect.promise(() => locationsResponse.json());

          const match = locationsData.locations?.find(
            (loc) => loc.locationKey?.placeId === placeId,
          );
          // `name` comes back as "locations/{id}"; the v4 reviews path wants
          // it nested under the account.
          if (match?.name) {
            const locationId = match.name.split("/").pop();
            if (locationId) {
              return Option.some(`${account.name}/locations/${locationId}`);
            }
          }
        }
        return Option.none<string>();
      },
    );

    return Google.of({
      storeTokens,
      clearTokens,
      isConnected,
      isConnectedCached: (userId) => Cache.get(connected, userId),
      accessToken,
      locations: (userId) => Cache.get(locations, userId),

      createMeetLink: (userId) =>
        Effect.gen(function* () {
          if (!(yield* isConnected(userId))) return Option.none<MeetLink>();
          const token = yield* accessToken(userId);

          const response = yield* request(
            "https://meet.googleapis.com/v2/spaces",
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${token}`,
                "Content-Type": "application/json",
              },
            },
          );

          if (!response.ok) {
            const body = yield* Effect.promise(() =>
              response.text().catch(() => ""),
            );
            console.error(
              "[google-meet] createSpace failed:",
              response.status,
              body,
            );
            return Option.none<MeetLink>();
          }

          const data: { name?: string; meetingUri?: string } =
            yield* Effect.promise(() => response.json());
          if (!data.meetingUri || !data.name) {
            console.error("[google-meet] unexpected response:", data);
            return Option.none<MeetLink>();
          }

          // `name` is "spaces/{spaceId}".
          const spaceId = data.name.split("/").pop() ?? "";
          return Option.some({ meetUri: data.meetingUri, spaceId });
        }).pipe(
          Effect.catchCause((cause) =>
            Effect.sync(() => {
              console.error("[google-meet] createMeetLink error:", cause);
              return Option.none<MeetLink>();
            }),
          ),
          Effect.withSpan("Google.createMeetLink"),
        ),

      businessRating: (userId, placeId) =>
        Effect.gen(function* () {
          if (!placeId) return Option.none<BusinessRating>();
          if (!(yield* isConnected(userId))) {
            return Option.none<BusinessRating>();
          }

          const token = yield* accessToken(userId);
          const parent = yield* findLocationParent(token, placeId);
          if (Option.isNone(parent)) return Option.none<BusinessRating>();

          const response = yield* request(
            `https://mybusiness.googleapis.com/v4/${parent.value}/reviews?pageSize=1`,
            { headers: { Authorization: `Bearer ${token}` } },
            { retry: true },
          );
          if (!response.ok) return Option.none<BusinessRating>();

          const data: { averageRating?: number; totalReviewCount?: number } =
            yield* Effect.promise(() => response.json());
          if (typeof data.averageRating !== "number") {
            return Option.none<BusinessRating>();
          }
          return Option.some({
            rating: data.averageRating,
            reviewCount: data.totalReviewCount ?? 0,
          });
        }).pipe(
          Effect.catchCause((cause) =>
            Effect.sync(() => {
              console.error("[google-business-rating] lookup failed:", cause);
              return Option.none<BusinessRating>();
            }),
          ),
          Effect.withSpan("Google.businessRating"),
        ),
    });
  });
}
