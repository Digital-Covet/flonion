import { Show } from "solid-js";
import { Field } from "@ark-ui/solid/field";
import HelpCircle from "lucide-solid/icons/help-circle";
import type { FormFieldProps } from "../types";

export function FormField(props: FormFieldProps) {
  return (
    <Field.Root class={props.class} invalid={false}>
      <div class="flex items-center gap-1">
        <Field.Label
          for={props.id}
          class="text-sm leading-5 font-medium text-muted-foreground"
        >
          {props.label}
        </Field.Label>
        <Show when={props.helpTooltip}>
          <HelpCircle
            size={16}
            class="cursor-help text-muted-foreground"
            aria-label={props.helpTooltip}
          />
        </Show>
      </div>
      <Show
        when={props.multiline}
        fallback={
          <Field.Input
            id={props.id}
            type={props.type ?? "text"}
            value={props.value ?? ""}
            placeholder={props.placeholder}
            maxlength={props.maxLength}
            onInput={props.onInput}
            class="h-10 w-full rounded-lg border border-border bg-card px-4 text-sm leading-5 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        }
      >
        <Field.Textarea
          id={props.id}
          value={props.value ?? ""}
          placeholder={props.placeholder}
          rows={props.rows ?? 3}
          maxlength={props.maxLength}
          onInput={props.onInput}
          class="w-full resize-y rounded-lg border border-border bg-card px-4 py-2 text-sm leading-5 transition-all focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </Show>
      <Show when={props.hint}>
        <Field.HelperText class="text-xs leading-4 italic text-muted-foreground">
          {props.hint}
        </Field.HelperText>
      </Show>
    </Field.Root>
  );
}
