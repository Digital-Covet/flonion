import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "@/db/prisma";

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

    await prisma.business.update({
      where: { id: business.id },
      data: { qrScanCount: { increment: 1 } },
    });

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
