import type { Route } from "./+types/export-businesses";
import { requireOperator } from "~/prisma/operator";
import { db } from "~/prisma/db";

/**
 * CSV export for businesses — capped at 5,000 rows.
 *
 * This is a resource route (no component), returning a CSV file.
 */
export async function loader({ request }: Route.LoaderArgs) {
  await requireOperator(request);

  const MAX_ROWS = 5_000;

  const businesses = await db.business.findMany({
    take: MAX_ROWS,
    orderBy: { createdAt: "desc" },
    select: {
      name: true,
      username: true,
      sector: true,
      rating: true,
      reviewCount: true,
      qrScanCount: true,
      createdAt: true,
      user: { select: { name: true, email: true, onboardingCompleted: true } },
      _count: { select: { teamMembers: true, sharedReviews: true } },
    },
  });

  const header = "Name,Username,Sector,Owner,Owner Email,Onboarded,Rating,Review Count,QR Scans,Team Size,Reviews,Created\n";
  const rows = businesses.map((b) =>
    [
      csvEscape(b.name),
      csvEscape(b.username ?? ""),
      csvEscape(b.sector ?? ""),
      csvEscape(b.user.name),
      csvEscape(b.user.email),
      b.user.onboardingCompleted ? "Yes" : "No",
      b.rating != null ? String(b.rating) : "",
      b.reviewCount != null ? String(b.reviewCount) : "0",
      String(b.qrScanCount),
      String(b._count.teamMembers),
      String(b._count.sharedReviews),
      b.createdAt,
    ].join(","),
  ).join("\n");

  return new Response(header + rows, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="businesses-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function csvEscape(value: string): string {
  // Names are tenant-controlled. A leading = + - @ tab or CR makes a
  // spreadsheet evaluate the cell as a formula, so prefix a quote to keep it
  // text.
  if (/^[=+\-@\t\r]/.test(value)) value = `'${value}`;
  if (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r")
  ) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
