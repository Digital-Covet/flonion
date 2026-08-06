import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins/two-factor";
import { emailOTP } from "better-auth/plugins/email-otp";

import { prisma } from "@/db/prisma";
import { sendEmail } from "@/services/email";

import {
  renderEmailVerificationEmail,
  renderPasswordResetEmail,
  renderSignInOtpEmail,
  renderEmailVerificationOtpEmail,
  renderPasswordResetOtpEmail,
  renderTwoFactorOtpEmail,
} from "@/services/email-templates";

import { COMPANY_NAME } from "./constants";

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),

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

  plugins: [
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
});
