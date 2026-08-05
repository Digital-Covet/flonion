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
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      const { html, text } = renderPasswordResetEmail({
        username: user.name ?? undefined,
        email: user.email,
        resetUrl: url,
      });
      await sendEmail({
        to: user.email,
        subject: "Reset your " + COMPANY_NAME + " password",
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
        subject: "Verify your " + COMPANY_NAME + " email",
        text,
        html,
      });
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          return { data: { ...user, emailVerified: false } };
        },
      },
    },
  },
  plugins: [
    emailOTP({
      async sendVerificationOTP({ email, otp, type }) {
        let html: string;
        let text: string;

        if (type === "sign-in") {
          const res = renderSignInOtpEmail({ email, otp });
          html = res.html;
          text = res.text;
        } else if (type === "email-verification") {
          const res = renderEmailVerificationOtpEmail({ email, otp });
          html = res.html;
          text = res.text;
        } else if (type === "forget-password") {
          const res = renderPasswordResetOtpEmail({ email, otp });
          html = res.html;
          text = res.text;
        } else {
          // Safe fallback
          const res = renderSignInOtpEmail({ email, otp });
          html = res.html;
          text = res.text;
        }

        let subject = "Your " + COMPANY_NAME + " verification code";

        if (type === "sign-in") {
          subject = "Your " + COMPANY_NAME + " sign-in code";
        } else if (type === "email-verification") {
          subject = "Your " + COMPANY_NAME + " verification code";
        } else if (type === "forget-password") {
          subject = "Your " + COMPANY_NAME + " password reset code";
        }

        await sendEmail({
          to: email,
          subject,
          text,
          html,
        });
      }
    }),
    twoFactor({
      issuer: "Flonion",
      otpOptions: {
        sendOTP: async ({ user, otp }) => {
          const { html, text } = renderTwoFactorOtpEmail({
            username: user.name ?? undefined,
            email: user.email,
            otp,
          });
          await sendEmail({
            to: user.email,
            subject: "Your " + COMPANY_NAME + " two-factor authentication code",
            text,
            html,
          });
        },
      },
    }),
  ],
});
