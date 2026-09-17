import type { JSX } from "solid-js";
import { Show, splitProps } from "solid-js";

let fieldCounter = 0;
function nextId(prefix: string): string {
  fieldCounter += 1;
  return `${prefix}-${fieldCounter}`;
}

const inputBase =
  "w-full rounded-control border border-input bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60";

/**
 * Phase 1 primitive — spec anti-pattern §1.4: labels are ALWAYS visible.
 * Never placeholder-only on auth, onboarding, or booking forms (§6).
 */
export function Field(props: { children: JSX.Element; class?: string }) {
  return <div class={props.class ?? ""}>{props.children}</div>;
}

export function Label(props: JSX.LabelHTMLAttributes<HTMLLabelElement>) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: `for` is passed through `rest` by every caller (TextField/TextAreaField/AiSuggestions).
    <label
      class={`block text-sm font-medium text-foreground ${local.class ?? ""}`}
      {...rest}
    >
      {local.children}
    </label>
  );
}

interface DescribedProps {
  id?: string;
  hint?: string;
  error?: string;
}

export function Hint(props: { id: string; children: JSX.Element }) {
  return (
    <p id={props.id} class="mt-1.5 text-xs text-muted-foreground">
      {props.children}
    </p>
  );
}

export function FieldError(props: { id: string; children: JSX.Element }) {
  return (
    <p id={props.id} role="alert" class="mt-1.5 text-sm text-destructive">
      {props.children}
    </p>
  );
}

export interface TextFieldProps
  extends JSX.InputHTMLAttributes<HTMLInputElement>,
    DescribedProps {
  label: string;
  hint?: string;
  error?: string;
}

export function TextField(props: TextFieldProps) {
  const [local, rest] = splitProps(props, [
    "label",
    "hint",
    "error",
    "id",
    "class",
  ]);
  const id = () => local.id ?? nextId("field");
  const hintId = () => `${id()}-hint`;
  const errorId = () => `${id()}-error`;
  const describedBy = () =>
    [local.hint ? hintId() : "", local.error ? errorId() : ""]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <Field>
      <Label for={id()}>{local.label}</Label>
      <input
        id={id()}
        aria-invalid={Boolean(local.error) || undefined}
        aria-describedby={describedBy()}
        class={`${inputBase} mt-2 min-h-11 ${local.class ?? ""} ${local.error ? "border-destructive" : ""}`}
        {...rest}
      />
      <Show when={local.hint && !local.error}>
        <Hint id={hintId()}>{local.hint}</Hint>
      </Show>
      <Show when={local.error}>
        <FieldError id={errorId()}>{local.error}</FieldError>
      </Show>
    </Field>
  );
}

export interface TextAreaFieldProps
  extends JSX.TextareaHTMLAttributes<HTMLTextAreaElement>,
    DescribedProps {
  label: string;
  hint?: string;
  error?: string;
}

export function TextAreaField(props: TextAreaFieldProps) {
  const [local, rest] = splitProps(props, [
    "label",
    "hint",
    "error",
    "id",
    "class",
  ]);
  const id = () => local.id ?? nextId("textarea");
  const hintId = () => `${id()}-hint`;
  const errorId = () => `${id()}-error`;
  const describedBy = () =>
    [local.hint ? hintId() : "", local.error ? errorId() : ""]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <Field>
      <Label for={id()}>{local.label}</Label>
      <textarea
        id={id()}
        aria-invalid={Boolean(local.error) || undefined}
        aria-describedby={describedBy()}
        class={`${inputBase} mt-2 leading-6 ${local.class ?? ""} ${local.error ? "border-destructive" : ""}`}
        {...rest}
      />
      <Show when={local.hint && !local.error}>
        <Hint id={hintId()}>{local.hint}</Hint>
      </Show>
      <Show when={local.error}>
        <FieldError id={errorId()}>{local.error}</FieldError>
      </Show>
    </Field>
  );
}
