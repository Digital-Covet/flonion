import { createSignal, For, Show, type Component } from "solid-js";
import { FileUpload } from "@ark-ui/solid/file-upload";
import CloudUpload from "lucide-solid/icons/cloud-upload";
import Trash2 from "lucide-solid/icons/trash-2";

interface LogoUploadProps {
  logo: string | null;
  onChange: (logo: string | null) => void;
}

export const LogoUpload: Component<LogoUploadProps> = (props) => {
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

  return (
    <div class="flex flex-col gap-1.5">
      <span class="text-sm font-semibold text-foreground">
        Business Logo <span class="font-normal text-muted-foreground">(Optional)</span>
      </span>

      <FileUpload.Root
        maxFiles={1}
        accept={{ "image/*": [".png", ".jpg", ".jpeg", ".svg", ".webp"] }}
        maxFileSize={2 * 1024 * 1024}
        onFileAccept={handleFileAccept}
        onFileReject={handleFileReject}
      >
        <FileUpload.Dropzone class="group flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted p-4 transition-colors hover:border-primary/50 data-[dragging]:border-primary data-[dragging]:bg-primary/5">
          <Show
            when={props.logo}
            fallback={
              <>
                <span class="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:-translate-y-0.5">
                  <CloudUpload size={24} strokeWidth={2} aria-hidden="true" />
                </span>
                <span class="text-center text-base font-medium text-foreground">
                  Drag and drop your logo here
                </span>
                <span class="mt-1 text-center text-xs text-muted-foreground">
                  PNG, JPG, SVG up to 2MB
                </span>
              </>
            }
          >
            <div class="flex items-center gap-3">
              <img
                src={props.logo!}
                alt="Business logo preview"
                class="h-16 w-16 rounded-lg object-contain"
              />
              <div class="flex flex-col gap-1">
                <span class="text-sm font-medium text-foreground">
                  Logo uploaded
                </span>
                <span class="text-xs text-muted-foreground">
                  Click or drag to replace
                </span>
              </div>
            </div>
          </Show>
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

      <Show when={error()}>
        <p class="text-xs text-rose-500">{error()}</p>
      </Show>
    </div>
  );
};
