import { Data, Effect } from "effect";
import type { GoogleAccount, GoogleLocation } from "~/types/google";
import { type GoogleUnavailable, request } from "./google-http";

export type AccountWithLocations = GoogleAccount & {
  locations: GoogleLocation[];
};

/**
 * Google answered the account walk with an error. Holds the payload rather
 * than a Response: concurrent callers share one cached lookup, and a Response
 * body can only be read once.
 */
export class LocationsApiError extends Data.TaggedError("LocationsApiError")<{
  readonly status: number;
  readonly body: Record<string, unknown>;
}> {}

interface RawLocation {
  name?: string;
  locationId?: string;
  displayName?: string;
  title?: string;
  primaryPhone?: string;
  primaryCategory?: { displayName?: string };
  websiteUrl?: string;
  storefrontAddress?: {
    addressLines?: string[];
    locality?: string;
    administrativeArea?: string;
    postalCode?: string;
    regionCode?: string;
  };
  metadata?: {
    canReview?: boolean;
    canUpdateInsights?: boolean;
  };
  locationState?: {
    isGoogleUpdated?: boolean;
    isGoogleVerified?: boolean;
  };
  locationKey?: {
    placeId?: string;
    plusPageId?: string;
  };
}

function mapLocation(raw: RawLocation): GoogleLocation {
  const addr = raw.storefrontAddress;
  const addressLine = addr?.addressLines?.join(", ") ?? "";
  const cityLocality = addr?.locality ?? "";
  const stateRegion = addr?.administrativeArea ?? "";
  const postal = addr?.postalCode ?? "";

  const parts = [addressLine, cityLocality, stateRegion, postal].filter(
    Boolean,
  );
  const fullAddress = parts.join(", ");

  return {
    name: raw.name ?? "",
    locationId: raw.locationId ?? "",
    displayName: raw.displayName ?? raw.title ?? "",
    primaryPhone: raw.primaryPhone ?? "",
    websiteUrl: raw.websiteUrl ?? "",
    category: raw.primaryCategory?.displayName ?? "",
    address: fullAddress,
    addressComponents: {
      street: addressLine,
      city: cityLocality,
      state: stateRegion,
      postalCode: postal,
    },
    placeId: raw.locationKey?.placeId ?? "",
    metadata: {
      canReview: raw.metadata?.canReview ?? false,
      canUpdateInsights: raw.metadata?.canUpdateInsights ?? false,
    },
    locationState: {
      isGoogleUpdated: raw.locationState?.isGoogleUpdated ?? false,
      isGoogleVerified: raw.locationState?.isGoogleVerified ?? false,
    },
  };
}

/** Upstream decides how long to wait, but not without a ceiling. */
const MAX_RETRY_DELAY_MS = 30_000;

/**
 * GET that waits out a 429, honouring `Retry-After` up to a ceiling. Any
 * other status, a 429 on the last attempt included, is returned as-is.
 */
const getWithQuotaRetry = Effect.fn("Google.getWithQuotaRetry")(function* (
  url: string,
  init: RequestInit,
  retries = 2,
  baseDelayMs = 1000,
) {
  for (let attempt = 0; ; attempt++) {
    const response = yield* request(url, init, { retry: true });
    if (response.status !== 429 || attempt >= retries) return response;

    const retryAfter = Number.parseInt(
      response.headers.get("Retry-After") ?? "",
      10,
    );
    // An upstream `Retry-After: 999999` would otherwise park this handler
    // for eleven days.
    const delay = Math.min(
      Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : baseDelayMs * 2 ** attempt,
      MAX_RETRY_DELAY_MS,
    );
    yield* Effect.sleep(delay);
  }
});

/**
 * One request for the account list plus one per account, against a quota a
 * Business Profile project has very little of.
 */
export const walkAccounts = Effect.fn("Google.walkAccounts")(function* (
  accessToken: string,
): Effect.fn.Return<
  AccountWithLocations[],
  GoogleUnavailable | LocationsApiError
> {
  const auth = { headers: { Authorization: `Bearer ${accessToken}` } };

  const accountsResponse = yield* getWithQuotaRetry(
    "https://mybusinessbusinessinformation.googleapis.com/v1/accounts",
    auth,
  );

  if (!accountsResponse.ok) {
    const errorData = yield* Effect.promise(() =>
      accountsResponse.json().catch(() => ({})),
    );
    const message: string =
      errorData.error?.message || accountsResponse.statusText;
    const isQuota =
      accountsResponse.status === 429 || message.includes("Quota exceeded");

    return yield* new LocationsApiError({
      status: accountsResponse.status,
      body: {
        error: "Failed to fetch accounts",
        details: message,
        ...(isQuota && {
          hint: "Google Business Profile API quota has been exceeded. Request quota increase at https://developers.google.com/my-business/content/prereqs",
        }),
      },
    });
  }

  const accountsData = yield* Effect.promise(() => accountsResponse.json());
  const accounts: GoogleAccount[] = accountsData.accounts || [];

  const all: AccountWithLocations[] = [];
  for (const account of accounts) {
    const locationsResponse = yield* getWithQuotaRetry(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
      auth,
    );
    if (locationsResponse.ok) {
      const locationsData = yield* Effect.promise(() =>
        locationsResponse.json(),
      );
      const rawLocations: RawLocation[] = locationsData.locations || [];
      all.push({ ...account, locations: rawLocations.map(mapLocation) });
    }
  }
  return all;
});
