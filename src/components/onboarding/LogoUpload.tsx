import { type Component } from "solid-js";
import CloudUpload from "lucide-solid/icons/cloud-upload";

interface LogoUploadProps {
  logo: string | null;
  onChange: (logo: string | null) => void;
}

export const LogoUpload: Component<LogoUploadProps> = (props) => {
  return (
    <div class="flex flex-col gap-1.5">
      <span class="text-sm font-semibold text-foreground">
        Business Logo <span class="font-normal text-muted-foreground">(Optional)</span>
      </span>
      <div
        class="group flex w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted p-4 transition-colors hover:border-primary/50"
        role="button"
        tabindex={0}
        aria-label="Choose a business logo to upload"
      >
        <span class="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary transition-transform group-hover:-translate-y-0.5">
          <CloudUpload size={24} strokeWidth={2} aria-hidden="true" />
        </span>
        <span class="text-center text-base font-medium text-foreground">
          Drag and drop your logo here
        </span>
        <span class="mt-1 text-center text-xs text-muted-foreground">PNG, JPG up to 5MB</span>
      </div>
    </div>
  );
};
