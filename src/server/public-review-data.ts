import { Effect } from "effect";
import { REVIEW_PLATFORMS } from "~/features/settings/review-platforms";
import type { PublicPlatform, PublicReview } from "~/lib/public-review";
import { httpUrl } from "~/lib/safe-url";
import { Redirect } from "~/server/effect/errors";
import { runServerFn } from "~/server/effect/server-fn";
import { Db } from "~/server/effect/services/db";

/*
 * Server-only bodies of the public review queries in `~/lib/public-review`.
 */

/** `username` is stored lowercase; the composer falls back to the business id. */
const PARAM_PATTERN = /^[\w.-]{1,64}$/;

const businessSelect = {
  id: true,
  name: true,
  logo: true,
  rating: true,
  reviewCount: true,
  reviewLinks: true,
  reviewLink: true,
  placeId: true,
  keywords: true,
} as const;

/**
 * Platforms in the settings order, with only http(s) links. Businesses set up
 * before `reviewLinks` existed have a single `reviewLink`, treated as Google.
 */
function platformsFrom(business: {
  reviewLinks: unknown;
  reviewLink: string | null;
  placeId: string | null;
}): PublicPlatform[] {
  const map =
    business.reviewLinks &&
    typeof business.reviewLinks === "object" &&
    !Array.isArray(business.reviewLinks)
      ? (business.reviewLinks as Record<string, unknown>)
      : {};

  const platforms: PublicPlatform[] = [];
  for (const p of REVIEW_PLATFORMS) {
    const url = httpUrl(map[p.slug]);
    if (url) platforms.push({ slug: p.slug, label: p.label, url });
  }

  if (platforms.length === 0) {
    const fallback =
      httpUrl(business.reviewLink) ??
      (business.placeId
        ? `https://search.google.com/local/writereview?placeid=${encodeURIComponent(business.placeId)}`
        : null);
    if (fallback) {
      platforms.push({ slug: "google", label: "Google", url: fallback });
    }
  }

  return platforms;
}

export function loadCompanyReview(param: string): Promise<PublicReview> {
  return runServerFn(
    Effect.gen(function* () {
      if (!PARAM_PATTERN.test(param)) return { kind: "inactive" } as const;

      // The composer links by username when there is one and by id otherwise.
      // A suspended business collects no reviews, so its link reads as
      // inactive.
      const db = yield* Db;
      const business =
        (yield* db.use((p) =>
          p.business.findUnique({
            where: { username: param.toLowerCase(), status: "active" },
            select: businessSelect,
          }),
        )) ??
        (yield* db.use((p) =>
          p.business.findUnique({
            where: { id: param, status: "active" },
            select: businessSelect,
          }),
        ));

      if (!business) return { kind: "inactive" } as const;

      return {
        kind: "active",
        business: {
          id: business.id,
          name: business.name,
          logo: business.logo || null,
          rating: business.rating,
          reviewCount: business.reviewCount,
          keywords: business.keywords || null,
          platforms: platformsFrom(business),
        },
      } as const;
    }),
  );
}

/**
 * A 301 to the company page for a live request; `null` when the id resolves
 * to no active business, which the route renders as an inactive link.
 */
export function loadLegacyReviewTarget(id: string): Promise<null> {
  return runServerFn(
    Effect.gen(function* () {
      if (!PARAM_PATTERN.test(id)) return null;

      const db = yield* Db;
      const row = yield* db.use((p) =>
        p.sharedReview.findUnique({
          where: { id },
          select: {
            status: true,
            business: { select: { id: true, username: true, status: true } },
            user: {
              select: {
                business: {
                  select: { id: true, username: true, status: true },
                },
              },
            },
          },
        }),
      );

      // A request an operator hid or flagged is inactive, the same rule the
      // QR redirect applies, and so is any request of a suspended business.
      if (!row || row.status !== "visible") return null;
      const business = row.business ?? row.user.business ?? null;
      if (!business || business.status !== "active") return null;

      return yield* new Redirect({
        location: `/company/${business.username ?? business.id}/review`,
        status: 301,
      });
    }),
  );
}
