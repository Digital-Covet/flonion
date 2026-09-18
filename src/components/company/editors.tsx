import { Dialog } from "@ark-ui/solid/dialog";
import { IconX } from "@tabler/icons-solidjs";
import { createSignal, type JSX, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { focusRing, inputBase, labelClass } from "~/components/auth/AuthShell";
import type {
  CompanyContact,
  CompanyProfile,
  CompanyProject,
  CompanyService,
  ContactDraft,
  ProfileDraft,
  ProjectDraft,
  ServiceDraft,
} from "~/components/company/data";
import {
  imageUrlError,
  isDataImage,
  SERVICE_ICON_OPTIONS,
} from "~/components/company/data";
import {
  btnPrimary,
  btnSecondary,
  Notice,
  SelectField,
  Spinner,
} from "~/components/onboarding/ui";
import { cn } from "~/lib/cn";

/**
 * Owner-only editors for the company profile.
 *
 * Each dialog is mounted only while it is open, so its fields are seeded from
 * the row being edited on every open rather than kept in sync with an effect.
 */

// ─── Shell and fields ────────────────────────────────────────────────────

function FormDialog(props: {
  title: string;
  description?: string;
  submitLabel: string;
  pending: boolean;
  error?: string;
  onSubmit: () => void;
  onClose: () => void;
  children: JSX.Element;
}) {
  return (
    <Dialog.Root
      open
      onOpenChange={(e) => {
        if (!e.open) props.onClose();
      }}
    >
      <Portal>
        <Dialog.Backdrop class="fixed inset-0 z-50 bg-black/40 data-[state=open]:motion-safe:animate-in data-[state=open]:motion-safe:fade-in-0" />
        <Dialog.Positioner class="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4">
          <Dialog.Content class="flex max-h-[90dvh] w-full max-w-[520px] flex-col rounded-t-xl bg-surface text-text shadow-xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:motion-safe:zoom-in-95 sm:rounded-lg">
            <div class="flex items-start gap-3 border-b border-border py-3 pr-2 pl-5">
              <div class="min-w-0 flex-1 py-1">
                <Dialog.Title class="font-display text-lg font-semibold">
                  {props.title}
                </Dialog.Title>
                <Show when={props.description}>
                  <Dialog.Description class="mt-1 text-sm text-text-muted">
                    {props.description}
                  </Dialog.Description>
                </Show>
              </div>
              <Dialog.CloseTrigger
                aria-label="Close"
                class={cn(
                  "grid size-11 shrink-0 place-items-center rounded-md text-text-muted hover:bg-background",
                  focusRing,
                )}
              >
                <IconX aria-hidden="true" class="size-5" />
              </Dialog.CloseTrigger>
            </div>

            <form
              noValidate
              onSubmit={(e) => {
                e.preventDefault();
                props.onSubmit();
              }}
              class="flex min-h-0 flex-1 flex-col"
            >
              <div class="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-5">
                <Show when={props.error}>
                  {(error) => <Notice tone="error">{error()}</Notice>}
                </Show>
                {props.children}
              </div>

              <div class="flex flex-col-reverse gap-2 border-t border-border p-4 sm:flex-row sm:justify-end">
                <Dialog.CloseTrigger class={btnSecondary}>
                  Cancel
                </Dialog.CloseTrigger>
                <button
                  type="submit"
                  disabled={props.pending}
                  class={cn(
                    btnPrimary,
                    "disabled:cursor-progress disabled:opacity-80",
                  )}
                >
                  <Show when={props.pending}>
                    <Spinner />
                  </Show>
                  {props.submitLabel}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Positioner>
      </Portal>
    </Dialog.Root>
  );
}

function Field(props: {
  id: string;
  label: string;
  value: string;
  onInput: (value: string) => void;
  hint?: string;
  placeholder?: string;
  type?: string;
  /** Renders a textarea instead of a single-line input. */
  rows?: number;
}) {
  return (
    <div class="flex flex-col gap-1.5">
      <label for={props.id} class={labelClass}>
        {props.label}
      </label>
      <Show
        when={props.rows}
        fallback={
          <input
            id={props.id}
            type={props.type ?? "text"}
            value={props.value}
            placeholder={props.placeholder}
            onInput={(e) => props.onInput(e.currentTarget.value)}
            class={inputBase}
          />
        }
      >
        {(rows) => (
          <textarea
            id={props.id}
            rows={rows()}
            value={props.value}
            placeholder={props.placeholder}
            onInput={(e) => props.onInput(e.currentTarget.value)}
            class={cn(inputBase, "min-h-24 resize-y py-2 leading-relaxed")}
          />
        )}
      </Show>
      <Show when={props.hint}>
        <p class="text-xs text-text-muted">{props.hint}</p>
      </Show>
    </div>
  );
}

/** Shared submit plumbing: validate, call the API, surface one error. */
function useSubmit(onDone: () => void) {
  const [pending, setPending] = createSignal(false);
  const [error, setError] = createSignal<string>();

  const run = (validate: () => string | null, save: () => Promise<void>) => {
    const invalid = validate();
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(undefined);
    setPending(true);
    save()
      .then(onDone)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Something went wrong."),
      )
      .finally(() => setPending(false));
  };

  return { pending, error, run };
}

// ─── Profile details ─────────────────────────────────────────────────────

export function ProfileDialog(props: {
  profile: CompanyProfile;
  onSave: (draft: ProfileDraft) => Promise<void>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const stored = props.profile.logo ?? "";
  // A logo uploaded during onboarding is a multi-kilobyte data URI. Showing it
  // raw in a text field is unusable, so the field starts empty and the upload
  // is kept unless the owner pastes a link over it.
  const uploaded = isDataImage(stored);

  const [draft, setDraft] = createSignal<ProfileDraft>({
    businessName: props.profile.name,
    description: props.profile.description ?? "",
    sector: props.profile.sector ?? "",
    address: props.profile.address ?? "",
    phone: props.profile.phone ?? "",
    logo: uploaded ? "" : stored,
  });
  const set = (patch: Partial<ProfileDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const logoToSave = () =>
    uploaded && !draft().logo.trim() ? stored : draft().logo;

  const { pending, error, run } = useSubmit(props.onSaved);

  return (
    <FormDialog
      title="Edit profile"
      description="This is what partners see when they open your page."
      submitLabel="Save profile"
      pending={pending()}
      error={error()}
      onClose={props.onClose}
      onSubmit={() =>
        run(
          () =>
            !draft().businessName.trim()
              ? "Your business needs a name."
              : imageUrlError(draft().logo, false),
          () => props.onSave({ ...draft(), logo: logoToSave() }),
        )
      }
    >
      <Field
        id="profile-name"
        label="Business name"
        value={draft().businessName}
        onInput={(businessName) => set({ businessName })}
      />
      <Field
        id="profile-description"
        label="About"
        rows={4}
        placeholder="What you do, who you do it for, and what makes you worth a call."
        value={draft().description}
        onInput={(description) => set({ description })}
      />
      <Field
        id="profile-sector"
        label="Sector"
        placeholder="e.g. Digital marketing"
        value={draft().sector}
        onInput={(sector) => set({ sector })}
      />
      <Field
        id="profile-address"
        label="Location"
        placeholder="e.g. Andheri East, Mumbai"
        value={draft().address}
        onInput={(address) => set({ address })}
      />
      <Field
        id="profile-phone"
        label="Phone"
        type="tel"
        value={draft().phone}
        onInput={(phone) => set({ phone })}
      />
      <div class="flex items-end gap-3">
        <Show when={uploaded}>
          <img
            src={stored}
            alt=""
            width="44"
            height="44"
            class="size-11 shrink-0 rounded-md border border-border object-cover"
          />
        </Show>
        <div class="min-w-0 flex-1">
          <Field
            id="profile-logo"
            label="Logo link"
            type="url"
            placeholder="https://…"
            hint={
              uploaded
                ? "You already have a logo uploaded. Paste a link only to replace it."
                : "A square image reads best. Leave it blank to show your initial."
            }
            value={draft().logo}
            onInput={(logo) => set({ logo })}
          />
        </div>
      </div>
    </FormDialog>
  );
}

// ─── Services ────────────────────────────────────────────────────────────

export function ServiceDialog(props: {
  /** Absent when adding. */
  service?: CompanyService;
  onSave: (draft: ServiceDraft) => Promise<void>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = createSignal<ServiceDraft>({
    icon: props.service?.icon ?? "box",
    title: props.service?.title ?? "",
    description: props.service?.description ?? "",
  });
  const set = (patch: Partial<ServiceDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const { pending, error, run } = useSubmit(props.onSaved);

  return (
    <FormDialog
      title={props.service ? "Edit service" : "Add a service"}
      description="One line per thing you sell. Partners scan these before they call."
      submitLabel={props.service ? "Save service" : "Add service"}
      pending={pending()}
      error={error()}
      onClose={props.onClose}
      onSubmit={() =>
        run(
          () =>
            !draft().title.trim()
              ? "Give the service a name."
              : !draft().description.trim()
                ? "Add a short description."
                : null,
          () =>
            props.onSave({
              icon: draft().icon,
              title: draft().title.trim(),
              description: draft().description.trim(),
            }),
        )
      }
    >
      <SelectField
        label="Icon"
        options={SERVICE_ICON_OPTIONS}
        value={draft().icon}
        onChange={(icon) => set({ icon: icon || "box" })}
      />
      <Field
        id="service-title"
        label="Service"
        placeholder="e.g. Google Ads management"
        value={draft().title}
        onInput={(title) => set({ title })}
      />
      <Field
        id="service-description"
        label="Description"
        rows={3}
        placeholder="What the client gets, in a sentence."
        value={draft().description}
        onInput={(description) => set({ description })}
      />
    </FormDialog>
  );
}

// ─── Work ────────────────────────────────────────────────────────────────

export function ProjectDialog(props: {
  /** Absent when adding. */
  project?: CompanyProject;
  onSave: (draft: ProjectDraft) => Promise<void>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = createSignal<ProjectDraft>({
    imageUrl: props.project?.imageUrl ?? "",
    altText: props.project?.altText ?? "",
  });
  const set = (patch: Partial<ProjectDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const { pending, error, run } = useSubmit(props.onSaved);

  return (
    <FormDialog
      title={props.project ? "Edit work" : "Add work"}
      description="Link an image you already host — a case study shot, a campaign, a build."
      submitLabel={props.project ? "Save work" : "Add work"}
      pending={pending()}
      error={error()}
      onClose={props.onClose}
      onSubmit={() =>
        run(
          () =>
            imageUrlError(draft().imageUrl, true) ??
            (!draft().altText.trim()
              ? "Describe the image so screen readers can announce it."
              : null),
          () =>
            props.onSave({
              imageUrl: draft().imageUrl.trim(),
              altText: draft().altText.trim(),
            }),
        )
      }
    >
      <Field
        id="project-image"
        label="Image link"
        type="url"
        placeholder="https://…"
        value={draft().imageUrl}
        onInput={(imageUrl) => set({ imageUrl })}
      />
      <Show
        when={
          imageUrlError(draft().imageUrl, false) === null &&
          draft().imageUrl.trim()
        }
      >
        <img
          src={draft().imageUrl.trim()}
          alt=""
          class="aspect-[4/3] w-full rounded-md border border-border bg-background object-cover"
        />
      </Show>
      <Field
        id="project-alt"
        label="Caption"
        placeholder="e.g. Rebrand for a Bandra café"
        hint="Doubles as the image's alt text."
        value={draft().altText}
        onInput={(altText) => set({ altText })}
      />
    </FormDialog>
  );
}

// ─── Contacts ────────────────────────────────────────────────────────────

export function ContactDialog(props: {
  /** Absent when adding. */
  contact?: CompanyContact;
  onSave: (draft: ContactDraft) => Promise<void>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = createSignal<ContactDraft>({
    name: props.contact?.name ?? "",
    role: props.contact?.role ?? "",
    email: props.contact?.email ?? "",
    avatarUrl: props.contact?.avatarUrl ?? "",
  });
  const set = (patch: Partial<ContactDraft>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const { pending, error, run } = useSubmit(props.onSaved);

  return (
    <FormDialog
      title={props.contact ? "Edit contact" : "Add a contact"}
      description="Who a partner should reach out to, and what they handle."
      submitLabel={props.contact ? "Save contact" : "Add contact"}
      pending={pending()}
      error={error()}
      onClose={props.onClose}
      onSubmit={() =>
        run(
          () =>
            !draft().name.trim()
              ? "Add the person's name."
              : !draft().role.trim()
                ? "Add their role."
                : imageUrlError(draft().avatarUrl, false),
          () =>
            props.onSave({
              name: draft().name.trim(),
              role: draft().role.trim(),
              email: draft().email.trim(),
              avatarUrl: draft().avatarUrl.trim(),
            }),
        )
      }
    >
      <Field
        id="contact-name"
        label="Name"
        value={draft().name}
        onInput={(name) => set({ name })}
      />
      <Field
        id="contact-role"
        label="Role"
        placeholder="e.g. Partnerships lead"
        value={draft().role}
        onInput={(role) => set({ role })}
      />
      <Field
        id="contact-email"
        label="Email"
        type="email"
        value={draft().email}
        onInput={(email) => set({ email })}
      />
      <Field
        id="contact-avatar"
        label="Photo link"
        type="url"
        placeholder="https://…"
        value={draft().avatarUrl}
        onInput={(avatarUrl) => set({ avatarUrl })}
      />
    </FormDialog>
  );
}
