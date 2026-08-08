import { createSignal, Show, onMount } from "solid-js";
import { Field } from "@ark-ui/solid/field";
import { Portal } from "solid-js/web";
import type { LucideIcon } from "lucide-solid";
import ShieldCheck from "lucide-solid/icons/shield-check";
import ShieldOff from "lucide-solid/icons/shield-off";
import Key from "lucide-solid/icons/key";
import Copy from "lucide-solid/icons/copy";
import Check from "lucide-solid/icons/check";
import AlertTriangle from "lucide-solid/icons/alert-triangle";
import { authClient } from "~/lib/auth-client";
import { SectionCard } from "~/features/settings/components/SectionCard";
import { BackupCodesDialog } from "./BackupCodesDialog";

interface TwoFactorCardProps {
  icon: LucideIcon;
}

export function TwoFactorCard(props: TwoFactorCardProps) {
  const session = authClient.useSession();

  const [enabled, setEnabled] = createSignal(false);
  const [loading, setLoading] = createSignal(true);
  const [setupMode, setSetupMode] = createSignal(false);
  const [totpUri, setTotpUri] = createSignal("");
  const [backupCodes, setBackupCodes] = createSignal<string[]>([]);
  const [verifyCode, setVerifyCode] = createSignal("");
  const [verifying, setVerifying] = createSignal(false);
  const [error, setError] = createSignal("");
  const [showBackupDialog, setShowBackupDialog] = createSignal(false);
  const [copied, setCopied] = createSignal(false);

  const user = () => session()?.data?.user;

  onMount(() => {
    // Check if 2FA is enabled from session data
    const userTwoFactorEnabled = user()?.twoFactorEnabled ?? false;
    setEnabled(userTwoFactorEnabled);
    setLoading(false);
  });

  const handleEnable = async () => {
    setError("");
    setSetupMode(true);

    try {
      const { data, error: enableError } = await authClient.twoFactor.enable({
        password: "", // Will need password dialog
      });

      if (enableError) {
        setError(enableError.message || "Failed to enable 2FA.");
        setSetupMode(false);
        return;
      }

      if (data) {
        setTotpUri(data.totpURI);
        setBackupCodes(data.backupCodes);
      }
    } catch {
      setError("An unexpected error occurred.");
      setSetupMode(false);
    }
  };

  const handleVerify = async () => {
    setError("");
    setVerifying(true);

    try {
      const { error: verifyError } = await authClient.twoFactor.verifyTotp({
        code: verifyCode(),
        trustDevice: true,
      });

      if (verifyError) {
        setError(verifyError.message || "Invalid code. Please try again.");
        return;
      }

      setEnabled(true);
      setSetupMode(false);
      setShowBackupDialog(true);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setVerifying(false);
    }
  };

  const handleDisable = async () => {
    setError("");
    setLoading(true);

    try {
      const { error: disableError } = await authClient.twoFactor.disable({
        password: "", // Will need password
      });

      if (disableError) {
        setError(disableError.message || "Failed to disable 2FA.");
        return;
      }

      setEnabled(false);
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewBackupCodes = async () => {
    setShowBackupDialog(true);
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes().join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const extractSecretFromUri = () => {
    const uri = totpUri();
    const match = uri.match(/secret=([A-Z0-9]+)/i);
    return match ? match[1] : "";
  };

  return (
    <SectionCard title="Two-Factor Authentication" icon={props.icon}>
      <p class="mb-4 text-sm text-muted-foreground">
        Add an extra layer of security to your account by enabling two-factor
        authentication. You'll use an authenticator app like Google Authenticator
        or Authy.
      </p>

      <Show when={!loading()}>
        <div class="space-y-4">
          <Show
            when={enabled()}
            fallback={
              <Show
                when={setupMode()}
                fallback={
                  <div class="flex items-center justify-between rounded-lg border border-muted p-4">
                    <div class="flex items-center gap-3">
                      <div class="flex size-10 items-center justify-center rounded-full bg-yellow-50">
                        <AlertTriangle size={20} class="text-yellow-600" />
                      </div>
                      <div>
                        <p class="text-sm font-bold">
                          Two-factor authentication is not enabled
                        </p>
                        <p class="text-xs text-muted-foreground">
                          We recommend enabling 2FA for better account security.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleEnable}
                      class="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <ShieldCheck size={16} />
                      Enable 2FA
                    </button>
                  </div>
                }
              >
                {/* Setup mode - show QR code */}
                <div class="space-y-4 rounded-lg border border-border bg-card p-6">
                  <div class="flex items-center gap-3">
                    <div class="flex size-10 items-center justify-center rounded-full bg-primary/10">
                      <Key size={20} class="text-primary" />
                    </div>
                    <div>
                      <p class="text-sm font-bold">Set up authenticator app</p>
                      <p class="text-xs text-muted-foreground">
                        Scan the QR code below with your authenticator app.
                      </p>
                    </div>
                  </div>

                  <div class="flex flex-col items-center gap-4 md:flex-row">
                    <div class="flex flex-col items-center gap-2">
                      {totpUri() && (
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpUri())}`}
                          alt="QR Code for 2FA setup"
                          class="rounded-lg border border-border"
                          width={200}
                          height={200}
                        />
                      )}
                      <button
                        type="button"
                        onClick={copyBackupCodes}
                        class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <Copy size={12} />
                        Copy secret key
                      </button>
                    </div>

                    <div class="flex-1 space-y-3">
                      <div class="rounded-lg bg-muted p-3">
                        <p class="mb-1 text-xs font-medium text-muted-foreground">
                          Secret Key (manual entry)
                        </p>
                        <code class="break-all text-sm font-bold">
                          {extractSecretFromUri() || "Loading..."}
                        </code>
                      </div>

                      <Field.Root invalid={!!error()}>
                        <Field.Label
                          for="totp-code"
                          class="text-sm font-medium text-muted-foreground"
                        >
                          Enter verification code
                        </Field.Label>
                        <Field.Input
                          id="totp-code"
                          type="text"
                          value={verifyCode()}
                          onInput={(e) =>
                            setVerifyCode((e.target as HTMLInputElement).value)
                          }
                          placeholder="000000"
                          maxlength={6}
                          class="h-10 w-full rounded-lg border border-border bg-card px-4 text-sm font-mono leading-5 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <Show when={error()}>
                          <Field.ErrorText class="text-sm text-destructive">
                            {error()}
                          </Field.ErrorText>
                        </Show>
                      </Field.Root>

                      <div class="flex gap-2">
                        <button
                          type="button"
                          onClick={handleVerify}
                          disabled={verifying() || verifyCode().length < 6}
                          class="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                          {verifying() ? "Verifying..." : "Verify & Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSetupMode(false);
                            setError("");
                          }}
                          class="h-9 rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </Show>
            }
          >
            {/* 2FA is enabled */}
            <div class="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 p-4">
              <div class="flex items-center gap-3">
                <div class="flex size-10 items-center justify-center rounded-full bg-green-100">
                  <ShieldCheck size={20} class="text-green-600" />
                </div>
                <div>
                  <p class="text-sm font-bold text-green-800">
                    Two-factor authentication is enabled
                  </p>
                  <p class="text-xs text-green-600">
                    Your account is protected with an authenticator app.
                  </p>
                </div>
              </div>
              <div class="flex gap-2">
                <button
                  type="button"
                  onClick={handleViewBackupCodes}
                  class="inline-flex h-9 items-center gap-2 rounded-lg border border-green-300 px-4 text-sm font-medium text-green-700 transition-colors hover:bg-green-100"
                >
                  <Key size={16} />
                  Backup Codes
                </button>
                <button
                  type="button"
                  onClick={handleDisable}
                  class="inline-flex h-9 items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <ShieldOff size={16} />
                  Disable
                </button>
              </div>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={showBackupDialog()}>
        <Portal>
          <BackupCodesDialog
            codes={backupCodes()}
            onClose={() => setShowBackupDialog(false)}
            onCopy={copyBackupCodes}
            copied={copied()}
          />
        </Portal>
      </Show>
    </SectionCard>
  );
}
