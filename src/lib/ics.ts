/**
 * RFC 5545 iCalendar (.ics) generator for meeting invitations.
 *
 * Produces a METHOD:REQUEST calendar invite compatible with Gmail,
 * Outlook, and Apple Mail.
 */

interface IcsAttendee {
  name: string;
  email: string;
}

interface IcsParams {
  summary: string;
  description: string;
  location?: string;
  organizer: IcsAttendee;
  attendees: IcsAttendee[];
  start: Date;
  end: Date;
  timezone?: string;
}

interface IcsResult {
  raw: string;
  base64: string;
}

/**
 * Format a Date as UTC iCalendar datetime: `YYYYMMDDTHHMMSSZ`.
 */
function toUtcDatetime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/**
 * Generate a UID for the calendar event.
 */
function generateUid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Escape special characters per RFC 5545 Section 3.3.11.
 */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

/**
 * Fold long lines per RFC 5545 Section 3.1 (max 75 octets per line).
 */
function foldLine(line: string): string {
  if (line.length <= 75) return line;

  const parts: string[] = [];
  let remaining = line;

  while (remaining.length > 75) {
    // Find a safe cut point (75 chars, or 74 if next char is a multi-byte start)
    let cutAt = 75;
    // Ensure we don't cut in the middle of a UTF-8 sequence
    while (cutAt > 0 && (remaining.charCodeAt(cutAt) & 0xc0) === 0x80) {
      cutAt--;
    }
    parts.push(remaining.slice(0, cutAt));
    remaining = ` ${remaining.slice(cutAt)}`;
  }

  parts.push(remaining);
  return parts.join("\r\n");
}

/**
 * Generate an RFC 5545 compliant iCalendar REQUEST invite.
 *
 * Returns both the raw .ics string and a base64-encoded version
 * suitable for email attachments.
 */
export function generateIcsInvite(params: IcsParams): IcsResult {
  const {
    summary,
    description,
    location,
    organizer,
    attendees,
    start,
    end,
    timezone = "Asia/Kolkata",
  } = params;

  const uid = generateUid();
  const now = toUtcDatetime(new Date());
  const dtStart = toUtcDatetime(start);
  const dtEnd = toUtcDatetime(end);

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Revme//Meeting//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VTIMEZONE",
    `TZID:${timezone}`,
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0530",
    "TZOFFSETTO:+0530",
    "TZNAME:IST",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART;TZID=${timezone}:${dtStart.replace("Z", "")}`,
    `DTEND;TZID=${timezone}:${dtEnd.replace("Z", "")}`,
    `SUMMARY:${escapeText(summary)}`,
    `DESCRIPTION:${escapeText(description)}`,
  ];

  if (location) {
    lines.push(`LOCATION:${escapeText(location)}`);
  }

  lines.push(
    `ORGANIZER;CN=${escapeText(organizer.name)}:mailto:${organizer.email}`,
  );

  for (const attendee of attendees) {
    lines.push(
      `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${escapeText(attendee.name)}:mailto:${attendee.email}`,
    );
  }

  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");

  const raw = `${lines.map(foldLine).join("\r\n")}\r\n`;
  const base64 = Buffer.from(raw, "utf-8").toString("base64");

  return { raw, base64 };
}
