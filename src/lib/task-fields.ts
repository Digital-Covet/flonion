/*
 * Rules for the columns a team adds to its task table (text, number, link,
 * tags, ...). Pure functions only: the page uses them to validate what was
 * typed, and the /api/task-fields routes use the very same ones, so the two
 * can't disagree about what a value is.
 */

export const FIELD_TYPES = [
  { value: "text", label: "Text", hint: "A short line of text" },
  {
    value: "richtext",
    label: "Rich text",
    hint: "Several lines with **bold**, *italic* and links",
  },
  { value: "number", label: "Number", hint: "Quantities, costs, scores" },
  { value: "link", label: "Link", hint: "A web address or email" },
  { value: "tags", label: "Tags", hint: "Comma-separated labels" },
  { value: "checkbox", label: "Checkbox", hint: "Done or not" },
  { value: "date", label: "Date", hint: "A calendar day" },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  hint: string;
}>;

export type FieldType = (typeof FIELD_TYPES)[number]["value"];

export const isFieldType = (value: unknown): value is FieldType =>
  FIELD_TYPES.some((t) => t.value === value);

export const fieldTypeLabel = (type: FieldType): string =>
  FIELD_TYPES.find((t) => t.value === type)?.label ?? "Column";

export type FieldValue = string | number | boolean | string[];

export const MAX_FIELD_COLUMNS = 12;
export const MAX_FIELD_TITLE = 40;
const MAX_TAGS = 12;
const TEXT_LIMIT = 500;
const RICH_TEXT_LIMIT = 2000;

/** A new column's name: its type's, numbered when that is already taken. */
export function defaultFieldTitle(
  type: FieldType,
  existing: readonly string[],
): string {
  const base = fieldTypeLabel(type);
  const taken = new Set(existing.map((t) => t.toLowerCase()));
  let title = base;
  for (let n = 2; taken.has(title.toLowerCase()); n++) title = `${base} ${n}`;
  return title;
}

/** "Cost copy", then "Cost copy 2", ... for a duplicated column. */
export function copyFieldTitle(
  title: string,
  existing: readonly string[],
): string {
  const taken = new Set(existing.map((t) => t.toLowerCase()));
  const base = title.slice(0, MAX_FIELD_TITLE - " copy 99".length).trimEnd();
  let copy = `${base} copy`;
  for (let n = 2; taken.has(copy.toLowerCase()); n++)
    copy = `${base} copy ${n}`;
  return copy;
}

/** A trimmed, length-capped title; blank falls back to the type's name. */
export function normalizeFieldTitle(title: string, type: FieldType): string {
  return title.trim().slice(0, MAX_FIELD_TITLE) || fieldTypeLabel(type);
}

/**
 * Only http(s) and mailto links are ever rendered as links, so a pasted
 * `javascript:` address can never become clickable.
 */
export function safeHref(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text)
    ? text
    : text.includes("@") && !text.includes("/") && !/\s/.test(text)
      ? `mailto:${text}`
      : `https://${text}`;
  try {
    const url = new URL(candidate);
    if (!["http:", "https:", "mailto:"].includes(url.protocol)) return null;
    if (url.protocol !== "mailto:" && !url.hostname.includes(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}

export type FieldParse = { value: FieldValue | null } | { error: string };

/** Turns what was typed into a stored value, or says why it can't be one. */
export function parseFieldInput(
  type: FieldType,
  raw: string | boolean,
): FieldParse {
  if (type === "checkbox") return { value: raw === true ? true : null };
  const text = String(raw).trim();
  if (!text) return { value: null };
  switch (type) {
    case "text":
      return { value: text.slice(0, TEXT_LIMIT) };
    case "richtext":
      return { value: text.slice(0, RICH_TEXT_LIMIT) };
    case "number": {
      const n = Number(text.replace(/[,\s]/g, ""));
      return Number.isFinite(n)
        ? { value: n }
        : { error: "Enter a number, like 12 or 3.5" };
    }
    case "link": {
      const href = safeHref(text);
      return href
        ? { value: text.slice(0, TEXT_LIMIT) }
        : { error: "Enter a web address or an email" };
    }
    case "tags": {
      const seen = new Set<string>();
      const tags: string[] = [];
      for (const part of text.split(/[,;\n]/)) {
        const tag = part.trim().slice(0, 30);
        if (!tag || seen.has(tag.toLowerCase())) continue;
        seen.add(tag.toLowerCase());
        tags.push(tag);
        if (tags.length >= MAX_TAGS) break;
      }
      return { value: tags.length > 0 ? tags : null };
    }
    case "date":
      return /^\d{4}-\d{2}-\d{2}$/.test(text) &&
        !Number.isNaN(Date.parse(`${text}T00:00:00`))
        ? { value: text }
        : { error: "Pick a date" };
  }
}

const YES = new Set(["true", "yes", "y", "1", "x", "done"]);

/** A value as plain text, the common ground when a column changes type. */
function valueAsText(value: FieldValue): string | null {
  if (typeof value === "boolean") return value ? "Yes" : null;
  return Array.isArray(value) ? value.join(", ") : String(value);
}

/**
 * A value carried over to another column type, or `null` when it has no
 * sensible equivalent there (it is then dropped). Goes through plain text, so
 * "3" becomes the number 3, "a, b" becomes two tags, and "soon" can't be a date.
 */
export function convertFieldValue(
  from: FieldType,
  to: FieldType,
  value: FieldValue,
): FieldValue | null {
  if (from === to) return value;
  if (to === "checkbox") {
    if (typeof value === "number") return value !== 0 ? true : null;
    const text = valueAsText(value);
    return text !== null && YES.has(text.trim().toLowerCase()) ? true : null;
  }
  if (from === "checkbox") {
    // Only a ticked box carries over, as "Yes" or 1.
    if (to === "number") return 1;
    return to === "text" || to === "richtext" ? "Yes" : null;
  }
  const text = valueAsText(value);
  if (text === null) return null;
  const parsed = parseFieldInput(to, text);
  return "error" in parsed ? null : parsed.value;
}

/**
 * Whether a value already in storage still fits its column's type. Values
 * arrive from the database or the network, so they are checked, not trusted.
 */
export function fitsFieldType(
  type: FieldType,
  value: unknown,
): value is FieldValue {
  switch (type) {
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "checkbox":
      return value === true;
    case "tags":
      return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.length <= MAX_TAGS &&
        value.every((v) => typeof v === "string" && v.length > 0)
      );
    case "richtext":
      return (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= RICH_TEXT_LIMIT
      );
    case "link":
      return (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= TEXT_LIMIT &&
        safeHref(value) !== null
      );
    case "date":
      return (
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !Number.isNaN(Date.parse(`${value}T00:00:00`))
      );
    default:
      return (
        typeof value === "string" &&
        value.length > 0 &&
        value.length <= TEXT_LIMIT
      );
  }
}
