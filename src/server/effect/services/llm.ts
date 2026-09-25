import { ChatDeepSeek } from "@langchain/deepseek";
import { Config, Context, Effect, Layer, Redacted, Schema } from "effect";
import type { UsageMeta } from "~/lib/agents/ledger";

/*
 * Server-only: this holds the DeepSeek API key.
 */

/** The model failed, timed out, isn't configured, or answered off-schema. */
export class LlmError extends Schema.TaggedError<LlmError>()("LlmError", {
  message: Schema.String,
  cause: Schema.optionalKey(Schema.Defect()),
}) {}

export interface ChatMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

export interface Completion {
  readonly text: string;
  readonly usage: UsageMeta;
}

/**
 * Deadline on a completion. Without one a hung upstream holds the request
 * handler open indefinitely, and the AI endpoints are the ones an anonymous
 * caller can reach. Generous because generation is genuinely slow.
 */
const MODEL_TIMEOUT_MS = 60_000;

export const DEFAULT_MODEL_ID = "deepseek-v4-flash";

const LlmConfig = Config.all({
  apiKey: Config.Redacted("DEEPSEEK_API_KEY"),
  model: Config.String("AI_MODEL_ID").pipe(
    Config.withDefault(DEFAULT_MODEL_ID),
  ),
});

/**
 * Usage from a LangChain response: `usage_metadata` (DeepSeek v4+), else the
 * older `response_metadata.tokenUsage`, else zeros.
 */
function usageOf(response: unknown, model: string): UsageMeta {
  const r = response as {
    usage_metadata?: { input_tokens?: number; output_tokens?: number };
    response_metadata?: {
      tokenUsage?: { promptTokens?: number; completionTokens?: number };
    };
  };
  return {
    promptTokens:
      r?.usage_metadata?.input_tokens ??
      r?.response_metadata?.tokenUsage?.promptTokens ??
      0,
    completionTokens:
      r?.usage_metadata?.output_tokens ??
      r?.response_metadata?.tokenUsage?.completionTokens ??
      0,
    model,
  };
}

function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((c) =>
        c && typeof c === "object" && "text" in c ? String(c.text) : "",
      )
      .join("");
  }
  return "";
}

export class LlmModel extends Context.Service<
  LlmModel,
  {
    /**
     * One chat completion. LangChain already retries twice and enforces a
     * 60 s timeout, so no retry is added here.
     */
    readonly complete: (options: {
      readonly temperature: number;
      readonly messages: ReadonlyArray<ChatMessage>;
    }) => Effect.Effect<Completion, LlmError>;
  }
>()("revme/LlmModel") {
  static readonly layer = Layer.succeed(
    LlmModel,
    LlmModel.of({
      complete: ({ temperature, messages }) =>
        Effect.gen(function* () {
          // Read per call: a missing key breaks only the AI endpoints.
          const config = yield* LlmConfig.pipe(
            Effect.mapError(
              (cause) =>
                new LlmError({ message: "DeepSeek is not configured", cause }),
            ),
          );
          const chat = new ChatDeepSeek({
            model: config.model,
            temperature,
            apiKey: Redacted.value(config.apiKey),
            timeout: MODEL_TIMEOUT_MS,
            maxRetries: 2,
          });
          const response = yield* Effect.tryPromise({
            try: () => chat.invoke(messages.map((m) => ({ ...m }))),
            catch: (cause) =>
              new LlmError({ message: "Model call failed", cause }),
          });
          return {
            text: textOf(response.content),
            usage: usageOf(response, config.model),
          };
        }).pipe(Effect.withSpan("LlmModel.complete")),
    }),
  );
}

/** Decodes a model's JSON answer; off-schema output is an `LlmError`. */
export const decodeModelJson =
  <S extends Schema.Top & { readonly DecodingServices: never }>(schema: S) =>
  (text: string): Effect.Effect<S["Type"], LlmError> =>
    Schema.decodeUnknownEffect(Schema.fromJsonString(schema))(text).pipe(
      Effect.mapError(
        (cause) =>
          new LlmError({ message: "Model answered off-schema", cause }),
      ),
    );
