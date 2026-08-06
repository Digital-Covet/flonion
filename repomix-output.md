# Directory Structure
```
src/assets/combination-mark.tsx
src/assets/inline-combination-mark.tsx
src/assets/logomark.tsx
src/assets/wordmark.tsx
src/lib/auth-client.ts
src/lib/auth.ts
src/routes/api/google/auth.ts
src/services/email-templates.ts
src/services/email.ts
src/types/auth-ui.ts
```

# Files

## File: src/assets/combination-mark.tsx
```typescript
import { JSX } from "solid-js/jsx-runtime";
const FlonionLogo = (props: JSX.SvgSVGAttributes<SVGSVGElement>) => (
  <svg
    data-name="Layer 1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1080 1080"
    {...props}
  >
    <path
      d="M203.12 635.68V655H161.9c-20.18 0-34.35 14.39-34.35 34.57v15.24h68.92v18.25h-68.92v63.12h-22.33v-96.62c0-30.7 25.98-53.89 56.68-53.89h41.22Zm45.09 0v96.83c0 21.47 12.67 33.92 34.35 33.92h37.14v19.54h-37.14c-32.42 0-56.9-17.39-56.9-53.46v-96.83h22.54Zm218.14 75.36c0 42.3-32.42 77.29-73 77.29s-72.78-35-72.78-77.29 32.21-77.29 72.78-77.29 73 35.21 73 77.29m-122.59 0c0 31.56 21.68 55.39 49.6 55.39s49.81-23.83 49.81-55.39-21.68-55.18-49.81-55.18-49.6 23.83-49.6 55.18m168.76-75.36 76.65 115.08V635.68h20.4v150.29h-22.54l-76.65-115.08v115.08h-20.61V635.68h22.76Zm127.11 0h22.54v150.29h-22.54zm191.94 75.36c0 42.3-32.42 77.29-73 77.29s-72.78-35-72.78-77.29 32.2-77.29 72.78-77.29 73 35.21 73 77.29m-122.59 0c0 31.56 21.69 55.39 49.6 55.39s49.81-23.83 49.81-55.39-21.69-55.18-49.81-55.18-49.6 23.83-49.6 55.18m168.76-75.36 76.65 115.08V635.68h20.4v150.29h-22.54L875.6 670.89v115.08h-20.61V635.68h22.76ZM542.96 291.67c6.95.71 13.34 6.46 13.79 14.56l3.71 66.67 46.09-49.03c5.83-6.2 15.08-5.56 21.22-.6 6.61 5.34 8.75 14.7 3.46 21.78l-40.04 53.56 65.46-7.84c5.19-.62 9.86.89 13.24 4.2 3.61 3.53 5.18 8.14 4.9 13.71-.3 6.1-4.43 12.39-10.99 13.94l-65.61 15.45 56.42 37.04c7.27 4.77 7.82 14.76 3.43 21.63-4.34 6.8-12.8 9.93-20.29 6.15l-59.64-30.12 19.13 63.26c1.69 5.59.48 11.07-3.13 15.22-3.67 4.22-8.84 5.86-14.98 5.45-5.24-.35-10.11-3.6-12.36-8.84l-26.33-61.39-26.64 62.09c-2.23 5.2-7.53 7.92-12.48 8.17-5.87.29-10.57-1.27-14.13-5.06-3.79-4.03-5.32-9.68-3.61-15.34l19.25-63.58-59.58 30.09c-7.83 3.95-16.61.54-20.82-6.82-3.97-6.92-3.07-16.37 3.98-21l56.35-36.96-64.39-15.09c-6.82-1.6-11.4-6.67-12.32-13.1l.22-4.99c.92-8.14 7.86-15.24 16.86-14.17l66.59 7.87L450.3 346c-5.59-7.46-4.39-17.03 2.94-22.85 6.13-4.86 15.41-5.36 21.21.8l45.95 48.81 3.78-66.73c.45-7.93 6.63-13.08 13.67-14.22l5.12-.15Z"
      fill="#0060ff"
    />
    <path d="m567.72 395-15.77 67.39-16.09-33.42-34.38-13.93z" fill="#fff" />
  </svg>
);
export default FlonionLogo;
```

## File: src/assets/logomark.tsx
```typescript
import { JSX } from "solid-js/jsx-runtime";
const SVGComponent = (props: JSX.SvgSVGAttributes<SVGSVGElement>) => (
  <svg
    data-name="Layer 1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 1080 1080"
    {...props}
  >
    <path
      d="M546.12 219.89c16.78 1.72 32.22 15.61 33.31 35.17l8.96 161.01 111.3-118.4c14.08-14.97 36.43-13.43 51.26-1.45 15.97 12.9 21.13 35.51 8.35 52.59l-96.71 129.36 158.08-18.94c12.52-1.5 23.82 2.15 31.98 10.14 8.72 8.54 12.51 19.66 11.84 33.1-.73 14.74-10.69 29.93-26.54 33.66l-158.46 37.32 136.26 89.44c17.57 11.53 18.89 35.65 8.3 52.25-10.48 16.41-30.92 23.99-49.01 14.85L631 657.24l46.19 152.79c4.08 13.5 1.16 26.73-7.56 36.77-8.86 10.2-21.34 14.16-36.18 13.16-12.65-.85-24.41-8.7-29.84-21.36l-63.58-148.26-64.34 149.94c-5.39 12.56-18.19 19.14-30.13 19.74-14.17.71-25.52-3.06-34.12-12.22-9.14-9.73-12.86-23.38-8.72-37.05l46.49-153.55-143.9 72.67c-18.91 9.55-40.1 1.3-50.28-16.46-9.58-16.71-7.42-39.53 9.62-50.71l136.08-89.26L245.21 537c-16.46-3.86-27.54-16.11-29.76-31.63l.52-12.04c2.21-19.67 18.97-36.8 40.73-34.23l160.81 19-95.19-126.99c-13.5-18.01-10.6-41.13 7.11-55.18 14.8-11.75 37.21-12.95 51.22 1.93l110.98 117.88 9.12-161.15c1.08-19.15 16-31.59 33.02-34.33l12.37-.36Z"
      fill="#0060ff"
    />
    <path
      d="m605.91 469.45-38.09 162.74-38.87-80.71-83.02-33.65z"
      fill="#fff"
    />
  </svg>
);
export default SVGComponent;
```

## File: src/assets/wordmark.tsx
```typescript
import { JSX } from "solid-js/jsx-runtime";
const SVGComponent = (props: JSX.SvgSVGAttributes<SVGSVGElement>) => (
  <svg
    data-name="Layer 1"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="105 462 875 155"
    {...props}
  >
    <path
      d="M203.12 464.64v19.32H161.9c-20.18 0-34.35 14.39-34.35 34.57v15.24h68.92v18.25h-68.92v63.12h-22.33v-96.62c0-30.7 25.98-53.89 56.68-53.89h41.22Zm45.09 0v96.83c0 21.47 12.67 33.92 34.35 33.92h37.14v19.54h-37.14c-32.42 0-56.9-17.39-56.9-53.46v-96.83h22.54ZM466.35 540c0 42.3-32.42 77.29-73 77.29s-72.78-35-72.78-77.29 32.21-77.29 72.78-77.29 73 35.21 73 77.29m-122.59 0c0 31.56 21.68 55.39 49.6 55.39s49.81-23.83 49.81-55.39-21.68-55.18-49.81-55.18-49.6 23.83-49.6 55.18m168.76-75.36 76.65 115.08V464.64h20.4v150.29h-22.54l-76.65-115.08v115.08h-20.61V464.64h22.76Zm127.11 0h22.54v150.29h-22.54zM831.57 540c0 42.3-32.42 77.29-73 77.29s-72.78-35-72.78-77.29 32.2-77.29 72.78-77.29 73 35.21 73 77.29m-122.59 0c0 31.56 21.69 55.39 49.6 55.39s49.81-23.83 49.81-55.39-21.69-55.18-49.81-55.18-49.6 23.83-49.6 55.18m168.76-75.36 76.65 115.08V464.64h20.4v150.29h-22.54L875.6 499.85v115.08h-20.61V464.64h22.76Z"
      fill="#0060ff"
    />
  </svg>
);
export default SVGComponent;
```

## File: src/services/email.ts
```typescript
import { SendMailClient } from "zeptomail";
interface SendEmailOptions {
	to: string;
	toName?: string;
	subject: string;
	text: string;
	html?: string;
	fromName?: string;
}
function createClient(): SendMailClient {
	const url = process.env.ZEPTOMAIL_URL;
	const token = process.env.ZEPTOMAIL_TOKEN;
	if (!url || !token) {
		throw new Error(
			"[ZeptoMail] Configuration missing: ZEPTOMAIL_URL or ZEPTOMAIL_TOKEN",
		);
	}
	const cleanToken = token.replace(/^(Zoho-enczapikey\s+)/i, "");
	const authToken = `Zoho-enczapikey ${cleanToken}`;
	return new SendMailClient({ url, token: authToken });
}
export async function sendEmail({
	to,
	toName,
	subject,
	text,
	html,
	fromName = "Flonion",
}: SendEmailOptions): Promise<void> {
	const senderAddress = process.env.ZEPTOMAIL_SENDER_ADDRESS;
	if (!senderAddress)
		throw new Error("[ZeptoMail] ZEPTOMAIL_SENDER_ADDRESS is not set.");
	const client = createClient();
	try {
		const response: any = await client.sendMail({
			from: { address: senderAddress, name: fromName },
			to: [
				{
					email_address: {
						address: to,
						name: toName ?? to.split("@")[0],
					},
				},
			],
			subject,
			textbody: text,
			htmlbody: html ?? text,
		});
		if (response && response.data && response.data.length > 0) {
			console.log(
				`✅ [ZeptoMail] Sent to <${to}>. ID: ${response.data[0].email_id}`,
			);
		} else {
			console.error(
				"❌ [ZeptoMail] Rejected Payload:",
				JSON.stringify(response, null, 2),
			);
			throw new Error(
				response.message ||
					JSON.stringify(response) ||
					"ZeptoMail rejected the email request.",
			);
		}
	} catch (error: any) {
		console.error(
			"🚨 [ZeptoMail] Raw Error Object:",
			JSON.stringify(error, null, 2),
		);
		let finalMessage = "Failed to send email via ZeptoMail.";
		if (error instanceof Error && error.message) {
			finalMessage = error.message;
		}
		else if (error?.error) {
			finalMessage =
				typeof error.error === "string"
					? error.error
					: JSON.stringify(error.error);
		}
		else if (error?.message) {
			finalMessage = error.message;
		}
		else if (error && typeof error === "object") {
			finalMessage = `ZeptoMail Error: ${JSON.stringify(error)}`;
		}
		if (error.response) {
			const status = error.response.status;
			const data = error.response.data;
			console.error("🚨 [ZeptoMail] Response Status:", status);
			if (data) {
				const apiMsg =
					typeof data === "string"
						? data
						: data.message || JSON.stringify(data);
				finalMessage += ` (Status ${status}): ${apiMsg}`;
			}
		}
		throw new Error(finalMessage);
	}
}
```

## File: src/assets/inline-combination-mark.tsx
```typescript
import { JSX } from "solid-js/jsx-runtime";
const SVGComponent = (props: JSX.SvgSVGAttributes<SVGSVGElement>) => (
  <svg
    data-name="Layer 1"
    viewBox="0 0 1799.209 265.104"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M481.7 3.296v32.986h-70.377c-34.454 0-58.648 24.569-58.648 59.023v26.02h117.671v31.16h-117.67v107.767H314.55V95.288c0-52.415 44.357-92.009 96.773-92.009H481.7zm76.984 0V168.62c0 36.657 21.632 57.913 58.648 57.913h63.41v33.362h-63.41c-55.352 0-97.148-29.69-97.148-91.275V3.296h38.483zm372.442 128.666c0 72.221-55.353 131.961-124.637 131.961s-124.26-59.757-124.26-131.96S737.221 0 806.488 0s124.637 60.116 124.637 131.961m-209.304 0c0 53.884 37.015 94.57 84.684 94.57s85.043-40.686 85.043-94.57-37.015-94.211-85.043-94.211-84.684 40.686-84.684 94.211M1009.954 3.296l130.868 196.482V3.296h34.83v256.598h-38.483L1006.3 63.412v196.482h-35.188V3.296h38.86zm217.021 0h38.484v256.598h-38.484zm327.709 128.666c0 72.221-55.352 131.961-124.637 131.961s-124.26-59.757-124.26-131.96S1360.763 0 1430.047 0s124.637 60.116 124.637 131.961m-209.304 0c0 53.884 37.032 94.57 84.685 94.57s85.043-40.686 85.043-94.57-37.033-94.211-85.043-94.211-84.685 40.686-84.685 94.211M1633.512 3.296l130.869 196.482V3.296h34.83v256.598h-38.484L1629.859 63.412v196.482h-35.189V3.296h38.86zM136.91.01c6.95.71 13.34 6.46 13.79 14.56l3.71 66.67 46.09-49.03c5.83-6.2 15.08-5.56 21.22-.6 6.61 5.34 8.75 14.7 3.46 21.78l-40.04 53.56 65.46-7.84c5.19-.62 9.86.89 13.24 4.2 3.61 3.53 5.18 8.14 4.9 13.71-.3 6.1-4.43 12.39-10.99 13.94l-65.61 15.45 56.42 37.04c7.27 4.77 7.82 14.76 3.43 21.63-4.34 6.8-12.8 9.93-20.29 6.15l-59.64-30.12 19.13 63.26c1.69 5.59.48 11.07-3.13 15.22-3.67 4.22-8.84 5.86-14.98 5.45-5.24-.35-10.11-3.6-12.36-8.84l-26.33-61.39-26.64 62.09c-2.23 5.2-7.53 7.92-12.48 8.17-5.87.29-10.57-1.27-14.13-5.06-3.79-4.03-5.32-9.68-3.61-15.34l19.25-63.58-59.58 30.09c-7.83 3.95-16.61.54-20.82-6.82-3.97-6.92-3.07-16.37 3.98-21l56.35-36.96-64.39-15.09C5.5 129.71.92 124.64 0 118.21l.22-4.99c.92-8.14 7.86-15.24 16.86-14.17l66.59 7.87-39.42-52.58c-5.59-7.46-4.39-17.03 2.94-22.85 6.13-4.86 15.41-5.36 21.21.8l45.95 48.81 3.78-66.73c.45-7.93 6.63-13.08 13.67-14.22l5.12-.15z"
      fill="#0060ff"
    />
    <path d="m95.43 123.38 66.24-20.04-15.77 67.39-16.09-33.42z" fill="#fff" />
  </svg>
);
export default SVGComponent;
```

## File: src/lib/auth-client.ts
```typescript
import { createAuthClient } from "better-auth/solid";
import { emailOTPClient } from "better-auth/client/plugins";
import { twoFactorClient } from "better-auth/client/plugins";
export const authClient = createAuthClient({
  plugins: [
    emailOTPClient(),
    twoFactorClient({
      onTwoFactorRedirect() {
        window.location.href = "/2fa";
      },
    }),
  ],
});
```

## File: src/routes/api/google/auth.ts
```typescript
import type { APIEvent } from "@solidjs/start/server"
import { getSessionFromHeaders } from "~/lib/server-auth"
function getEnv(key: string): string {
  const value = process.env[key]
  if (!value) throw new Error(`Missing environment variable: ${key}`)
  return value
}
export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers)
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }
  const clientId = getEnv("GOOGLE_CLIENT_ID")
  const redirectUri = getEnv("GOOGLE_REDIRECT_URI")
  const url = new URL(event.request.url)
  const returnTo = url.searchParams.get("returnTo") || "/"
  const scopes = [
    "https://www.googleapis.com/auth/business.manage",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ]
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
    state: returnTo,
  })
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  return new Response(null, {
    status: 302,
    headers: { Location: authUrl },
  })
}
```

## File: src/types/auth-ui.ts
```typescript
export type FormStatus = 'idle' | 'loading' | 'success';
export interface FooterLink {
  label: string;
  href: string;
}
export interface FooterProps {
  links: readonly FooterLink[];
}
export interface DividerProps {
  label?: string;
  class?: string;
}
export interface SignUpFormProps {
  onSubmit?: (email: string, password: string, name: string) => void | Promise<void>;
  redirectTo?: string;
  redirectText?: string;
  redirectLabel?: string;
  submitLabel?: string;
}
export interface SignInFormProps {
  onSubmit?: (email: string, password: string) => void | Promise<void>;
  onError?: (message: string) => void;
  redirectTo?: string;
  redirectText?: string;
  redirectLabel?: string;
  submitLabel?: string;
  forgotPasswordHref?: string;
}
export interface ForgotPasswordFormProps {
  onSubmit?: (email: string) => void | Promise<void>;
  redirectTo?: string;
  redirectText?: string;
  redirectLabel?: string;
  submitLabel?: string;
}
export interface ResendVerificationFormProps {
  onSubmit?: (email: string) => void | Promise<void>;
  initialEmail?: string;
  redirectTo?: string;
  redirectText?: string;
  redirectLabel?: string;
  submitLabel?: string;
}
export interface ResetPasswordFormProps {
  onSubmit?: (newPassword: string) => void | Promise<void>;
  submitLabel?: string;
}
export interface IllustrationPanelProps {
  imageSrc: string;
  imageAlt?: string;
}
```

## File: src/services/email-templates.ts
```typescript
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
```

## File: src/lib/auth.ts
```typescript
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
```
