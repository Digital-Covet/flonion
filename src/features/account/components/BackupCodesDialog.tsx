import { Show } from "solid-js";
import X from "lucide-solid/icons/x";
import Copy from "lucide-solid/icons/copy";
import Check from "lucide-solid/icons/check";
import Download from "lucide-solid/icons/download";

interface BackupCodesDialogProps {
  codes: string[];
  onClose: () => void;
  onCopy: () => void;
  copied: boolean;
}

export function BackupCodesDialog(props: BackupCodesDialogProps) {
  const downloadCodes = () => {
    const content = props.codes.join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center">
      <div
        class="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={props.onClose}
      />
      <div class="relative z-10 mx-4 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-xl">
        <button
          type="button"
          onClick={props.onClose}
          class="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div class="mb-4">
          <h3 class="text-lg font-semibold">Backup Codes</h3>
          <p class="mt-1 text-sm text-muted-foreground">
            Save these codes in a secure location. Each code can only be used
            once. If you lose access to your authenticator app, you can use
            these codes to sign in.
          </p>
        </div>

        <div class="mb-4 rounded-lg border border-border bg-muted p-4">
          <div class="grid grid-cols-2 gap-2">
            {props.codes.map((code) => (
              <code class="rounded bg-card px-2 py-1 text-center text-sm font-mono font-bold">
                {code}
              </code>
            ))}
          </div>
        </div>

        <div class="flex gap-2">
          <button
            type="button"
            onClick={props.onCopy}
            class="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Show
              when={props.copied}
              fallback={
                <>
                  <Copy size={16} />
                  Copy Codes
                </>
              }
            >
              <Check size={16} class="text-green-600" />
              Copied!
            </Show>
          </button>
          <button
            type="button"
            onClick={downloadCodes}
            class="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Download size={16} />
            Download
          </button>
        </div>

        <div class="mt-4 flex justify-end">
          <button
            type="button"
            onClick={props.onClose}
            class="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            I've saved my codes
          </button>
        </div>
      </div>
    </div>
  );
}
