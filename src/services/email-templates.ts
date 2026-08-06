import { COMPANY_NAME, SUPPORT_EMAIL } from "@/lib/constants";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeHtmlAttr(str: string): string {
  return str.replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function getDisplayName(username?: string, email?: string): string {
  if (username && username.trim()) return username.trim();
  if (email && email.trim()) return email.trim().split("@")[0];
  return "there";
}

function renderFooter(): string {
  return `
    <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E5E5E5;">
      <p style="margin: 0; font-size: 13px; color: #777; line-height: 1.5;">
        ${COMPANY_NAME} &mdash; Helping local businesses grow with reviews and AI marketing.<br>
        Need help? Contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#0060ff;text-decoration:none;">${SUPPORT_EMAIL}</a>
      </p>
      <p style="margin: 8px 0 0; font-size: 12px; color: #999;">
        You received this because it relates to your ${COMPANY_NAME} account.
      </p>
    </div>`;
}

function renderButton(url: string, label: string): string {
  const safeUrl = escapeHtmlAttr(url);
  return `<a href="${safeUrl}" style="color: #fff; text-decoration: none; background-color: #0060ff; display: inline-block; padding: 12px 24px; border-radius: 6px; font-weight: bold; font-size: 16px;">${escapeHtml(label)}</a>`;
}

function renderBaseHtml(title: string, bodyHtml: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f7f9;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f6f7f9;">
    <tr>
      <td align="center" style="padding: 24px 0;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;width:100%;box-sizing:border-box;background:#fff;border:1px solid #E5E5E5;border-radius:8px;overflow:hidden;font-family: Lato, Helvetica, 'Helvetica Neue', Arial, sans-serif;">
          <tr>
            <td style="padding: 32px;">
              <h1 style="margin:0 0 24px;font-size:22px;color:#111;text-align:center;">${escapeHtml(title)}</h1>
              ${bodyHtml}
              ${renderFooter()}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderOtpBlock(otp: string): string {
  return `
    <div style="margin: 24px 0; padding: 20px; background-color: #f0f5ff; border-left: 4px solid #0060ff; border-radius: 6px; text-align: center;">
      <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #0060ff;">${escapeHtml(otp)}</div>
      <div style="font-size: 13px; color: #555; margin-top: 6px;">Use this code to proceed. Do not share it with anyone.</div>
    </div>`;
}

/* ---------------- Existing exports ---------------- */

interface InviteEmailParams {
  username: string;
  inviteUrl: string;
}

export function renderInviteEmail({ username, inviteUrl }: InviteEmailParams): { html: string; text: string } {
  const safeUsername = escapeHtml(username);
  const safeUrl = escapeHtmlAttr(inviteUrl);
  const htmlBody = `
    <p style="line-height:1.6; margin:0 0 16px;">Hello ${safeUsername},</p>
    <p style="line-height:1.6; margin:0 0 24px;">You have been invited to join <strong>${COMPANY_NAME}</strong>. Click below to set up your account.</p>
    <p style="margin: 24px 0; text-align:center;">${renderButton(inviteUrl, "Set Up Your Account")}</p>
    <p style="line-height:1.6; font-size:13px; color:#555;">If the button does not work, copy and paste this link into your browser:<br><a href="${safeUrl}" style="color:#0060ff;text-decoration:none;">${safeUrl}</a></p>
    <p style="line-height:1.6; margin:24px 0 0;">If you did not request this invite, you can safely ignore this email or contact support at <a href="mailto:${SUPPORT_EMAIL}" style="color:#0060ff;text-decoration:none;">${SUPPORT_EMAIL}</a>.</p>
  `;
  const textBody = `Hello ${username},\n\nYou have been invited to join ${COMPANY_NAME}. Set up your account here:\n${inviteUrl}\n\nIf the link does not work, copy and paste it into your browser.\n\nIf you did not request this invite, you can safely ignore this email or contact support at ${SUPPORT_EMAIL}.`;
  return { html: renderBaseHtml("You're invited to " + COMPANY_NAME, htmlBody), text: textBody };
}

interface DeleteVerificationEmailParams {
  username: string;
  otp: string;
  expiresInMinutes?: number;
}

export function renderDeleteVerificationEmail({ username, otp, expiresInMinutes }: DeleteVerificationEmailParams): { html: string; text: string } {
  const safeUsername = escapeHtml(username);
  const safeOtp = escapeHtml(otp);
  const expiryText = typeof expiresInMinutes === "number" ? `This code expires in ${expiresInMinutes} minutes.` : "This code expires shortly.";
  const htmlBody = `
    <p style="line-height:1.6; margin:0 0 16px;">Hello ${safeUsername},</p>
    <p style="line-height:1.6; margin:0 0 24px;">You are performing a sensitive action. Confirm your identity using this verification code:</p>
    ${renderOtpBlock(otp)}
    <p style="line-height:1.6; font-size:13px; color:#555;">${expiryText}</p>
    <p style="line-height:1.6; margin:16px 0 0;">If you did not request this, please ignore this email or contact us at <a href="mailto:${SUPPORT_EMAIL}" style="color:#0060ff;text-decoration:none;">${SUPPORT_EMAIL}</a>.</p>
  `;
  const textBody = `Hello ${username},\n\nYou are performing a sensitive action. Confirm your identity using this verification code:\n\n${otp}\n\n${expiryText}\n\nIf you did not request this, please ignore this email or contact us at ${SUPPORT_EMAIL}.`;
  return { html: renderBaseHtml("Verify your action on " + COMPANY_NAME, htmlBody), text: textBody };
}

/* ---------------- New exports ---------------- */

export interface EmailVerificationEmailParams {
  username?: string;
  email?: string;
  verificationUrl: string;
}

export function renderEmailVerificationEmail({ username, email, verificationUrl }: EmailVerificationEmailParams): { html: string; text: string } {
  const display = getDisplayName(username, email);
  const safeDisplay = escapeHtml(display);
  const safeUrl = escapeHtmlAttr(verificationUrl);
  const htmlBody = `
    <p style="line-height:1.6; margin:0 0 16px;">Hello ${safeDisplay},</p>
    <p style="line-height:1.6; margin:0 0 24px;">Thanks for signing up for <strong>${COMPANY_NAME}</strong>. Please verify your email to activate your account.</p>
    <p style="margin: 24px 0; text-align:center;">${renderButton(verificationUrl, "Verify Email")}</p>
    <p style="line-height:1.6; font-size:13px; color:#555;">If the button does not work, copy and paste this link:<br><a href="${safeUrl}" style="color:#0060ff;text-decoration:none;">${safeUrl}</a></p>
    <p style="line-height:1.6; margin:24px 0 0;">If you did not create an account, you can safely ignore this email or contact support at <a href="mailto:${SUPPORT_EMAIL}" style="color:#0060ff;text-decoration:none;">${SUPPORT_EMAIL}</a>.</p>
  `;
  const textBody = `Hello ${display},\n\nThanks for signing up for ${COMPANY_NAME}. Verify your email by visiting:\n\n${verificationUrl}\n\nIf you did not create an account, you can safely ignore this email or contact support at ${SUPPORT_EMAIL}.`;
  return { html: renderBaseHtml("Verify your " + COMPANY_NAME + " email", htmlBody), text: textBody };
}

export interface PasswordResetEmailParams {
  username?: string;
  email?: string;
  resetUrl: string;
}

export function renderPasswordResetEmail({ username, email, resetUrl }: PasswordResetEmailParams): { html: string; text: string } {
  const display = getDisplayName(username, email);
  const safeDisplay = escapeHtml(display);
  const safeUrl = escapeHtmlAttr(resetUrl);
  const htmlBody = `
    <p style="line-height:1.6; margin:0 0 16px;">Hello ${safeDisplay},</p>
    <p style="line-height:1.6; margin:0 0 24px;">We received a request to reset your ${COMPANY_NAME} password. Click the button below to choose a new password.</p>
    <p style="margin: 24px 0; text-align:center;">${renderButton(resetUrl, "Reset Password")}</p>
    <p style="line-height:1.6; font-size:13px; color:#555;">If the button does not work, copy and paste this link:<br><a href="${safeUrl}" style="color:#0060ff;text-decoration:none;">${safeUrl}</a></p>
    <p style="line-height:1.6; margin:16px 0 0;">If you did not request a password reset, you can safely ignore this email or contact support at <a href="mailto:${SUPPORT_EMAIL}" style="color:#0060ff;text-decoration:none;">${SUPPORT_EMAIL}</a>.</p>
  `;
  const textBody = `Hello ${display},\n\nWe received a request to reset your ${COMPANY_NAME} password. Visit this link to choose a new password:\n\n${resetUrl}\n\nIf you did not request a password reset, you can safely ignore this email or contact support at ${SUPPORT_EMAIL}.`;
  return { html: renderBaseHtml("Reset your " + COMPANY_NAME + " password", htmlBody), text: textBody };
}

export interface OtpEmailParams {
  username?: string;
  email?: string;
  otp: string;
  expiresInMinutes?: number;
}

export function renderSignInOtpEmail({ username, email, otp, expiresInMinutes }: OtpEmailParams): { html: string; text: string } {
  const display = getDisplayName(username, email);
  const safeDisplay = escapeHtml(display);
  const expiryText = typeof expiresInMinutes === "number" ? `This code expires in ${expiresInMinutes} minutes.` : "This code expires shortly.";
  const htmlBody = `
    <p style="line-height:1.6; margin:0 0 16px;">Hello ${safeDisplay},</p>
    <p style="line-height:1.6; margin:0 0 24px;">Use the code below to sign in to your ${COMPANY_NAME} account.</p>
    ${renderOtpBlock(otp)}
    <p style="line-height:1.6; font-size:13px; color:#555;">${expiryText}</p>
    <p style="line-height:1.6; margin:16px 0 0;">If you did not request this code, please ignore this email or contact support at <a href="mailto:${SUPPORT_EMAIL}" style="color:#0060ff;text-decoration:none;">${SUPPORT_EMAIL}</a>.</p>
  `;
  const textBody = `Hello ${display},\n\nYour sign-in code for ${COMPANY_NAME} is:\n\n${otp}\n\n${expiryText}\n\nIf you did not request this, please ignore this email or contact support at ${SUPPORT_EMAIL}.`;
  return { html: renderBaseHtml("Your " + COMPANY_NAME + " sign-in code", htmlBody), text: textBody };
}

export function renderEmailVerificationOtpEmail({ username, email, otp, expiresInMinutes }: OtpEmailParams): { html: string; text: string } {
  const display = getDisplayName(username, email);
  const safeDisplay = escapeHtml(display);
  const expiryText = typeof expiresInMinutes === "number" ? `This code expires in ${expiresInMinutes} minutes.` : "This code expires shortly.";
  const htmlBody = `
    <p style="line-height:1.6; margin:0 0 16px;">Hello ${safeDisplay},</p>
    <p style="line-height:1.6; margin:0 0 24px;">Verify your ${COMPANY_NAME} email using the code below.</p>
    ${renderOtpBlock(otp)}
    <p style="line-height:1.6; font-size:13px; color:#555;">${expiryText}</p>
    <p style="line-height:1.6; margin:16px 0 0;">If you did not request this, please ignore this email or contact support at <a href="mailto:${SUPPORT_EMAIL}" style="color:#0060ff;text-decoration:none;">${SUPPORT_EMAIL}</a>.</p>
  `;
  const textBody = `Hello ${display},\n\nYour ${COMPANY_NAME} verification code is:\n\n${otp}\n\n${expiryText}\n\nIf you did not request this, please ignore this email or contact support at ${SUPPORT_EMAIL}.`;
  return { html: renderBaseHtml("Your " + COMPANY_NAME + " verification code", htmlBody), text: textBody };
}

export function renderPasswordResetOtpEmail({ username, email, otp, expiresInMinutes }: OtpEmailParams): { html: string; text: string } {
  const display = getDisplayName(username, email);
  const safeDisplay = escapeHtml(display);
  const expiryText = typeof expiresInMinutes === "number" ? `This code expires in ${expiresInMinutes} minutes.` : "This code expires shortly.";
  const htmlBody = `
    <p style="line-height:1.6; margin:0 0 16px;">Hello ${safeDisplay},</p>
    <p style="line-height:1.6; margin:0 0 24px;">Use the code below to reset your ${COMPANY_NAME} password.</p>
    ${renderOtpBlock(otp)}
    <p style="line-height:1.6; font-size:13px; color:#555;">${expiryText}</p>
    <p style="line-height:1.6; margin:16px 0 0;">If you did not request a password reset, please ignore this email or contact support at <a href="mailto:${SUPPORT_EMAIL}" style="color:#0060ff;text-decoration:none;">${SUPPORT_EMAIL}</a>.</p>
  `;
  const textBody = `Hello ${display},\n\nYour ${COMPANY_NAME} password reset code is:\n\n${otp}\n\n${expiryText}\n\nIf you did not request a password reset, please ignore this email or contact support at ${SUPPORT_EMAIL}.`;
  return { html: renderBaseHtml("Your " + COMPANY_NAME + " password reset code", htmlBody), text: textBody };
}

export function renderTwoFactorOtpEmail({ username, email, otp, expiresInMinutes }: OtpEmailParams): { html: string; text: string } {
  const display = getDisplayName(username, email);
  const safeDisplay = escapeHtml(display);
  const expiryText = typeof expiresInMinutes === "number" ? `This code expires in ${expiresInMinutes} minutes.` : "This code expires shortly.";
  const htmlBody = `
    <p style="line-height:1.6; margin:0 0 16px;">Hello ${safeDisplay},</p>
    <p style="line-height:1.6; margin:0 0 24px;">Enter this code to complete two-factor authentication for your ${COMPANY_NAME} account.</p>
    ${renderOtpBlock(otp)}
    <p style="line-height:1.6; font-size:13px; color:#555;">${expiryText}</p>
    <p style="line-height:1.6; margin:16px 0 0;">If you did not try to sign in, please ignore this email or contact support at <a href="mailto:${SUPPORT_EMAIL}" style="color:#0060ff;text-decoration:none;">${SUPPORT_EMAIL}</a>.</p>
  `;
  const textBody = `Hello ${display},\n\nYour ${COMPANY_NAME} two-factor authentication code is:\n\n${otp}\n\n${expiryText}\n\nIf you did not try to sign in, please ignore this email or contact support at ${SUPPORT_EMAIL}.`;
  return { html: renderBaseHtml("Your " + COMPANY_NAME + " two-factor authentication code", htmlBody), text: textBody };
}
