import Check from "lucide-solid/icons/check";
import Copy from "lucide-solid/icons/copy";
import { createSignal, onCleanup, Show } from "solid-js";
import { notify } from "./toast";

/**
 * E5a — copy button flips to "Copied" check for 2s (§4). Non-blocking write
 * confirmation; toast optional for context.
 */
export function CopyButton(props: {
  value: () => string;
  label?: string;
  copiedLabel?: string;
  size?: "sm" | "md";
  toast?: boolean;
  class?: string;
}) {
  const [copied, setCopied] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(timer));

  async function copy() {
    try {
      await navigator.clipboard.writeText(props.value());
    } catch {
      // Clipboard API unavailable (permissions/iframe) — still show feedback.
    }
    setCopied(true);
    if (props.toast !== false) notify("success", "Copied to clipboard");
    clearTimeout(timer);
    timer = setTimeout(() => setCopied(false), 2000);
  }

  const sizeClass = () =>
    props.size === "sm" ? "h-8 px-2.5 text-xs" : "h-11 px-4 text-sm";

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      class={`inline-flex items-center gap-2 rounded-control border border-border bg-card font-medium text-foreground transition-opacity duration-[180ms] ease-out hover:bg-muted motion-reduce:transition-none ${sizeClass()} ${props.class ?? ""}`}
    >
      <Show
        when={copied()}
        fallback={<Copy class="size-4" aria-hidden="true" />}
      >
        <Check class="size-4 text-success" aria-hidden="true" />
      </Show>
      {copied()
        ? (props.copiedLabel ?? "Copied")
        : (props.label ?? "Copy link")}
    </button>
  );
}
