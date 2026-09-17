import { Field } from "@ark-ui/solid/field";
import type { LucideIcon } from "lucide-solid";
import AlertTriangle from "lucide-solid/icons/alert-triangle";
import Copy from "lucide-solid/icons/copy";
import Key from "lucide-solid/icons/key";
import ShieldCheck from "lucide-solid/icons/shield-check";
import ShieldOff from "lucide-solid/icons/shield-off";
import QRCode from "qrcode";
import { createEffect, createSignal, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { Skeleton } from "~/components/ui/skeleton";
import { notify } from "~/components/ui/toast";
import { SectionCard } from "~/features/settings/components/SectionCard";
import { authClient } from "~/lib/auth-client";
import { BackupCodesDialog } from "./BackupCodesDialog";
import { PasswordConfirmDialog } from "./PasswordConfirmDialog";

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
  const [showPasswordDialog, setShowPasswordDialog] = createSignal(false);
  const [pendingAction, setPendingAction] = createSignal<
    "enable" | "disable" | "backup-codes"
  >("enable");
  const [passwordError, setPasswordError] = createSignal("");
  const [passwordLoading, setPasswordLoading] = createSignal(false);
  // Locally-rendered TOTP QR (never sent to a third-party image service).
  const [qrDataUrl, setQrDataUrl] = createSignal<string | null>(null);

  const user = () => session()?.data?.user;

  onMount(() => {
    // Check if 2FA is enabled from session data
    const userTwoFactorEnabled = user()?.twoFactorEnabled ?? false;
    setEnabled(userTwoFactorEnabled);
    setLoading(false);
  });

  // Render the TOTP QR locally with the bundled `qrcode` lib — the secret
  // never leaves the browser for a third-party image service.
  createEffect(() => {
    const uri = totpUri();
    if (!uri) {
      setQrDataUrl(null);
      return;
    }
    QRCode.toDataURL(uri, {
      width: 400,
      margin: 2,
      errorCorrectionLevel: "M",
    }).then(setQrDataUrl, () => setQrDataUrl(null));
  });

  const handleEnable = async () => {
    setError("");
    setPendingAction("enable");
    setShowPasswordDialog(true);
  };

  const executeEnable = async (password: string) => {
    setPasswordLoading(true);
    setPasswordError("");

    try {
      const { data, error: enableError } = await authClient.twoFactor.enable({
        password,
      });

      if (enableError) {
        setPasswordError(enableError.message || "Failed to enable 2FA.");
        return;
      }

      if (data) {
        setTotpUri(data.totpURI);
        setBackupCodes(data.backupCodes);
        setShowPasswordDialog(false);
        setSetupMode(true);
      }
    } catch {
      setPasswordError("An unexpected error occurred.");
    } finally {
      setPasswordLoading(false);
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
      notify("success", "Two-factor authentication enabled");
    } catch {
      setError("An unexpected error occurred.");
    } finally {
      setVerifying(false);
    }
  };

  const handleDisable = async () => {
    setError("");
    setPendingAction("disable");
    setShowPasswordDialog(true);
  };

  const executeDisable = async (password: string) => {
    setPasswordLoading(true);
    setPasswordError("");

    try {
      const { error: disableError } = await authClient.twoFactor.disable({
        password,
      });

      if (disableError) {
        setPasswordError(disableError.message || "Failed to disable 2FA.");
        return;
      }

      setEnabled(false);
      setShowPasswordDialog(false);
      notify("success", "Two-factor authentication disabled");
    } catch {
      setPasswordError("An unexpected error occurred.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handlePasswordSubmit = (password: string) => {
    if (pendingAction() === "enable") {
      executeEnable(password);
    } else if (pendingAction() === "backup-codes") {
      executeRegenerateBackupCodes(password);
    } else {
      executeDisable(password);
    }
  };

  /**
   * Backup codes only exist in memory right after enroll. After a reload the
   * server offers no read endpoint (viewBackupCodes is server-only), so the
   * honest recovery is regenerating a fresh set — which invalidates the old
   * ones. Password-gated like enroll/disable.
   */
  const handleViewBackupCodes = async () => {
    if (backupCodes().length > 0) {
      setShowBackupDialog(true);
      return;
    }
    setPendingAction("backup-codes");
    setShowPasswordDialog(true);
  };

  const executeRegenerateBackupCodes = async (password: string) => {
    setPasswordLoading(true);
    setPasswordError("");
    try {
      const { data, error: regenError } =
        await authClient.twoFactor.generateBackupCodes({
          password,
        });
      if (regenError || !data?.backupCodes) {
        setPasswordError(
          regenError?.message || "Couldn't generate backup codes.",
        );
        return;
      }
      setBackupCodes(data.backupCodes);
      setShowPasswordDialog(false);
      setShowBackupDialog(true);
      notify(
        "success",
        "New backup codes generated",
        "Old codes no longer work.",
      );
    } catch {
      setPasswordError("An unexpected error occurred.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes().join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const copySecret = async () => {
    const secret = extractSecretFromUri();
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
      notify("success", "Secret key copied");
    } catch {
      notify("error", "Couldn't copy the secret key");
    }
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
        authentication. You'll use an authenticator app like Google
        Authenticator or Authy.
      </p>

      <Show when={loading()}>
        <div class="grid gap-3" aria-hidden="true">
          <Skeleton class="h-20 w-full" />
          <Skeleton class="h-10 w-40" />
        </div>
      </Show>

      <Show when={!loading()}>
        <div class="space-y-4">
          <Show
            when={enabled()}
            fallback={
              <Show
                when={setupMode()}
                fallback={
                  <div class="flex items-center justify-between rounded-card border border-muted p-4">
                    <div class="flex items-center gap-3">
                      <div class="flex size-10 items-center justify-center rounded-full bg-yellow-50">
                        <AlertTriangle size={20} class="text-yellow-600" />
                      </div>
                      <div>
                        <p class="text-sm font-medium">
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
                      class="inline-flex h-9 items-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                      <ShieldCheck size={16} />
                      Enable 2FA
                    </button>
                  </div>
                }
              >
                {/* Setup mode - show QR code */}
                <div class="space-y-4 rounded-card border border-border bg-card p-6">
                  <div class="flex items-center gap-3">
                    <div class="flex size-10 items-center justify-center rounded-full bg-primary/10">
                      <Key size={20} class="text-primary" />
                    </div>
                    <div>
                      <p class="text-sm font-medium">Set up authenticator app</p>
                      <p class="text-xs text-muted-foreground">
                        Scan the QR code below with your authenticator app.
                      </p>
                    </div>
                  </div>

                  <div class="flex flex-col items-center gap-4 md:flex-row">
                    <div class="flex flex-col items-center gap-2">
                      <Show
                        when={qrDataUrl()}
                        fallback={
                          <div
                            class="grid size-[200px] place-items-center rounded-card border border-border bg-muted"
                            role="status"
                          >
                            <span class="text-xs text-muted-foreground">
                              Preparing QR…
                            </span>
                          </div>
                        }
                      >
                        <img
                          src={qrDataUrl()!}
                          alt="QR Code for 2FA setup"
                          class="rounded-card border border-border"
                          width={200}
                          height={200}
                        />
                      </Show>
                      <button
                        type="button"
                        onClick={copySecret}
                        class="inline-flex h-9 items-center gap-1 px-2 text-xs text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <Copy size={12} aria-hidden="true" />
                        Copy secret key
                      </button>
                    </div>

                    <div class="flex-1 space-y-3">
                      <div class="rounded-card bg-muted p-3">
                        <p class="mb-1 text-xs font-medium text-muted-foreground">
                          Secret Key (manual entry)
                        </p>
                        <code class="break-all text-sm font-medium">
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
                          class="h-10 w-full rounded-control border border-border bg-card px-4 text-base font-mono leading-6 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
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
                          class="inline-flex h-9 items-center gap-2 rounded-control bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                        >
                          {verifying() ? "Verifying..." : "Verify & Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSetupMode(false);
                            setError("");
                          }}
                          class="h-9 rounded-control border border-border px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
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
            <div class="flex items-center justify-between rounded-card border border-success/25 bg-success-muted p-4">
              <div class="flex items-center gap-3">
                <div class="flex size-10 items-center justify-center rounded-full bg-success/15">
                  <ShieldCheck size={20} class="text-success" />
                </div>
                <div>
                  <p class="text-sm font-medium text-success">
                    Two-factor authentication is enabled
                  </p>
                  <p class="text-xs text-success">
                    Your account is protected with an authenticator app.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleViewBackupCodes}
                class="inline-flex h-9 items-center gap-2 rounded-control border border-success/40 px-4 text-sm font-medium text-success transition-colors hover:bg-success-muted"
              >
                <Key size={16} />
                Backup Codes
              </button>
            </div>

            {/* Danger zone: disabling 2FA is separated and password-gated. */}
            <div class="flex flex-col gap-3 rounded-card border border-destructive/25 bg-destructive-muted p-4 sm:flex-row sm:items-center">
              <div class="flex min-w-0 flex-1 items-center gap-3">
                <ShieldOff
                  size={20}
                  class="shrink-0 text-destructive"
                  aria-hidden="true"
                />
                <div>
                  <p class="text-sm font-medium text-foreground">
                    Disable two-factor authentication
                  </p>
                  <p class="text-xs text-muted-foreground">
                    Your account will rely on password alone. Requires your
                    current password.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleDisable}
                class="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-control bg-destructive px-4 text-sm font-medium text-white transition-opacity duration-[180ms] hover:opacity-90 motion-reduce:transition-none"
              >
                <ShieldOff size={16} aria-hidden="true" />
                Disable 2FA
              </button>
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

      <Show when={showPasswordDialog()}>
        <Portal>
          <PasswordConfirmDialog
            title={
              pendingAction() === "enable"
                ? "Enable Two-Factor Authentication"
                : pendingAction() === "backup-codes"
                  ? "Generate New Backup Codes"
                  : "Disable Two-Factor Authentication"
            }
            description={
              pendingAction() === "enable"
                ? "Enter your password to enable 2FA for your account."
                : pendingAction() === "backup-codes"
                  ? "Enter your password to generate a fresh set. Previously issued codes will stop working."
                  : "Enter your password to disable 2FA for your account."
            }
            onSubmit={handlePasswordSubmit}
            onClose={() => {
              setShowPasswordDialog(false);
              setPasswordError("");
            }}
            error={passwordError()}
            loading={passwordLoading()}
          />
        </Portal>
      </Show>
    </SectionCard>
  );
}
