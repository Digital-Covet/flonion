import { createSignal, For, Show } from "solid-js";
import { Field } from "@ark-ui/solid/field";
import { FileUpload } from "@ark-ui/solid/file-upload";
import { ImagePlus, Link2, Trash2, UploadCloud } from "lucide-solid";

interface LogoUploaderProps {
  logo: string | null;
  onChange: (logo: string | null) => void;
  businessName?: string;
}

export function LogoUploader(props: LogoUploaderProps) {
  const [urlValue, setUrlValue] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);

  const handleFileAccept = (details: { files: File[] }) => {
    const file = details.files[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = () => props.onChange(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleFileReject = () => {
    setError("Image is too large or wrong format. Max 2 MB. PNG, JPG, SVG.");
  };

  const initials = () =>
    (props.businessName ?? "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase())
      .join("");

  return (
    <Field.Root>
      <Field.Label class="text-sm leading-5 font-medium text-muted-foreground">
        Business Logo
      </Field.Label>

      <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div class="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
          <Show
            when={props.logo}
            fallback={
              <Show
                when={initials()}
                fallback={
                  <div class="flex flex-col items-center gap-1 text-muted-foreground">
                    <ImagePlus size={24} />
                    <span class="text-[10px] leading-tight">No logo</span>
                  </div>
                }
              >
                <div class="flex flex-col items-center gap-1">
                  <span class="text-xl font-bold text-primary">
                    {initials()}
                  </span>
                  <span class="max-w-[80px] truncate text-[10px] leading-tight text-muted-foreground">
                    {props.businessName}
                  </span>
                </div>
              </Show>
            }
          >
            <img
              src={props.logo!}
              alt="Agency logo"
              class="h-full w-full object-contain p-2"
            />
          </Show>
        </div>

        <FileUpload.Root
          maxFiles={1}
          accept={{ "image/*": [".png", ".jpg", ".jpeg", ".svg", ".webp"] }}
          maxFileSize={2 * 1024 * 1024}
          onFileAccept={handleFileAccept}
          onFileReject={handleFileReject}
        >
          <FileUpload.Dropzone class="flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-border bg-card px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-muted/50 data-[dragging]:border-primary data-[dragging]:bg-primary/5">
            <UploadCloud size={20} class="text-primary" strokeWidth={2} />
            <p class="text-sm leading-5 font-medium text-foreground">
              Click to upload{" "}
              <span class="font-normal text-muted-foreground">
                or drag & drop
              </span>
            </p>
            <p class="text-xs leading-4 text-muted-foreground">
              PNG, JPG or SVG · max 2 MB · square works best
            </p>
          </FileUpload.Dropzone>

          <FileUpload.ItemGroup>
            <FileUpload.Context>
              {(context) => (
                <For each={context().acceptedFiles}>
                  {(file) => (
                    <FileUpload.Item
                      file={file}
                      class="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-3 py-2"
                    >
                      <div class="flex items-center gap-2 overflow-hidden">
                        <FileUpload.ItemPreview type="image/*">
                          <FileUpload.ItemPreviewImage class="h-8 w-8 rounded object-cover" />
                        </FileUpload.ItemPreview>
                        <FileUpload.ItemName class="truncate text-sm text-foreground" />
                        <FileUpload.ItemSizeText class="text-xs text-muted-foreground" />
                      </div>
                      <FileUpload.ItemDeleteTrigger class="ml-2 inline-flex items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-rose-500">
                        <Trash2 size={14} />
                      </FileUpload.ItemDeleteTrigger>
                    </FileUpload.Item>
                  )}
                </For>
              )}
            </FileUpload.Context>
          </FileUpload.ItemGroup>

          <FileUpload.HiddenInput />
        </FileUpload.Root>
      </div>

      <div class="mt-1 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div class="relative flex-1">
          <Link2
            size={16}
            class="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={urlValue()}
            onInput={(e) => setUrlValue((e.target as HTMLInputElement).value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && urlValue().trim()) {
                setError(null);
                props.onChange(urlValue().trim());
                setUrlValue("");
              }
            }}
            placeholder="…or paste an image URL"
            class="w-full rounded-lg border border-border bg-card py-2.5 pl-9 pr-3 text-sm leading-5 text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <button
          type="button"
          disabled={!urlValue().trim()}
          onClick={() => {
            setError(null);
            props.onChange(urlValue().trim());
            setUrlValue("");
          }}
          class="rounded-lg border border-border bg-card px-4 py-2.5 text-sm leading-5 font-medium text-foreground transition-colors hover:bg-muted active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Use URL
        </button>
        <Show when={props.logo}>
          <button
            type="button"
            onClick={() => props.onChange(null)}
            class="inline-flex items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm leading-5 font-medium text-rose-500 transition-colors hover:bg-rose-100 active:scale-95 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400"
          >
            <Trash2 size={16} />
            Remove
          </button>
        </Show>
      </div>

      <Show
        when={error()}
        fallback={
          <p class="text-xs leading-4 text-muted-foreground">
            Your logo appears on review replies, email digests and shared SEO
            reports.
          </p>
        }
      >
        <p class="text-xs leading-4 text-rose-500">{error()}</p>
      </Show>
    </Field.Root>
  );
}
