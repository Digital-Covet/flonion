import { Effect } from "effect";
import {
  getCompanySchedule,
  MAX_SCHEDULE_RANGE_DAYS,
} from "~/lib/company-schedule";
import { BadRequest, NotFound, UpstreamError } from "~/server/effect/errors";
import { recoverAll } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { RequestContext } from "~/server/effect/request-context";

export const GET = handler(
  "company.schedule",
  Effect.gen(function* () {
    const { params, url } = yield* RequestContext;
    const username = params.username;
    if (!username) {
      return yield* new BadRequest({ message: "Username is required" });
    }

    const startDateParam = url.searchParams.get("startDate");
    const endDateParam = url.searchParams.get("endDate");

    const defaultStart = new Date();
    defaultStart.setHours(0, 0, 0, 0);
    const defaultEnd = new Date(defaultStart);
    defaultEnd.setDate(defaultEnd.getDate() + 7);

    const startDate = startDateParam ? new Date(startDateParam) : defaultStart;
    const endDate = endDateParam ? new Date(endDateParam) : defaultEnd;

    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return yield* new BadRequest({ message: "Invalid date format" });
    }

    const diffDays = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    if (diffDays > MAX_SCHEDULE_RANGE_DAYS) {
      return yield* new BadRequest({
        message: `Date range cannot exceed ${MAX_SCHEDULE_RANGE_DAYS} days`,
      });
    }

    const schedule = yield* getCompanySchedule(
      username,
      startDate,
      endDate,
    ).pipe(
      Effect.tapCause((cause) =>
        Effect.sync(() =>
          console.error("[company/schedule] query failed:", cause),
        ),
      ),
      recoverAll(
        new UpstreamError({ status: 500, message: "Failed to load schedule" }),
      ),
    );
    if (!schedule) {
      return yield* new NotFound({ message: "Business not found" });
    }
    return schedule;
  }),
);
