import {
  Cause,
  Config,
  Duration,
  Effect,
  Exit,
  Redacted,
  Schema,
} from "effect";
import { SendMailClient } from "zeptomail";

/*
 * Server-only. `sendMail` is the implementation; the `Mailer` service
 * (`src/server/effect/services/mailer.ts`) exposes it to route programs and
 * `sendEmail` to Promise code, better-auth's hooks included. It deliberately
 * needs no services, so better-auth can use it without the app runtime.
 */

/**
 * ZeptoMail's SDK is untyped and answers both success and rejection with plain
 * objects, so nothing about these shapes is guaranteed at runtime.
 */
interface ZeptoMailResponse {
  data?: { email_id?: string }[];
  message?: string;
}

interface ZeptoMailError {
  error?: unknown;
  message?: unknown;
  response?: { status?: unknown; data?: unknown };
}

export interface SendEmailOptions {
  to: string;
  toName?: string;
  subject: string;
  text: string;
  html?: string;
  fromName?: string;
  attachments?: Array<{ name: string; content: string; mime_type: string }>;
}

export class MailError extends Schema.TaggedError<MailError>()("MailError", {
  message: Schema.String,
}) {}

/**
 * Stop waiting after this. The SDK can't cancel, so a very late send may
 * still go out; every caller already treats mail as best-effort.
 */
const SEND_TIMEOUT = Duration.seconds(15);

const MailConfig = Config.all({
  url: Config.String("ZEPTOMAIL_URL"),
  token: Config.Redacted("ZEPTOMAIL_TOKEN"),
  sender: Config.String("ZEPTOMAIL_SENDER_ADDRESS"),
});

/** One client per process, rebuilt only if the configuration changes. */
let cached: { key: string; client: SendMailClient } | undefined;

function clientFor(url: string, token: string): SendMailClient {
  const cleanToken = token.replace(/^(Zoho-enczapikey\s+)/i, "");
  const key = `${url}\n${cleanToken}`;
  if (cached?.key !== key) {
    cached = {
      key,
      client: new SendMailClient({
        url,
        token: `Zoho-enczapikey ${cleanToken}`,
      }),
    };
  }
  return cached.client;
}

/** Pulls a readable message out of whatever the SDK threw. */
function describe(error: unknown): string {
  const err = (error ?? {}) as ZeptoMailError;
  let message = "Failed to send email via ZeptoMail.";

  if (error instanceof Error && error.message) message = error.message;
  else if (err.error) {
    message =
      typeof err.error === "string" ? err.error : JSON.stringify(err.error);
  } else if (typeof err.message === "string" && err.message) {
    message = err.message;
  } else if (error && typeof error === "object") {
    message = `ZeptoMail Error: ${JSON.stringify(error)}`;
  }

  if (err.response) {
    const { status, data } = err.response;
    console.error("🚨 [ZeptoMail] Response Status:", status);
    if (data) {
      const apiMsg =
        typeof data === "string"
          ? data
          : (data as { message?: string }).message || JSON.stringify(data);
      message += ` (Status ${status}): ${apiMsg}`;
    }
  }
  return message;
}

/** Sends one email. A single attempt: a retry could deliver it twice. */
export const sendMail = Effect.fn("Mailer.send")(function* ({
  to,
  toName,
  subject,
  text,
  html,
  fromName = "Flonion",
  attachments,
}: SendEmailOptions) {
  const config = yield* MailConfig.pipe(
    Effect.mapError(
      () =>
        new MailError({
          message:
            "[ZeptoMail] Configuration missing: ZEPTOMAIL_URL, ZEPTOMAIL_TOKEN or ZEPTOMAIL_SENDER_ADDRESS",
        }),
    ),
  );
  const client = clientFor(config.url, Redacted.value(config.token));

  const response = yield* Effect.tryPromise({
    try: () =>
      client.sendMail({
        from: { address: config.sender, name: fromName },
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
        ...(attachments && attachments.length > 0
          ? {
              attachment: attachments.map((a) => ({
                name: a.name,
                content: a.content,
                mime_type: a.mime_type,
              })),
            }
          : {}),
      }) as Promise<ZeptoMailResponse>,
    catch: (error) => {
      console.error(
        "🚨 [ZeptoMail] Raw Error Object:",
        JSON.stringify(error, null, 2),
      );
      return new MailError({ message: describe(error) });
    },
  }).pipe(
    Effect.timeoutOrElse({
      duration: SEND_TIMEOUT,
      orElse: () =>
        Effect.fail(new MailError({ message: "[ZeptoMail] Timed out" })),
    }),
  );

  if (!response?.data || response.data.length === 0) {
    console.error(
      "❌ [ZeptoMail] Rejected Payload:",
      JSON.stringify(response, null, 2),
    );
    return yield* new MailError({
      message:
        response?.message ||
        JSON.stringify(response) ||
        "ZeptoMail rejected the email request.",
    });
  }

  console.log(
    `✅ [ZeptoMail] Sent to <${to}>. ID: ${response.data[0].email_id}`,
  );
});

/**
 * Promise form for code not on Effect. Rejects with the `MailError` itself,
 * an `Error` whose message says what went wrong, as before.
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  const exit = await Effect.runPromiseExit(sendMail(options));
  if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
}
