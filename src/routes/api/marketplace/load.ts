import { Effect } from "effect";
import { RawResponse } from "~/server/effect/errors";
import { catchAll, requireSession } from "~/server/effect/guards";
import { handler } from "~/server/effect/http";
import { Db } from "~/server/effect/services/db";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfWeek(date: Date): Date {
  const start = startOfWeek(date);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
}

interface WeekStats {
  value: number;
  detail: string;
  tone: "orange" | "primary";
  peakDay: string;
  peakDayPercent: number;
}

function computeWeekStats(
  slots: { startTime: string; endTime: string; isBooked: boolean }[],
): WeekStats {
  if (slots.length === 0) {
    return {
      value: 0,
      detail: "Open (0%)",
      tone: "primary",
      peakDay: "",
      peakDayPercent: 0,
    };
  }

  let totalMinutes = 0;
  let busyMinutes = 0;

  for (const slot of slots) {
    const start = timeToMinutes(slot.startTime);
    const end = timeToMinutes(slot.endTime);
    const duration = end - start;
    totalMinutes += duration;
    if (slot.isBooked) busyMinutes += duration;
  }

  const totalHours = totalMinutes / 60;
  const busyHours = busyMinutes / 60;
  const value = totalHours > 0 ? Math.round((busyHours / totalHours) * 100) : 0;
  const tone = value >= 70 ? "orange" : "primary";
  const label = value >= 70 ? "High" : "Open";

  return {
    value,
    detail: `${label} (${value}%)`,
    tone,
    peakDay: "",
    peakDayPercent: value,
  };
}

const failedResponse = () =>
  new RawResponse({
    response: Response.json(
      {
        thisWeek: { value: 0, detail: "Error", tone: "primary" },
        nextWeek: { value: 0, detail: "Error", tone: "primary" },
        tip: "Failed to load schedule data.",
      },
      { status: 500 },
    ),
  });

const slotSelect = {
  date: true,
  startTime: true,
  endTime: true,
  isBooked: true,
} as const;

const loadStats = Effect.fn("marketplace.load.stats")(function* (
  userId: string,
) {
  const db = yield* Db;
  const userBusiness = yield* db.use((p) =>
    p.business.findUnique({ where: { userId }, select: { id: true } }),
  );

  if (!userBusiness) {
    return {
      thisWeek: { value: 0, detail: "No business", tone: "primary" },
      nextWeek: { value: 0, detail: "No business", tone: "primary" },
      tip: "Set up your business profile to see load data.",
    };
  }

  const now = new Date();
  const thisMonday = startOfWeek(now);
  const thisSunday = endOfWeek(now);
  const nextMonday = new Date(thisMonday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const nextSunday = endOfWeek(nextMonday);

  const slotsBetween = (from: Date, to: Date) =>
    db.use((p) =>
      p.availabilitySlot.findMany({
        where: { businessId: userBusiness.id, date: { gte: from, lte: to } },
        orderBy: [{ date: "asc" }, { startTime: "asc" }],
        select: slotSelect,
      }),
    );

  const [thisWeekSlots, nextWeekSlots] = yield* Effect.all(
    [
      slotsBetween(thisMonday, thisSunday),
      slotsBetween(nextMonday, nextSunday),
    ],
    { concurrency: "unbounded" },
  );

  const thisWeekStats = computeWeekStats(thisWeekSlots);
  const nextWeekStats = computeWeekStats(nextWeekSlots);

  // Per-day load for this week to find the peak day
  const dayLoads: { day: string; percent: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const dayDate = new Date(thisMonday);
    dayDate.setDate(dayDate.getDate() + i);
    const daySlots = thisWeekSlots.filter((s) => {
      const slotDate = new Date(s.date);
      return slotDate.toDateString() === dayDate.toDateString();
    });
    if (daySlots.length === 0) continue;

    let dayTotal = 0;
    let dayBusy = 0;
    for (const s of daySlots) {
      const dur = timeToMinutes(s.endTime) - timeToMinutes(s.startTime);
      dayTotal += dur;
      if (s.isBooked) dayBusy += dur;
    }
    const pct = dayTotal > 0 ? Math.round((dayBusy / dayTotal) * 100) : 0;
    if (pct > 0) {
      dayLoads.push({ day: DAY_NAMES[dayDate.getDay()], percent: pct });
    }
  }

  dayLoads.sort((a, b) => b.percent - a.percent);
  const peakDay = dayLoads.length > 0 ? dayLoads[0] : null;

  let tip: string;
  if (thisWeekSlots.length === 0 && nextWeekSlots.length === 0) {
    tip =
      "No availability slots configured yet. Add slots to start tracking your load.";
  } else if (peakDay && peakDay.percent >= 50) {
    tip = `Consider opening more slots on ${peakDay.day} to balance your load.`;
  } else if (thisWeekStats.value >= 70) {
    tip =
      "Your schedule is heavily booked this week. Consider blocking some focus time.";
  } else {
    tip = "Your schedule looks well-balanced. Keep it up!";
  }

  return {
    thisWeek: {
      value: thisWeekStats.value,
      detail: thisWeekStats.detail,
      tone: thisWeekStats.tone,
    },
    nextWeek: {
      value: nextWeekStats.value,
      detail: nextWeekStats.detail,
      tone: nextWeekStats.tone,
    },
    tip,
  };
});

export const GET = handler(
  "marketplace.load",
  Effect.gen(function* () {
    const session = yield* requireSession();
    return yield* loadStats(session.user.id).pipe(
      catchAll((_, cause) =>
        Effect.sync(() =>
          console.error("[marketplace/load] query failed:", cause),
        ).pipe(Effect.andThen(Effect.fail(failedResponse()))),
      ),
    );
  }),
);
