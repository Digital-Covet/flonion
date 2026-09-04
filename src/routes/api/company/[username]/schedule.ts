import type { APIEvent } from "@solidjs/start/server";
import {
  getCompanySchedule,
  MAX_SCHEDULE_RANGE_DAYS,
} from "~/lib/company-schedule";

export async function GET(event: APIEvent) {
  const username = event.params.username;

  if (!username) {
    return Response.json({ error: "Username is required" }, { status: 400 });
  }

  const url = new URL(event.request.url);

  const startDateParam = url.searchParams.get("startDate");
  const endDateParam = url.searchParams.get("endDate");

  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setHours(0, 0, 0, 0);
  const defaultEnd = new Date(defaultStart);
  defaultEnd.setDate(defaultEnd.getDate() + 7);

  const startDate = startDateParam ? new Date(startDateParam) : defaultStart;
  const endDate = endDateParam ? new Date(endDateParam) : defaultEnd;

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return Response.json({ error: "Invalid date format" }, { status: 400 });
  }

  const diffMs = endDate.getTime() - startDate.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays > MAX_SCHEDULE_RANGE_DAYS) {
    return Response.json(
      { error: `Date range cannot exceed ${MAX_SCHEDULE_RANGE_DAYS} days` },
      { status: 400 },
    );
  }

  try {
    const schedule = await getCompanySchedule(username, startDate, endDate);

    if (!schedule) {
      return Response.json({ error: "Business not found" }, { status: 404 });
    }

    return Response.json(schedule);
  } catch (err) {
    console.error("[company/schedule] query failed:", err);
    return Response.json({ error: "Failed to load schedule" }, { status: 500 });
  }
}
