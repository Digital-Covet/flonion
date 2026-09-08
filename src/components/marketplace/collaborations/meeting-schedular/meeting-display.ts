import type { BadgeTone, MeetingStatus } from "~/types";
import type { MeetingData } from "./MeetingDetailModal";

/**
 * Map a raw meeting status string to a display label and badge tone.
 * `rejected`/`cancelled` get their own destructive badge instead of
 * collapsing into "Pending".
 */
export function statusDisplay(status: string): {
  label: MeetingStatus;
  tone: BadgeTone;
} {
  switch (status) {
    case "accepted":
      return { label: "Confirmed", tone: "primary" };
    case "rejected":
      return { label: "Rejected", tone: "destructive" };
    case "cancelled":
      return { label: "Cancelled", tone: "destructive" };
    default:
      return { label: "Pending", tone: "orange" };
  }
}

/**
 * Name of the other party in a meeting. For incoming requests (the user
 * owns the business) that's the requester/guest; for outgoing requests
 * (the user made the request) it's the target business.
 */
export function counterpartyName(m: MeetingData): string {
  if (m.direction !== "incoming") {
    return m.business?.name || "Business";
  }
  return (
    m.requester?.name ||
    m.guestName ||
    m.requester?.email ||
    m.guestEmail ||
    "Guest"
  );
}
