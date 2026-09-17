import type { Route } from "./+types/reviews";
import { requireOperator } from "~/prisma/operator";
import { listReviews, getReviewStats, setReviewStatus, redactReviewText, clearReviewerName, deleteReview } from "~/prisma/reviews";

export async function loader({ request }: Route.LoaderArgs) {
  await requireOperator(request);
  const url = new URL(request.url);
  const [page, stats] = await Promise.all([
    listReviews(url.searchParams),
    getReviewStats(),
  ]);
  return { ...page, stats };
}

export async function action({ request }: Route.ActionArgs) {
  const operator = await requireOperator(request);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const body = await request.json();
  const intent = body.intent;

  switch (intent) {
    case "hide":
      await setReviewStatus(body.id, "hidden", operator, ip);
      return { ok: true };
    case "unhide":
      await setReviewStatus(body.id, "visible", operator, ip);
      return { ok: true };
    case "flag":
      await setReviewStatus(body.id, "flagged", operator, ip);
      return { ok: true };
    case "redact":
      await redactReviewText(body.id, operator, ip);
      return { ok: true };
    case "clear-name":
      await clearReviewerName(body.id, operator, ip);
      return { ok: true };
    case "delete":
      await deleteReview(body.id, operator, ip);
      return { ok: true };
    default:
      return { ok: false, error: "Unknown intent" };
  }
}

export default function ReviewsPage({ loaderData }: Route.ComponentProps) {
  const { rows, total, page, totalPages, stats } = loaderData;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Reviews</h1>

      {/* Headline Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Total Reviews</div>
          <div className="text-2xl font-bold mt-1">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Avg Rating</div>
          <div className="text-2xl font-bold mt-1">
            {stats.avgRating != null ? stats.avgRating.toFixed(1) : "-"}
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">AI Copies</div>
          <div className="text-2xl font-bold mt-1">{stats.totalAiCopies}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Redirects</div>
          <div className="text-2xl font-bold mt-1">
            {stats.redirectConversions}
          </div>
        </div>
      </div>

      {/* Rating Distribution */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <h2 className="font-semibold mb-3">Rating Distribution</h2>
        <div className="flex gap-4">
          {[5, 4, 3, 2, 1].map((r) => {
            const count = stats.distribution[r] ?? 0;
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
            return (
              <div key={r} className="flex-1 text-center">
                <div className="text-sm text-gray-500">{r} Star</div>
                <div className="h-32 bg-gray-100 rounded relative mt-1">
                  <div
                    className="absolute bottom-0 w-full bg-blue-500 rounded"
                    style={{ height: `${pct}%` }}
                  />
                </div>
                <div className="text-xs mt-1">{count}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <form method="get" className="flex flex-wrap gap-2">
          <input
            type="text"
            name="q"
            placeholder="Search reviews..."
            className="border rounded px-3 py-1.5 text-sm flex-1"
          />
          <select name="status" className="border rounded px-2 py-1.5 text-sm">
            <option value="">All status</option>
            <option value="visible">Visible</option>
            <option value="hidden">Hidden</option>
            <option value="flagged">Flagged</option>
          </select>
          <select name="rating" className="border rounded px-2 py-1.5 text-sm">
            <option value="">All ratings</option>
            <option value="5">5 stars</option>
            <option value="4">4 stars</option>
            <option value="3">3 stars</option>
            <option value="2">2 stars</option>
            <option value="1">1 star</option>
          </select>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm"
          >
            Search
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-3 px-4">Rating</th>
              <th className="py-3 px-4">Text</th>
              <th className="py-3 px-4">Reviewer</th>
              <th className="py-3 px-4">Business</th>
              <th className="py-3 px-4">AI Copies</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Created</th>
              <th className="py-3 px-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((review) => (
              <tr key={review.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 font-bold">{review.rating}</td>
                <td className="py-3 px-4 max-w-[300px] truncate" title={review.text}>
                  {review.text.slice(0, 80)}
                  {review.text.length > 80 ? "..." : ""}
                </td>
                <td className="py-3 px-4">
                  {review.reviewerName ?? "Anonymous"}
                </td>
                <td className="py-3 px-4">
                  {review.business?.name ?? "-"}
                </td>
                <td className="py-3 px-4">
                  {review.analytics?.aiCopyCount ?? 0}
                </td>
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      review.status === "visible"
                        ? "bg-green-100 text-green-800"
                        : review.status === "hidden"
                          ? "bg-gray-100 text-gray-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {review.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-gray-500">
                  {new Date(review.createdAt).toLocaleDateString()}
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {review.status === "visible" ? (
                      <form method="post">
                        <input type="hidden" name="intent" value="hide" />
                        <input type="hidden" name="id" value={review.id} />
                        <button type="submit" className="px-2 py-1 text-xs border border-yellow-300 bg-yellow-50 text-yellow-800 rounded hover:bg-yellow-100">
                          Hide
                        </button>
                      </form>
                    ) : (
                      <form method="post">
                        <input type="hidden" name="intent" value="unhide" />
                        <input type="hidden" name="id" value={review.id} />
                        <button type="submit" className="px-2 py-1 text-xs border border-green-300 bg-green-50 text-green-800 rounded hover:bg-green-100">
                          Unhide
                        </button>
                      </form>
                    )}
                    {review.status !== "flagged" && (
                      <form method="post">
                        <input type="hidden" name="intent" value="flag" />
                        <input type="hidden" name="id" value={review.id} />
                        <button type="submit" className="px-2 py-1 text-xs border border-red-300 bg-red-50 text-red-800 rounded hover:bg-red-100">
                          Flag
                        </button>
                      </form>
                    )}
                    <form method="post">
                      <input type="hidden" name="intent" value="redact" />
                      <input type="hidden" name="id" value={review.id} />
                      <button type="submit" className="px-2 py-1 text-xs border border-orange-300 bg-orange-50 text-orange-800 rounded hover:bg-orange-100">
                        Redact
                      </button>
                    </form>
                    <form method="post">
                      <input type="hidden" name="intent" value="clear-name" />
                      <input type="hidden" name="id" value={review.id} />
                      <button type="submit" className="px-2 py-1 text-xs border border-gray-300 bg-gray-50 text-gray-800 rounded hover:bg-gray-100">
                        Clear Name
                      </button>
                    </form>
                    <form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={review.id} />
                      <button type="submit" className="px-2 py-1 text-xs border border-red-600 bg-red-600 text-white rounded hover:bg-red-700">
                        Delete
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex gap-2 mt-4 text-sm items-center">
        <span className="text-gray-500">
          Page {page} of {totalPages}
        </span>
      </div>
    </div>
  );
}
