import { createHmac } from "node:crypto";
import type { Route } from "./+types/impersonate";
import { requireOperator, randomToken } from "~/prisma/operator";
import { db } from "~/prisma/db";
import { recordAudit } from "~/prisma/audit";
import { redirect } from "react-router";

/**
 * Impersonation handoff route.
 *
 * Mints a short-lived capability token and redirects the operator to the
 * tenant app, which validates it and creates the session itself (see
 * src/routes/api/operator/impersonate.ts).
 *
 * Guardrails:
 * - POST only (a link in email cannot trigger it)
 * - 60-second token TTL
 * - Single-use nonce, stored in the Verification table bound to the target
 *   user id and consumed atomically by the tenant
 * - The operator id travels inside the signed payload, so the tenant can
 *   record it on Session.impersonatedBy
 * - One audit row desk-side, written in the same transaction as the nonce
 */
export async function action({ request }: Route.ActionArgs) {
  const operator = await requireOperator(request);

  // The user detail page submits a plain form; accept JSON for scripted calls.
  const userId = request.headers
    .get("Content-Type")
    ?.includes("application/json")
    ? (await request.json()).userId
    : (await request.formData()).get("userId");
  if (typeof userId !== "string" || !userId || userId.includes(".")) {
    return Response.json({ error: "Missing userId" }, { status: 400 });
  }

  // Verify the target user exists
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const tenantUrl = process.env.TENANT_APP_URL;
  const handoffSecret = process.env.OPERATOR_HANDOFF_SECRET;
  if (!tenantUrl || !handoffSecret) {
    return Response.json({ error: "Impersonation not configured" }, { status: 500 });
  }

  // Mint a one-shot token: random nonce + HMAC signature. Operator ids and
  // nonces cannot contain ".", so the payload splits unambiguously.
  const nonce = randomToken(16);
  const expiresAt = Date.now() + 60_000; // 60 seconds
  const payload = `${userId}.${operator.id}.${expiresAt}.${nonce}`;

  // Sign with the handoff secret (separate from the operator cookie)
  const signature = createHmac("sha256", handoffSecret).update(payload).digest("hex");

  await db.$transaction(async (tx) => {
    // One-shot store better-auth cleans up. The value binds the nonce to the
    // target user, so a nonce cannot be replayed against someone else.
    await tx.verification.create({
      data: {
        identifier: `impersonate:${nonce}`,
        value: userId,
        expiresAt: new Date(expiresAt),
      },
    });

    await recordAudit(operator, {
      action: "user.impersonate",
      entity: "user",
      entityId: userId,
      note: `Impersonating ${user.email}`,
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
    }, tx);
  });

  // Redirect to tenant app with the handoff token
  const handoffUrl = new URL("/api/operator/impersonate", tenantUrl);
  handoffUrl.searchParams.set("token", payload);
  handoffUrl.searchParams.set("sig", signature);

  return redirect(handoffUrl.toString());
}
