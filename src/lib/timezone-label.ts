/**
 * Business-timezone display helpers (Flonion DS Phase 3: no hardcoded zones).
 * Times are stored wall-clock; these helpers only label and render them in
 * the business's configured IANA zone (e.g. "Asia/Kolkata" -> "IST").
 */

export function tzLabel(timeZone?: string | null): string {
  if (!timeZone) return "Local time";
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      timeZoneName: "short",
    }).formatToParts(new Date());
    return parts.find((p) => p.type === "timeZoneName")?.value ?? timeZone;
  } catch {
    return timeZone;
  }
}

/** Offset of `timeZone` from UTC at `instantMs`, in ms (wall clock minus UTC). */
function zoneOffsetMs(instantMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instantMs));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  const wallAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return wallAsUtc - Math.floor(instantMs / 1000) * 1000;
}

/**
 * The instant at which the wall clock in `timeZone` reads `day` (YYYY-MM-DD)
 * at `time` (HH:MM). Returns null for malformed input or an unknown zone.
 */
export function zonedWallTimeToUtc(
  day: string,
  time: string,
  timeZone: string,
): Date | null {
  const dayMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(time);
  if (!dayMatch || !timeMatch) return null;

  const wallAsUtc = Date.UTC(
    Number(dayMatch[1]),
    Number(dayMatch[2]) - 1,
    Number(dayMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  if (Number.isNaN(wallAsUtc)) return null;

  try {
    // Two passes settle the offset when the first guess lands across a DST
    // transition from the target wall time.
    const firstGuess = wallAsUtc - zoneOffsetMs(wallAsUtc, timeZone);
    return new Date(wallAsUtc - zoneOffsetMs(firstGuess, timeZone));
  } catch {
    return null;
  }
}

export function formatTimeInZone(date: Date, timeZone?: string | null): string {
  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    ...(timeZone ? { timeZone } : {}),
  });
}
