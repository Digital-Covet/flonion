import { Context, type Effect, Layer } from "effect";
import {
  type MailError,
  type SendEmailOptions,
  sendMail,
} from "~/services/email";

export { MailError, type SendEmailOptions } from "~/services/email";

export class Mailer extends Context.Service<
  Mailer,
  {
    /**
     * One attempt, with a timeout. Callers decide whether a failure matters;
     * most treat mail as best-effort and carry on.
     */
    readonly send: (
      options: SendEmailOptions,
    ) => Effect.Effect<void, MailError>;
  }
>()("revme/Mailer") {
  static readonly layer = Layer.succeed(Mailer, Mailer.of({ send: sendMail }));
}
