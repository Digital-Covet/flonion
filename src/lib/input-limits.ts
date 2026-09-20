/**
 * Ceilings for hand-parsed request bodies.
 *
 * The schema maps these columns to unbounded `text`, so without a check at the
 * handler a single authenticated write can store a multi-megabyte row, or
 * thousands of rows in one call. Those rows are then read back on the
 * marketplace listing and the company profile, so the cost recurs on every
 * reader.
 *
 * Routes that already declare their own limit (`MAX_USERNAME_LENGTH`, the caps
 * in `bookings.ts`, `feedback.ts` and `share.ts`) keep it; these are for the
 * fields that had none.
 */

/** Names, roles, phone numbers, sectors — one line of text. */
export const MAX_SHORT_FIELD = 200;

/** Addresses, keywords, titles — a sentence or two. */
export const MAX_MEDIUM_FIELD = 500;

/** Descriptions and other free-text bodies. */
export const MAX_LONG_FIELD = 2000;

/** URLs stored and later rendered in `href`/`src`. */
export const MAX_URL_LENGTH = 2048;

/** Rows accepted by a single bulk-create call. */
export const MAX_BULK_ITEMS = 50;

/** Slots are generated a month at a time, so they get a larger ceiling. */
export const MAX_BULK_SLOTS = 500;

export interface FieldLimit {
  /** Name shown to the caller in the error message. */
  label: string;
  value: unknown;
  max: number;
}

/**
 * First field whose trimmed string value exceeds its limit, or null.
 *
 * Non-strings are ignored: every caller already type-checks them, and this is
 * only about size.
 */
export function findOversizedField(fields: FieldLimit[]): FieldLimit | null {
  for (const field of fields) {
    if (typeof field.value !== "string") continue;
    if (field.value.trim().length > field.max) return field;
  }
  return null;
}

/**
 * 400 naming the field that was too long, or null when everything fits.
 * Handlers return it directly:
 *
 * ```ts
 * const tooLong = oversizedFieldResponse([{ label: "Business name", value: businessName, max: MAX_SHORT_FIELD }]);
 * if (tooLong) return tooLong;
 * ```
 */
export function oversizedFieldResponse(fields: FieldLimit[]): Response | null {
  const field = findOversizedField(fields);
  if (!field) return null;
  return Response.json(
    { error: `${field.label} must be ${field.max} characters or less` },
    { status: 400 },
  );
}
