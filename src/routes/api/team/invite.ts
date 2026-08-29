import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";
import { isValidRole } from "~/lib/roles";
import { getBusinessContext, canManageTeam } from "~/lib/business-context";
import { sendEmail } from "~/services/email";
import { renderTeamInvitationEmail } from "~/services/email-templates";
import { COMPANY_NAME } from "~/lib/constants";
import { randomBytes } from "crypto";

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getBusinessContext(session.user.id);

  if (!ctx) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  if (!canManageTeam(ctx)) {
    return Response.json({ error: "Only admins or the business owner can send invitations" }, { status: 403 });
  }

  const inviter = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { name: true, email: true },
  });

  try {
    const body = await event.request.json();
    const { email, role } = body;

    if (typeof email !== "string" || !email.trim()) {
      return Response.json({ error: "Email is required" }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return Response.json({ error: "Invalid email format" }, { status: 400 });
    }

    const roleValue = typeof role === "string" && isValidRole(role) ? role : "member";

    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail === inviter?.email?.toLowerCase()) {
      return Response.json({ error: "You cannot invite yourself" }, { status: 400 });
    }

    // Anything the accept endpoint would reject is rejected here instead, so the
    // inviter learns immediately rather than the invitee hitting a dead link.
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { businessId: true, business: { select: { id: true } } },
    });

    if (existingUser?.businessId === ctx.businessId) {
      return Response.json({ error: "User is already a team member" }, { status: 400 });
    }

    if (existingUser?.business) {
      return Response.json(
        { error: "That account already owns a business and cannot join a team" },
        { status: 400 },
      );
    }

    if (existingUser?.businessId) {
      return Response.json(
        { error: "That account is already part of another team" },
        { status: 400 },
      );
    }

    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        email: normalizedEmail,
        businessId: ctx.businessId,
        status: "pending",
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return Response.json({ error: "Invitation already sent to this email" }, { status: 400 });
    }

    const token = generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await prisma.invitation.create({
      data: {
        email: normalizedEmail,
        businessId: ctx.businessId,
        role: roleValue,
        invitedById: session.user.id,
        token,
        expiresAt,
      },
    });

    const acceptUrl = `${process.env.BETTER_AUTH_URL || "http://localhost:3000"}/accept-invite?token=${token}`;

    const { html, text } = renderTeamInvitationEmail({
      inviterName: inviter?.name || "Your team",
      companyName: COMPANY_NAME,
      acceptUrl,
      role: roleValue,
    });

    // Delivery is handled separately from creation: a provider failure used to
    // fall into the generic catch below and report "Invalid request body", while
    // leaving behind a pending row that then blocked every retry as a duplicate.
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: `You've been invited to join ${COMPANY_NAME}`,
        text,
        html,
      });
    } catch (err) {
      await prisma.invitation.delete({ where: { id: invitation.id } }).catch(() => {});
      console.error("[team/invite] delivery failed:", err);
      return Response.json(
        { error: "Couldn't send the invitation email. Please check the address and try again." },
        { status: 502 },
      );
    }

    return Response.json({
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    }, { status: 201 });
  } catch (err) {
    console.error("[team/invite] failed:", err);
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
