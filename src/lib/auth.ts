import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { admin } from "better-auth/plugins";
import { adminAc, userAc } from "better-auth/plugins/admin/access";
import { emailOTP } from "better-auth/plugins/email-otp";
import { twoFactor } from "better-auth/plugins/two-factor";
import { emailHarmony } from "better-auth-harmony";
import normalizeEmail from "validator/lib/normalizeEmail.js";

import { prisma } from "@/db/prisma";
import { sendEmail } from "@/services/email";

import {
  renderEmailVerificationEmail,
  renderEmailVerificationOtpEmail,
  renderPasswordResetEmail,
  renderPasswordResetOtpEmail,
  renderSignInOtpEmail,
  renderTwoFactorOtpEmail,
} from "@/services/email-templates";

import { COMPANY_NAME } from "./constants";
import { CLIENT_IP_HEADER } from "./rate-limit";
import { PLATFORM_ADMIN_ROLE } from "./roles";
import { getTrustedOrigins } from "./trusted-origins";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

  // Blocks CSRF and open redirects on the /api/auth/* routes: better-auth
  // validates request Origin and every callbackURL/redirectTo against this list.
  trustedOrigins: getTrustedOrigins(),

  user: {
    changeEmail: {
      enabled: true,
      sendChangeEmailVerification: async ({
        user,
        newEmail,
        url,
      }: {
        user: { name?: string | null; email: string };
        newEmail: string;
        url: string;
      }) => {
        const { html, text } = renderEmailVerificationEmail({
          username: user.name ?? undefined,
          email: newEmail,
          verificationUrl: url,
        });

        // Awaited deliberately: a discarded rejection here is an unhandled
        // rejection, which Node turns into process exit. Awaiting also means a
        // failed send surfaces to the caller instead of leaving the user
        // waiting for a verification email that was never delivered.
        await sendEmail({
          to: newEmail,
          subject: `Verify your new ${COMPANY_NAME} email`,
          text,
          html,
        });
      },
    },
  },

  emailAndPassword: {
    enabled: true,

    // User must verify email before they can sign in.
    requireEmailVerification: true,

    sendResetPassword: async ({ user, url }) => {
      const { html, text } = renderPasswordResetEmail({
        username: user.name ?? undefined,
        email: user.email,
        resetUrl: url,
      });

      await sendEmail({
        to: user.email,
        subject: `Reset your ${COMPANY_NAME} password`,
        text,
        html,
      });
    },
  },

  emailVerification: {
    sendOnSignUp: true,

    autoSignInAfterVerification: true,

    sendVerificationEmail: async ({ user, url }) => {
      const { html, text } = renderEmailVerificationEmail({
        username: user.name ?? undefined,
        email: user.email,
        verificationUrl: url,
      });

      await sendEmail({
        to: user.email,
        subject: `Verify your ${COMPANY_NAME} email`,
        text,
        html,
      });
    },
  },

  databaseHooks: {
    user: {
      create: {
        // Runs after emailHarmony's hook (plugin hooks run first), so
        // `normalizedEmail` is already set. Sign-up only matches the exact
        // email before creating, so an alias of an existing account
        // (`jo.hn+1@gmail.com` vs `john@gmail.com`) would reach the unique
        // index and fail with a 422, revealing the account exists. A 403 here
        // makes sign-up return its generic duplicate response instead.
        before: async (user) => {
          const { normalizedEmail } = user as { normalizedEmail?: unknown };
          if (typeof normalizedEmail !== "string") return;

          const existing = await prisma.user.findUnique({
            where: { normalizedEmail },
            select: { id: true },
          });
          if (existing) {
            throw new APIError("FORBIDDEN", {
              message: "An account already uses this email address.",
            });
          }
        },
      },
    },
  },

  plugins: [
    // Normalizes emails into User.normalizedEmail (unique) and rejects
    // malformed and disposable addresses on sign-up, sign-in, password reset,
    // OTP and change-email routes. The normalizer is the plugin's default,
    // passed explicitly so scripts/backfill-normalized-email.ts provably
    // computes the same value.
    emailHarmony({ normalizer: normalizeEmail }),

    // Team roles ("admin", "member", ...) live in the same User.role column the
    // admin plugin reads. Left at its defaults, the plugin treats a team "admin"
    // as a platform admin, which any signup can become by inviting a second
    // account. Only `platform_admin` carries plugin permissions, and no tenant
    // route can write that value (see isValidRole in roles.ts).
    admin({
      adminRoles: [PLATFORM_ADMIN_ROLE],
      roles: { [PLATFORM_ADMIN_ROLE]: adminAc, user: userAc },
    }),
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        let html: string;
        let text: string;

        switch (type) {
          case "sign-in": {
            const result = renderSignInOtpEmail({
              email,
              otp,
            });

            html = result.html;
            text = result.text;
            break;
          }

          case "email-verification": {
            const result = renderEmailVerificationOtpEmail({
              email,
              otp,
            });

            html = result.html;
            text = result.text;
            break;
          }

          case "forget-password": {
            const result = renderPasswordResetOtpEmail({
              email,
              otp,
            });

            html = result.html;
            text = result.text;
            break;
          }

          default: {
            const result = renderSignInOtpEmail({
              email,
              otp,
            });

            html = result.html;
            text = result.text;
          }
        }

        let subject: string;

        switch (type) {
          case "sign-in":
            subject = `Your ${COMPANY_NAME} sign-in code`;
            break;

          case "email-verification":
            subject = `Your ${COMPANY_NAME} verification code`;
            break;

          case "forget-password":
            subject = `Your ${COMPANY_NAME} password reset code`;
            break;

          default:
            subject = `Your ${COMPANY_NAME} verification code`;
        }

        await sendEmail({
          to: email,
          subject,
          text,
          html,
        });
      },
    }),

    /**
     * Two Factor Authentication
     */
    twoFactor({
      issuer: COMPANY_NAME,

      otpOptions: {
        sendOTP: async ({ user, otp }) => {
          const { html, text } = renderTwoFactorOtpEmail({
            username: user.name ?? undefined,
            email: user.email,
            otp,
          });

          await sendEmail({
            to: user.email,
            subject: `Your ${COMPANY_NAME} two-factor authentication code`,
            text,
            html,
          });
        },
      },
    }),
  ],

  advanced: {
    // Same header this app's own rate limiter keys on, so the two limiters
    // protecting this origin cannot disagree about who the client is. The
    // proxy must overwrite it on every inbound request.
    ipAddress: {
      ipAddressHeaders: [CLIENT_IP_HEADER],
    },
  },
});
