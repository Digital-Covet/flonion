import { Title } from "@solidjs/meta";
import User from "lucide-solid/icons/user";
import Mail from "lucide-solid/icons/mail";
import Lock from "lucide-solid/icons/lock";
import Shield from "lucide-solid/icons/shield";
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
          <h2 class="text-2xl font-semibold leading-10 tracking-tight text-foreground">
            Account Settings
          </h2>
          <p class="mt-1 text-lg leading-6 text-muted-foreground">
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
