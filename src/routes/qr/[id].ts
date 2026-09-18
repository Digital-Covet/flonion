import { randomUUID } from "node:crypto";
import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "@/db/prisma";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";

/**
 * QR redirect: the address printed on counter stands, table tents and the QR
 * ticket sheet. It counts the scan and sends the customer to the page they came
 * for, so nothing renders here unless the code cannot be resolved.
 *
 * Kept as an API route rather than a page: a scan arrives on mobile data and
 * the only useful outcome is a `Location` header, so there is no client bundle,
 * no hydration and no render before the browser moves on.
 *
 * Two kinds of code are printed, and the id tells them apart:
 *   - a review request from the composer  -> `/review/:id`
 *   - a business's standing code          -> `/company/:username/review`
 */

/** Same shape the public review page accepts, so a mistyped id never reaches the DB. */
const ID_PATTERN = /^[\w-]{1,64}$/;

// A scan is one person standing at a counter. The redirect is never withheld;
// only the counting is, so a single caller cannot inflate a business's KPI by
// reloading the code. Keyed per code as well as per address: a whole venue can
// share one wifi address, and their scans should still be counted.
const SCAN_LIMIT = 60;
const SCAN_WINDOW_MS = 60 * 60 * 1000;

/**
 * Chat apps fetch a URL to build a preview when an owner pastes their QR link
 * into a message. Those fetches are not customers: they follow the redirect
 * like anyone else, but they are not counted.
 */
const PREVIEW_FETCHER =
  /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slackbot|telegram|discord|twitterbot|linkedinbot|redditbot|embedly|skypeuripreview|bingpreview|w3c_validator/i;

type Target =
  | { kind: "review"; id: string; destination: string }
  | { kind: "business"; id: string; destination: string }
  | { kind: "inactive"; businessName: string | null };

/**
 * A review request first, then a business code. Mirrors `getPublicReview`: a
 * request that exists but is hidden or flagged is inactive, and the business is
 * named so the customer knows who to ask.
 */
async function resolveTarget(id: string): Promise<Target> {
  if (!ID_PATTERN.test(id)) return { kind: "inactive", businessName: null };

  const review = await prisma.sharedReview.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      business: { select: { name: true } },
      user: { select: { business: { select: { name: true } } } },
    },
  });

  if (review) {
    const business = review.business ?? review.user.business ?? null;
    if (!business) return { kind: "inactive", businessName: null };
    if (review.status !== "visible") {
      return { kind: "inactive", businessName: business.name };
    }
    return {
      kind: "review",
      id: review.id,
      destination: `/review/${encodeURIComponent(review.id)}`,
    };
  }

  // A business's own code, printed once and never reissued. Businesses that
  // have not claimed a username yet are reachable by id.
  const business = await prisma.business.findFirst({
    where: { OR: [{ username: id }, { id }] },
    select: { id: true, name: true, username: true },
  });

  if (!business) return { kind: "inactive", businessName: null };

  return {
    kind: "business",
    id: business.id,
    destination: `/company/${encodeURIComponent(business.username || business.id)}/review`,
  };
}

/**
 * One statement, so two people scanning the same stand at once cannot overwrite
 * each other's increment the way a read-modify-write would.
 */
async function countScan(target: Target): Promise<void> {
  if (target.kind === "business") {
    await prisma.business.update({
      where: { id: target.id },
      data: { qrScanCount: { increment: 1 } },
    });
    return;
  }
  if (target.kind !== "review") return;

  await prisma.$executeRaw`
    INSERT INTO review_analytics
      (id, "reviewId", "visitCount", "reviewCount", "qrScanCount", "redirectCount", "aiCopyCount", "platformRedirects", "createdAt", "updatedAt")
    VALUES
      (${randomUUID()}, ${target.id}, 0, 0, 1, 0, 0, '{}'::jsonb, now(), now())
    ON CONFLICT ("reviewId") DO UPDATE SET
      "qrScanCount" = review_analytics."qrScanCount" + 1,
      "updatedAt" = now()
  `;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Standalone page: reaching for the app shell would mean booting the router for
 * a dead end. Tokens are copied from `app.css`; the type falls back to the
 * system stack because the self-hosted Jost and Rubik files are build-hashed.
 */
const FALLBACK_STYLES = `
:root{--background:#faf8f5;--surface:#ffffff;--primary:#5b21b6;--text:#1c1917;--text-muted:#57534e;--border:#d6d3d1;--motif:#5b21b624}
@media (prefers-color-scheme:dark){:root{--background:#120f17;--surface:#1c1822;--primary:#c4b5fd;--text:#eeeaf2;--text-muted:#a8a1b3;--border:#3a3444;--motif:#c4b5fd24}}
*{box-sizing:border-box}
body{margin:0;min-height:100dvh;display:flex;flex-direction:column;background:var(--background);color:var(--text);font-family:ui-sans-serif,system-ui,sans-serif;font-size:16px;line-height:1.6;-webkit-text-size-adjust:100%}
main{flex:1;display:flex;align-items:center;justify-content:center;padding:32px 16px}
.card{width:100%;max-width:480px;padding:28px 20px;text-align:center;background:var(--surface);border:1px solid var(--border);border-radius:14px;box-shadow:0 12px 32px rgb(0 0 0/.06)}
.mark{position:relative;display:grid;place-items:center;width:96px;height:96px;margin:0 auto 12px}
.mark svg{grid-area:1/1}
.rings{width:96px;height:96px;color:var(--motif)}
.glyph{width:32px;height:32px;color:var(--primary)}
h1{margin:0 0 8px;font-size:1.563rem;line-height:1.3;font-weight:600;text-wrap:balance}
p{margin:0 auto;max-width:36ch;color:var(--text-muted);text-wrap:pretty}
.ref{margin-top:12px;font-family:ui-monospace,monospace;font-size:.8rem}
footer{display:flex;justify-content:center;padding:0 16px 24px}
footer a{display:inline-flex;align-items:center;min-height:44px;padding:0 8px;border-radius:6px;font-size:.8rem;color:var(--text-muted);text-decoration:none}
footer a:hover{color:var(--text)}
footer a:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
`.trim();

/** Onion Rings motif at the empty-state size: three rings, radius +12px each. */
const RINGS_SVG = `<svg class="rings" viewBox="0 0 560 560" fill="none" aria-hidden="true">
<rect x="106" y="106" width="348" height="348" rx="12" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
<rect x="54" y="54" width="452" height="452" rx="24" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
<rect x="2" y="2" width="556" height="556" rx="36" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"/>
</svg>`;

/** Tabler `qrcode-off`: names the object that failed, not just "a link". */
const GLYPH_SVG = `<svg class="glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
<path d="M8 4h1a1 1 0 0 1 1 1v1m-.297 3.711a1 1 0 0 1 -.703 .289h-4a1 1 0 0 1 -1 -1v-4c0 -.275 .11 -.524 .29 -.705"/>
<path d="M7 17v.01"/>
<path d="M14 5a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4"/>
<path d="M7 7v.01"/>
<path d="M4 15a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v4a1 1 0 0 1 -1 1h-4a1 1 0 0 1 -1 -1l0 -4"/>
<path d="M17 7v.01"/>
<path d="M20 14v.01"/>
<path d="M14 14v3"/>
<path d="M14 20h3"/>
<path d="M3 3l18 18"/>
</svg>`;

function qrPage(input: {
  status: number;
  title: string;
  heading: string;
  body: string;
  reference?: string;
}): Response {
  return new Response(
    `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(input.title)} &middot; Flonion</title>
<style>${FALLBACK_STYLES}</style>
</head>
<body>
<main>
<section class="card" aria-labelledby="qr-heading">
<span class="mark">${RINGS_SVG}${GLYPH_SVG}</span>
<h1 id="qr-heading">${input.heading}</h1>
<p>${input.body}</p>
${input.reference ? `<p class="ref">Reference: ${escapeHtml(input.reference)}</p>` : ""}
</section>
</main>
<footer><a href="/">Powered by Flonion</a></footer>
</body>
</html>`,
    {
      status: input.status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    },
  );
}

/**
 * The spec's one piece of UI on this route: a bare 404 leaves someone holding a
 * phone in a shop with nothing to act on, so name what happened and who to ask.
 */
function inactivePage(businessName: string | null): Response {
  return qrPage({
    status: 404,
    title: "QR code not active",
    heading: "This QR code isn&#039;t active",
    body: businessName
      ? `${escapeHtml(businessName)} has switched this code off. Ask them for their current review link if you&#039;d like to leave a review.`
      : "This code may have been replaced or switched off. Ask the business for their current review link.",
  });
}

/** A scan that fails on our side is not the customer's fault, and not a 404. */
function errorPage(reference: string): Response {
  return qrPage({
    status: 503,
    title: "QR code couldn't be opened",
    heading: "We couldn&#039;t open this code",
    body: "Something went wrong on our side. Scan again in a moment, or ask the business for their review link.",
    reference,
  });
}

async function handleScan(event: APIEvent, count: boolean): Promise<Response> {
  try {
    const target = await resolveTarget(String(event.params.id ?? ""));
    if (target.kind === "inactive") return inactivePage(target.businessName);

    const userAgent = event.request.headers.get("user-agent") ?? "";
    if (count && !PREVIEW_FETCHER.test(userAgent)) {
      const limit = checkRateLimit(
        `qr:${target.id}:${getClientIp(event.request)}`,
        SCAN_LIMIT,
        SCAN_WINDOW_MS,
      );
      if (limit.allowed) {
        // A counter that fails is worth less than a customer who gets through.
        try {
          await countScan(target);
        } catch (error) {
          console.error("[qr/redirect] count failed:", error);
        }
      }
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: target.destination,
        // 302 and no-store together: a redirect cached by the browser or an
        // intermediary would stop every later scan of the same printed code
        // from ever being counted.
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex",
      },
    });
  } catch (error) {
    const reference = randomUUID();
    console.error(`[qr/redirect] ${reference}:`, error);
    return errorPage(reference);
  }
}

export async function GET(event: APIEvent) {
  return handleScan(event, true);
}

/** Preflight fetches (link previews, uptime checks) get the destination, not a scan. */
export async function HEAD(event: APIEvent) {
  return handleScan(event, false);
}
