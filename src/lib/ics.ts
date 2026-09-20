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
 *
 * Content lines are separated by CRLF, so a bare CR is just as much a line
 * break to a lenient parser as an LF is: both must collapse to the literal
 * `\n` escape or visitor-supplied text can inject its own properties.
 */
function escapeText(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n");
}

/**
 * Fold long lines per RFC 5545 Section 3.1 (max 75 octets per line).
 *
 * The limit is octets, not characters, so folding happens over the UTF-8
 * encoding. Continuation lines carry a leading space, which counts toward
 * their own 75, hence the 74-octet budget after the first line.
 */
function foldLine(line: string): string {
  const bytes = Buffer.from(line, "utf-8");
  if (bytes.length <= 75) return line;

  const parts: string[] = [];
  let offset = 0;
  let limit = 75;

  while (offset < bytes.length) {
    let end = Math.min(offset + limit, bytes.length);
    // Never split a multi-byte sequence: back up off continuation octets.
    // `end > offset + 1` guarantees at least one octet is consumed per
    // iteration, so the loop terminates on any input.
    while (
      end > offset + 1 &&
      end < bytes.length &&
      (bytes[end] & 0xc0) === 0x80
    ) {
      end--;
    }
    parts.push(bytes.subarray(offset, end).toString("utf-8"));
    offset = end;
    limit = 74;
  }

  return parts.join("\r\n ");
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
    `ORGANIZER;CN=${escapeText(organizer.name)}:mailto:${escapeText(organizer.email)}`,
  );

  for (const attendee of attendees) {
    lines.push(
      `ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;CN=${escapeText(attendee.name)}:mailto:${escapeText(attendee.email)}`,
    );
  }

  lines.push("STATUS:CONFIRMED", "END:VEVENT", "END:VCALENDAR");

  const raw = `${lines.map(foldLine).join("\r\n")}\r\n`;
  const base64 = Buffer.from(raw, "utf-8").toString("base64");

  return { raw, base64 };
}
