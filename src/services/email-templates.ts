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
  return str
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function getDisplayName(username?: string, email?: string): string {
  if (username && username.trim()) return username.trim();
  if (email && email.trim()) return email.trim().split("@")[0];
  return "there";
}

/**
 * IMPORTANT:
 * Set EMAIL_LOGO_URL to a publicly accessible PNG.
 *
 * Example:
 * EMAIL_LOGO_URL=https://yourdomain.com/email-logo.png
 *
 * The image should ideally be around 300-600px wide and optimized
 * for email. Do not use the SolidJS SVG component directly here.
 */
function getLogoUrl(): string | undefined {
  const value = process.env.EMAIL_LOGO_URL?.trim();

  if (!value) return undefined;

  // Only allow http(s) URLs for externally hosted email images.
  if (!/^https?:\/\//i.test(value)) {
    return undefined;
  }

  return value;
}

function renderLogo(): string {
  const logoUrl = getLogoUrl();

  if (!logoUrl) {
    return `
      <tr>
        <td
          align="center"
          style="
            padding: 0 0 28px 0;
            font-family: Arial, Helvetica, sans-serif;
          "
        >
          <div
            style="
              color: #0060ff;
              font-size: 24px;
              line-height: 30px;
              font-weight: 700;
            "
          >
            ${escapeHtml(COMPANY_NAME)}
          </div>
        </td>
      </tr>
    `;
  }

  return `
    <tr>
      <td
        align="center"
        style="
          padding: 0 0 28px 0;
          font-size: 0;
          line-height: 0;
        "
      >
        <img
          src="${escapeHtmlAttr(logoUrl)}"
          alt="${escapeHtmlAttr(COMPANY_NAME)}"
          width="180"
          border="0"
          style="
            display: block;
            width: 180px;
            max-width: 100%;
            height: auto;
            border: 0;
            outline: none;
            text-decoration: none;
          "
        />
      </td>
    </tr>
  `;
}

function renderFooter(): string {
  return `
    <tr>
      <td
        style="
          padding: 24px 0 0 0;
          border-top: 1px solid #e5e5e5;
        "
      >
        <p
          style="
            margin: 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 13px;
            line-height: 20px;
            color: #777777;
          "
        >
          ${escapeHtml(COMPANY_NAME)}
          &mdash;
          Helping local businesses grow with reviews and AI marketing.
          <br />
          Need help?
          <a
            href="mailto:${escapeHtmlAttr(SUPPORT_EMAIL)}"
            style="
              color: #0060ff;
              text-decoration: none;
            "
          >
            ${escapeHtml(SUPPORT_EMAIL)}
          </a>
        </p>

        <p
          style="
            margin: 8px 0 0 0;
            padding: 0;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12px;
            line-height: 18px;
            color: #999999;
          "
        >
          You received this because it relates to your
          ${escapeHtml(COMPANY_NAME)} account.
        </p>
      </td>
    </tr>
  `;
}

function renderButton(url: string, label: string): string {
  const safeUrl = escapeHtmlAttr(url);
  const safeLabel = escapeHtml(label);

  return `
    <table
      role="presentation"
      border="0"
      cellspacing="0"
      cellpadding="0"
      align="center"
      style="margin: 0 auto;"
    >
      <tr>
        <td
          align="center"
          bgcolor="#0060ff"
          style="
            border-radius: 6px;
            background-color: #0060ff;
          "
        >
          <a
            href="${safeUrl}"
            target="_blank"
            style="
              display: inline-block;
              padding: 13px 24px;
              border: 1px solid #0060ff;
              border-radius: 6px;
              background-color: #0060ff;
              color: #ffffff;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 16px;
              line-height: 20px;
              font-weight: 700;
              text-decoration: none;
              white-space: nowrap;
            "
          >
            ${safeLabel}
          </a>
        </td>
      </tr>
    </table>
  `;
}

function renderFallbackLink(url: string): string {
  const safeUrl = escapeHtmlAttr(url);

  return `
    <p
      style="
        margin: 20px 0 0 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        line-height: 20px;
        color: #555555;
      "
    >
      If the button does not work, copy and paste this link into your browser:
    </p>

    <p
      style="
        margin: 8px 0 0 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        line-height: 20px;
        overflow-wrap: anywhere;
        word-break: break-word;
      "
    >
      <a
        href="${safeUrl}"
        target="_blank"
        style="
          color: #0060ff;
          text-decoration: underline;
          overflow-wrap: anywhere;
          word-break: break-all;
        "
      >
        Verify your email
      </a>
    </p>
  `;
}

function renderBaseHtml(title: string, bodyHtml: string): string {
  const safeTitle = escapeHtml(title);

  return `
<!DOCTYPE html>
<html
  lang="en"
  xmlns="http://www.w3.org/1999/xhtml"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:o="urn:schemas-microsoft-com:office:office"
>
<head>
  <meta charset="UTF-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1.0"
  />
  <meta
    name="x-apple-disable-message-reformatting"
  />

  <title>${safeTitle}</title>

  <style type="text/css">
    body,
    table,
    td,
    p,
    a {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }

    table,
    td {
      mso-table-lspace: 0pt;
      mso-table-rspace: 0pt;
    }

    table {
      border-collapse: collapse;
    }

    img {
      -ms-interpolation-mode: bicubic;
      border: 0;
      outline: none;
      text-decoration: none;
    }

    a {
      text-decoration: none;
    }

    @media only screen and (max-width: 600px) {
      .email-container {
        width: 100% !important;
        max-width: 100% !important;
      }

      .email-content {
        padding: 24px 20px !important;
      }

      .email-title {
        font-size: 21px !important;
        line-height: 28px !important;
      }

      .email-button {
        width: 100% !important;
      }

      .email-button a {
        display: block !important;
      }
    }
  </style>
</head>

<body
  style="
    margin: 0;
    padding: 0;
    width: 100% !important;
    min-width: 100%;
    background-color: #f6f7f9;
  "
>
  <!-- Preheader spacing -->
  <div
    style="
      display: none;
      max-height: 0;
      overflow: hidden;
      opacity: 0;
      color: transparent;
      font-size: 1px;
      line-height: 1px;
    "
  >
    ${safeTitle}
  </div>

  <table
    role="presentation"
    width="100%"
    border="0"
    cellspacing="0"
    cellpadding="0"
    bgcolor="#f6f7f9"
    style="
      width: 100%;
      min-width: 100%;
      background-color: #f6f7f9;
    "
  >
    <tr>
      <td
        align="center"
        valign="top"
        style="
          padding: 24px 12px;
        "
      >
        <!--[if mso]>
        <table
          role="presentation"
          border="0"
          cellspacing="0"
          cellpadding="0"
          width="600"
        >
          <tr>
            <td width="600">
        <![endif]-->

        <table
          role="presentation"
          class="email-container"
          width="100%"
          border="0"
          cellspacing="0"
          cellpadding="0"
          align="center"
          bgcolor="#ffffff"
          style="
            width: 100%;
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
            border: 1px solid #e5e5e5;
            border-radius: 8px;
          "
        >
          <tr>
            <td
              class="email-content"
              style="
                padding: 32px;
                font-family: Arial, Helvetica, sans-serif;
                color: #111111;
              "
            >
              <table
                role="presentation"
                width="100%"
                border="0"
                cellspacing="0"
                cellpadding="0"
                style="width: 100%;"
              >
                ${renderLogo()}

                <tr>
                  <td
                    align="center"
                    style="
                      padding: 0 0 24px 0;
                    "
                  >
                    <h1
                      class="email-title"
                      style="
                        margin: 0;
                        padding: 0;
                        font-family: Arial, Helvetica, sans-serif;
                        font-size: 22px;
                        line-height: 30px;
                        font-weight: 700;
                        color: #111111;
                        text-align: center;
                      "
                    >
                      ${safeTitle}
                    </h1>
                  </td>
                </tr>

                <tr>
                  <td
                    style="
                      padding: 0;
                      font-family: Arial, Helvetica, sans-serif;
                      color: #222222;
                    "
                  >
                    ${bodyHtml}
                  </td>
                </tr>

                ${renderFooter()}
              </table>
            </td>
          </tr>
        </table>

        <!--[if mso]>
            </td>
          </tr>
        </table>
        <![endif]-->
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function renderOtpBlock(otp: string): string {
  const safeOtp = escapeHtml(otp);

  return `
    <table
      role="presentation"
      width="100%"
      border="0"
      cellspacing="0"
      cellpadding="0"
      style="
        width: 100%;
        margin: 24px 0;
      "
    >
      <tr>
        <td
          align="center"
          bgcolor="#f0f5ff"
          style="
            padding: 20px 16px;
            background-color: #f0f5ff;
            border-left: 4px solid #0060ff;
            border-radius: 6px;
          "
        >
          <div
            style="
              font-family: Arial, Helvetica, sans-serif;
              font-size: 32px;
              line-height: 40px;
              font-weight: 700;
              letter-spacing: 6px;
              color: #0060ff;
            "
          >
            ${safeOtp}
          </div>

          <div
            style="
              margin-top: 6px;
              font-family: Arial, Helvetica, sans-serif;
              font-size: 13px;
              line-height: 20px;
              color: #555555;
            "
          >
            Use this code to proceed. Do not share it with anyone.
          </div>
        </td>
      </tr>
    </table>
  `;
}

/* ---------------- Existing exports ---------------- */

interface InviteEmailParams {
  username: string;
  inviteUrl: string;
}

export function renderInviteEmail({
  username,
  inviteUrl,
}: InviteEmailParams): { html: string; text: string } {
  const safeUsername = escapeHtml(username);

  const htmlBody = `
    <p
      style="
        margin: 0 0 16px 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      Hello ${safeUsername},
    </p>

    <p
      style="
        margin: 0 0 24px 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      You have been invited to join
      <strong>${escapeHtml(COMPANY_NAME)}</strong>.
      Click below to set up your account.
    </p>

    <p
      style="
        margin: 24px 0;
        padding: 0;
        text-align: center;
      "
    >
      ${renderButton(inviteUrl, "Set Up Your Account")}
    </p>

    ${renderFallbackLink(inviteUrl)}

    <p
      style="
        margin: 24px 0 0 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      If you did not request this invite, you can safely ignore this email
      or contact support at
      <a
        href="mailto:${escapeHtmlAttr(SUPPORT_EMAIL)}"
        style="color:#0060ff;text-decoration:none;"
      >
        ${escapeHtml(SUPPORT_EMAIL)}
      </a>.
    </p>
  `;

  const textBody = `Hello ${username},

You have been invited to join ${COMPANY_NAME}. Set up your account here:

${inviteUrl}

If you did not request this invite, you can safely ignore this email or contact support at ${SUPPORT_EMAIL}.`;

  return {
    html: renderBaseHtml(
      `You're invited to ${COMPANY_NAME}`,
      htmlBody,
    ),
    text: textBody,
  };
}

interface DeleteVerificationEmailParams {
  username: string;
  otp: string;
  expiresInMinutes?: number;
}

export function renderDeleteVerificationEmail({
  username,
  otp,
  expiresInMinutes,
}: DeleteVerificationEmailParams): {
  html: string;
  text: string;
} {
  const safeUsername = escapeHtml(username);

  const expiryText =
    typeof expiresInMinutes === "number"
      ? `This code expires in ${expiresInMinutes} minutes.`
      : "This code expires shortly.";

  const htmlBody = `
    <p
      style="
        margin: 0 0 16px 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      Hello ${safeUsername},
    </p>

    <p
      style="
        margin: 0 0 24px 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      You are performing a sensitive action. Confirm your identity using
      this verification code:
    </p>

    ${renderOtpBlock(otp)}

    <p
      style="
        margin: 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        line-height: 20px;
        color: #555555;
      "
    >
      ${escapeHtml(expiryText)}
    </p>

    <p
      style="
        margin: 16px 0 0 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      If you did not request this, please ignore this email or contact us at
      <a
        href="mailto:${escapeHtmlAttr(SUPPORT_EMAIL)}"
        style="color:#0060ff;text-decoration:none;"
      >
        ${escapeHtml(SUPPORT_EMAIL)}
      </a>.
    </p>
  `;

  const textBody = `Hello ${username},

You are performing a sensitive action. Confirm your identity using this verification code:

${otp}

${expiryText}

If you did not request this, please ignore this email or contact us at ${SUPPORT_EMAIL}.`;

  return {
    html: renderBaseHtml(
      `Verify your action on ${COMPANY_NAME}`,
      htmlBody,
    ),
    text: textBody,
  };
}

/* ---------------- Email verification link ---------------- */

export interface EmailVerificationEmailParams {
  username?: string;
  email?: string;
  verificationUrl: string;
}

export function renderEmailVerificationEmail({
  username,
  email,
  verificationUrl,
}: EmailVerificationEmailParams): {
  html: string;
  text: string;
} {
  const display = getDisplayName(username, email);
  const safeDisplay = escapeHtml(display);

  const htmlBody = `
    <p
      style="
        margin: 0 0 16px 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      Hello ${safeDisplay},
    </p>

    <p
      style="
        margin: 0 0 24px 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      Thanks for signing up for
      <strong>${escapeHtml(COMPANY_NAME)}</strong>.
      Please verify your email to activate your account.
    </p>

    <p
      style="
        margin: 24px 0;
        padding: 0;
        text-align: center;
      "
    >
      ${renderButton(verificationUrl, "Verify Email")}
    </p>

    ${renderFallbackLink(verificationUrl)}

    <p
      style="
        margin: 24px 0 0 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      If you did not create an account, you can safely ignore this email
      or contact support at
      <a
        href="mailto:${escapeHtmlAttr(SUPPORT_EMAIL)}"
        style="color:#0060ff;text-decoration:none;"
      >
        ${escapeHtml(SUPPORT_EMAIL)}
      </a>.
    </p>
  `;

  const textBody = `Hello ${display},

Thanks for signing up for ${COMPANY_NAME}.

Verify your email by visiting:

${verificationUrl}

If you did not create an account, you can safely ignore this email or contact support at ${SUPPORT_EMAIL}.`;

  return {
    html: renderBaseHtml(
      `Verify your ${COMPANY_NAME} email`,
      htmlBody,
    ),
    text: textBody,
  };
}

/* ---------------- Password reset link ---------------- */

export interface PasswordResetEmailParams {
  username?: string;
  email?: string;
  resetUrl: string;
}

export function renderPasswordResetEmail({
  username,
  email,
  resetUrl,
}: PasswordResetEmailParams): {
  html: string;
  text: string;
} {
  const display = getDisplayName(username, email);
  const safeDisplay = escapeHtml(display);

  const htmlBody = `
    <p
      style="
        margin: 0 0 16px 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      Hello ${safeDisplay},
    </p>

    <p
      style="
        margin: 0 0 24px 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      We received a request to reset your
      ${escapeHtml(COMPANY_NAME)} password.
      Click the button below to choose a new password.
    </p>

    <p
      style="
        margin: 24px 0;
        padding: 0;
        text-align: center;
      "
    >
      ${renderButton(resetUrl, "Reset Password")}
    </p>

    ${renderFallbackLink(resetUrl)}

    <p
      style="
        margin: 24px 0 0 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      If you did not request a password reset, you can safely ignore this
      email or contact support at
      <a
        href="mailto:${escapeHtmlAttr(SUPPORT_EMAIL)}"
        style="color:#0060ff;text-decoration:none;"
      >
        ${escapeHtml(SUPPORT_EMAIL)}
      </a>.
    </p>
  `;

  const textBody = `Hello ${display},

We received a request to reset your ${COMPANY_NAME} password.

Visit this link to choose a new password:

${resetUrl}

If you did not request a password reset, you can safely ignore this email or contact support at ${SUPPORT_EMAIL}.`;

  return {
    html: renderBaseHtml(
      `Reset your ${COMPANY_NAME} password`,
      htmlBody,
    ),
    text: textBody,
  };
}

/* ---------------- OTP emails ---------------- */

export interface OtpEmailParams {
  username?: string;
  email?: string;
  otp: string;
  expiresInMinutes?: number;
}

export function renderSignInOtpEmail({
  username,
  email,
  otp,
  expiresInMinutes,
}: OtpEmailParams): {
  html: string;
  text: string;
} {
  const display = getDisplayName(username, email);
  const safeDisplay = escapeHtml(display);

  const expiryText =
    typeof expiresInMinutes === "number"
      ? `This code expires in ${expiresInMinutes} minutes.`
      : "This code expires shortly.";

  const htmlBody = `
    <p
      style="
        margin: 0 0 16px 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      Hello ${safeDisplay},
    </p>

    <p
      style="
        margin: 0 0 24px 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      Use the code below to sign in to your
      ${escapeHtml(COMPANY_NAME)} account.
    </p>

    ${renderOtpBlock(otp)}

    <p
      style="
        margin: 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        line-height: 20px;
        color: #555555;
      "
    >
      ${escapeHtml(expiryText)}
    </p>

    <p
      style="
        margin: 16px 0 0 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      If you did not request this code, please ignore this email or contact
      support at
      <a
        href="mailto:${escapeHtmlAttr(SUPPORT_EMAIL)}"
        style="color:#0060ff;text-decoration:none;"
      >
        ${escapeHtml(SUPPORT_EMAIL)}
      </a>.
    </p>
  `;

  const textBody = `Hello ${display},

Your sign-in code for ${COMPANY_NAME} is:

${otp}

${expiryText}

If you did not request this code, please ignore this email or contact support at ${SUPPORT_EMAIL}.`;

  return {
    html: renderBaseHtml(
      `Your ${COMPANY_NAME} sign-in code`,
      htmlBody,
    ),
    text: textBody,
  };
}

export function renderEmailVerificationOtpEmail({
  username,
  email,
  otp,
  expiresInMinutes,
}: OtpEmailParams): {
  html: string;
  text: string;
} {
  const display = getDisplayName(username, email);
  const safeDisplay = escapeHtml(display);

  const expiryText =
    typeof expiresInMinutes === "number"
      ? `This code expires in ${expiresInMinutes} minutes.`
      : "This code expires shortly.";

  const htmlBody = `
    <p
      style="
        margin: 0 0 16px 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      Hello ${safeDisplay},
    </p>

    <p
      style="
        margin: 0 0 24px 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      Verify your ${escapeHtml(COMPANY_NAME)} email using the code below.
    </p>

    ${renderOtpBlock(otp)}

    <p
      style="
        margin: 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        line-height: 20px;
        color: #555555;
      "
    >
      ${escapeHtml(expiryText)}
    </p>

    <p
      style="
        margin: 16px 0 0 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      If you did not request this, please ignore this email or contact
      support at
      <a
        href="mailto:${escapeHtmlAttr(SUPPORT_EMAIL)}"
        style="color:#0060ff;text-decoration:none;"
      >
        ${escapeHtml(SUPPORT_EMAIL)}
      </a>.
    </p>
  `;

  const textBody = `Hello ${display},

Your ${COMPANY_NAME} verification code is:

${otp}

${expiryText}

If you did not request this, please ignore this email or contact support at ${SUPPORT_EMAIL}.`;

  return {
    html: renderBaseHtml(
      `Your ${COMPANY_NAME} verification code`,
      htmlBody,
    ),
    text: textBody,
  };
}

export function renderPasswordResetOtpEmail({
  username,
  email,
  otp,
  expiresInMinutes,
}: OtpEmailParams): {
  html: string;
  text: string;
} {
  const display = getDisplayName(username, email);
  const safeDisplay = escapeHtml(display);

  const expiryText =
    typeof expiresInMinutes === "number"
      ? `This code expires in ${expiresInMinutes} minutes.`
      : "This code expires shortly.";

  const htmlBody = `
    <p
      style="
        margin: 0 0 16px 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      Hello ${safeDisplay},
    </p>

    <p
      style="
        margin: 0 0 24px 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      Use this code to reset your ${escapeHtml(COMPANY_NAME)} password.
    </p>

    ${renderOtpBlock(otp)}

    <p
      style="
        margin: 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        line-height: 20px;
        color: #555555;
      "
    >
      ${escapeHtml(expiryText)}
    </p>

    <p
      style="
        margin: 16px 0 0 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      If you did not request a password reset, please ignore this email or
      contact support at
      <a
        href="mailto:${escapeHtmlAttr(SUPPORT_EMAIL)}"
        style="color:#0060ff;text-decoration:none;"
      >
        ${escapeHtml(SUPPORT_EMAIL)}
      </a>.
    </p>
  `;

  const textBody = `Hello ${display},

Your ${COMPANY_NAME} password reset code is:

${otp}

${expiryText}

If you did not request a password reset, please ignore this email or contact support at ${SUPPORT_EMAIL}.`;

  return {
    html: renderBaseHtml(
      `Your ${COMPANY_NAME} password reset code`,
      htmlBody,
    ),
    text: textBody,
  };
}

export function renderTwoFactorOtpEmail({
  username,
  email,
  otp,
  expiresInMinutes,
}: OtpEmailParams): {
  html: string;
  text: string;
} {
  const display = getDisplayName(username, email);
  const safeDisplay = escapeHtml(display);

  const expiryText =
    typeof expiresInMinutes === "number"
      ? `This code expires in ${expiresInMinutes} minutes.`
      : "This code expires shortly.";

  const htmlBody = `
    <p
      style="
        margin: 0 0 16px 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      Hello ${safeDisplay},
    </p>

    <p
      style="
        margin: 0 0 24px 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      Enter this code to complete two-factor authentication for your
      ${escapeHtml(COMPANY_NAME)} account.
    </p>

    ${renderOtpBlock(otp)}

    <p
      style="
        margin: 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 13px;
        line-height: 20px;
        color: #555555;
      "
    >
      ${escapeHtml(expiryText)}
    </p>

    <p
      style="
        margin: 16px 0 0 0;
        padding: 0;
        font-family: Arial, Helvetica, sans-serif;
        font-size: 16px;
        line-height: 26px;
        color: #222222;
      "
    >
      If you did not try to sign in, please ignore this email or contact
      support at
      <a
        href="mailto:${escapeHtmlAttr(SUPPORT_EMAIL)}"
        style="color:#0060ff;text-decoration:none;"
      >
        ${escapeHtml(SUPPORT_EMAIL)}
      </a>.
    </p>
  `;

  const textBody = `Hello ${display},

Your ${COMPANY_NAME} two-factor authentication code is:

${otp}

${expiryText}

If you did not try to sign in, please ignore this email or contact support at ${SUPPORT_EMAIL}.`;

  return {
    html: renderBaseHtml(
      `Your ${COMPANY_NAME} two-factor authentication code`,
      htmlBody,
    ),
    text: textBody,
  };
}
