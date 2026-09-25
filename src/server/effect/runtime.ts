import { Layer, ManagedRuntime } from "effect";
import { Auth } from "./services/auth";
import { Billing } from "./services/billing";
import { Db } from "./services/db";
import { Google } from "./services/google";
import { LlmModel } from "./services/llm";
import { Mailer } from "./services/mailer";
import { RateLimiter } from "./services/rate-limiter";

/*
 * Server-only. Nothing here may fail to build: an integration whose env vars
 * are missing must break only its own feature, as it did before, never every
 * route. Services read their own config the first time they need it.
 */
export const AppLayer = Layer.mergeAll(
  Db.layer,
  Auth.layer,
  RateLimiter.layer,
  Billing.layer,
  Google.layer,
  Mailer.layer,
  LlmModel.layer,
);

export type AppServices = Layer.Success<typeof AppLayer>;

type AppRuntime = ManagedRuntime.ManagedRuntime<AppServices, never>;

/**
 * One runtime per process, built on first use. Kept on `globalThis` for the
 * same reason as the Prisma client: every Vite HMR pass in dev re-evaluates
 * this module. The flip side is that an edited service layer needs a dev
 * server restart to take effect.
 */
const globalForRuntime = globalThis as unknown as {
  __revmeRuntime?: AppRuntime;
};

export function getRuntime(): AppRuntime {
  globalForRuntime.__revmeRuntime ??= ManagedRuntime.make(AppLayer);
  return globalForRuntime.__revmeRuntime;
}
