import { createAuthClient } from "better-auth/solid";
import { emailOTPClient } from "better-auth/client/plugins";
import { twoFactorClient } from "better-auth/client/plugins";

export const authClient = createAuthClient({
  plugins: [
    emailOTPClient(),
    twoFactorClient({
      twoFactorPage: "/2fa",
    }),
  ],
});
