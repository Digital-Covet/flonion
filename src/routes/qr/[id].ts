import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "@/db/prisma";
import { checkRateLimit, getClientIp } from "~/lib/rate-limit";

// Public, and each scan increments a counter. Capped per IP so the scan metric
// cannot be inflated at will; the redirect itself still works past the cap.
const SCAN_RATE_LIMIT = 30;
const SCAN_WINDOW_MS = 60 * 60 * 1000;

export async function GET(event: APIEvent) {
  const id = event.params.id;

  if (!id || typeof id !== "string") {
    return new Response("Not found", { status: 404 });
  }

  try {
    // Resolve the business by username first, falling back to its id for
    // businesses that have not yet claimed a username.
    const business =
      (await prisma.business.findUnique({ where: { username: id } })) ||
      (await prisma.business.findUnique({ where: { id } }));

    if (!business) {
      return new Response("Not found", { status: 404 });
    }

    const countable = checkRateLimit(
      `qr:${business.id}:${getClientIp(event.request)}`,
      SCAN_RATE_LIMIT,
      SCAN_WINDOW_MS,
    );

    if (countable.allowed) {
      await prisma.business.update({
        where: { id: business.id },
        data: { qrScanCount: { increment: 1 } },
      });
    }

    const param = business.username || business.id;

    return new Response(null, {
      status: 302,
      headers: {
        Location: `/company/${param}/review`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch {
    return new Response("Internal error", { status: 500 });
  }
}
