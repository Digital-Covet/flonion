import { Schema } from "effect";
import { MAX_BULK_ITEMS } from "~/lib/input-limits";

/*
 * Request-body building blocks shared by route handlers. Each mirrors a Zod
 * rule it replaced, so validation accepts and rejects exactly what it did.
 */

/** Trimmed, then at most `max` characters (Zod: `.trim().max(max)`). */
export const trimmedMax = (max: number) =>
  Schema.Trim.pipe(Schema.check(Schema.isMaxLength(max)));

/** Trimmed and non-empty, at most `max` (Zod: `.trim().min(1).max(max)`). */
export const trimmedRequired = (max: number) =>
  Schema.Trim.pipe(
    Schema.check(Schema.isMinLength(1), Schema.isMaxLength(max)),
  );

/** A list position (Zod: `.int().min(0).max(10_000)`). */
export const Position = Schema.Int.pipe(
  Schema.check(Schema.isBetween({ minimum: 0, maximum: 10_000 })),
);

/** One to `MAX_BULK_ITEMS` items (Zod: `.array(item).min(1).max(...)`). */
export const bulk = <S extends Schema.Top>(item: S) =>
  Schema.Array(item).pipe(
    Schema.check(Schema.isLengthBetween(1, MAX_BULK_ITEMS)),
  );

/** `{ id, businessId }`, both non-empty strings, as the item routes need. */
export const ItemRef = Schema.Struct({
  id: Schema.NonEmptyString,
  businessId: Schema.NonEmptyString,
});
