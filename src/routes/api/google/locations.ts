import type { APIEvent } from "@solidjs/start/server";
import {
  GoogleAuthRequiredError,
  getValidAccessToken,
  isGoogleConnected,
} from "~/lib/google-tokens";
import { fetchWithTimeout } from "~/lib/http";
import { getSessionFromHeaders } from "~/lib/server-auth";
import {
  type AccountWithLocations,
  connectedCache,
  locationsCache,
} from "~/server/google-cache";
import type { GoogleAccount, GoogleLocation } from "~/types/google";

/**
 * Carries an upstream failure out of the cached walk. It holds the payload
 * rather than a Response: concurrent callers share one in-flight promise, and
 * a Response body can only be read once.
 */
class LocationsApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: Record<string, unknown>,
  ) {
    super("Google Business Profile request failed");
  }
}

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

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2,
  baseDelay = 1000,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const response = await fetchWithTimeout(url, options);

    if (response.status === 429) {
      const retryAfter = Number.parseInt(
        response.headers.get("Retry-After") ?? "",
        10,
      );
      // An upstream `Retry-After: 999999` would otherwise park this handler
      // for eleven days.
      const delay = Math.min(
        Number.isFinite(retryAfter) && retryAfter > 0
          ? retryAfter * 1000
          : baseDelay * 2 ** attempt,
        MAX_RETRY_DELAY_MS,
      );

      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }
    }

    return response;
  }

  throw new Error("Max retries exceeded");
}

/**
 * One request for the account list plus one per account, against a quota a
 * Business Profile project has very little of. Cached by `locationsCache`;
 * a throw from here is never cached, so a quota error is retried rather than
 * remembered as "no locations".
 */
async function walkAccounts(userId: string): Promise<AccountWithLocations[]> {
  const accessToken = await getValidAccessToken(userId);

  const accountsResponse = await fetchWithRetry(
    "https://mybusinessbusinessinformation.googleapis.com/v1/accounts",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!accountsResponse.ok) {
    const errorData = await accountsResponse.json().catch(() => ({}));
    const message = errorData.error?.message || accountsResponse.statusText;
    const isQuota =
      accountsResponse.status === 429 || message.includes("Quota exceeded");

    throw new LocationsApiError(accountsResponse.status, {
      error: "Failed to fetch accounts",
      details: message,
      ...(isQuota && {
        hint: "Google Business Profile API quota has been exceeded. Request quota increase at https://developers.google.com/my-business/content/prereqs",
      }),
    });
  }

  const accountsData = await accountsResponse.json();
  const accounts: GoogleAccount[] = accountsData.accounts || [];

  const allLocations: Array<GoogleAccount & { locations: GoogleLocation[] }> =
    [];

  for (const account of accounts) {
    const locationsResponse = await fetchWithRetry(
      `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );

    if (locationsResponse.ok) {
      const locationsData = await locationsResponse.json();
      const rawLocations: RawLocation[] = locationsData.locations || [];
      allLocations.push({
        ...account,
        locations: rawLocations.map(mapLocation),
      });
    }
  }

  return allLocations;
}

export async function GET(_event: APIEvent) {
  const session = await getSessionFromHeaders(_event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connected = await connectedCache.get(session.user.id, () =>
    isGoogleConnected(session.user.id),
  );
  if (!connected) {
    return Response.json(
      { error: "Not authenticated", authUrl: "/api/google/auth" },
      { status: 401 },
    );
  }

  try {
    const accounts = await locationsCache.get(session.user.id, () =>
      walkAccounts(session.user.id),
    );
    return Response.json({ accounts });
  } catch (err) {
    if (err instanceof LocationsApiError) {
      return Response.json(err.body, { status: err.status });
    }

    console.error("[google/locations] request failed:", err);

    // Only a dead grant warrants sending the owner back through OAuth. A
    // transient refresh failure must not be dressed up as "not connected".
    if (err instanceof GoogleAuthRequiredError) {
      return Response.json(
        { error: "Not authenticated", authUrl: "/api/google/auth" },
        { status: 401 },
      );
    }

    return Response.json(
      { error: "Failed to fetch locations" },
      { status: 500 },
    );
  }
}
