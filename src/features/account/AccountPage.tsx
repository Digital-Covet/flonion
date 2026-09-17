import { Title } from "@solidjs/meta";
import Lock from "lucide-solid/icons/lock";
import Mail from "lucide-solid/icons/mail";
import Shield from "lucide-solid/icons/shield";
import User from "lucide-solid/icons/user";
import { AccountInfoCard } from "./components/AccountInfoCard";
import { ChangeEmailCard } from "./components/ChangeEmailCard";
import { ChangePasswordCard } from "./components/ChangePasswordCard";
import { TwoFactorCard } from "./components/TwoFactorCard";

export function AccountPage() {
  return (
    <main class="flex-1 overflow-y-auto px-6 py-8">
      <Title>Account Settings — Cognitive Enterprise</Title>
      <div class="mx-auto max-w-4xl space-y-8">
        <div class="mb-8">
          <h1 class="font-heading text-3xl font-semibold text-foreground">
            Account Settings
          </h1>
          <p class="mt-1 text-base text-muted-foreground">
            Manage your account information, security, and authentication.
          </p>
        </div>

        <AccountInfoCard icon={User} />
        <ChangeEmailCard icon={Mail} />
        <ChangePasswordCard icon={Lock} />
        <TwoFactorCard icon={Shield} />
      </div>
    </main>
  );
}
