import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { onboardingCompleted: true, business: true },
  });

  const business = user?.business;

  return Response.json({
    placeId: business?.placeId ?? "",
    logo: business?.logo ?? null,
    businessName: business?.name ?? "",
    phone: business?.phone ?? "",
    address: business?.address ?? "",
    keywords: business?.keywords ?? "",
    onboardingCompleted: user?.onboardingCompleted ?? false,
  });
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await event.request.json();
    const { placeId, logo, businessName, phone, address, keywords } = body;

    if (typeof businessName !== "string" || !businessName.trim()) {
      return Response.json(
        { error: "Business name is required" },
        { status: 400 },
      );
    }

    const data = {
      placeId: typeof placeId === "string" ? placeId : null,
      logo: typeof logo === "string" ? logo : null,
      name: businessName.trim(),
      phone: typeof phone === "string" ? phone : null,
      address: typeof address === "string" ? address : null,
      keywords: typeof keywords === "string" ? keywords : null,
    };

    const [business] = await prisma.$transaction([
      prisma.business.upsert({
        where: { userId: session.user.id },
        create: { userId: session.user.id, ...data },
        update: data,
      }),
      prisma.user.update({
        where: { id: session.user.id },
        data: { onboardingCompleted: true },
      }),
    ]);

    return Response.json({
      placeId: business.placeId ?? "",
      logo: business.logo ?? null,
      businessName: business.name,
      phone: business.phone ?? "",
      address: business.address ?? "",
      keywords: business.keywords ?? "",
      onboardingCompleted: true,
    });
  } catch {
    return Response.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
