import type { Route } from "./+types/feedback";
import { requireOperator } from "~/prisma/operator";
import { listFeedback } from "~/prisma/feedback";

export async function loader({ request }: Route.LoaderArgs) {
  await requireOperator(request);
  const url = new URL(request.url);
  return listFeedback(url.searchParams);
}

export default function FeedbackPage({ loaderData }: Route.ComponentProps) {
  const { rows, total, page, totalPages } = loaderData;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Support Inbox</h1>
      <p className="text-sm text-gray-500 mb-6">{total} total</p>

      {/* Filters */}
      <div className="mb-4">
        <form method="get" className="flex flex-wrap gap-2">
          <input
            type="text"
            name="q"
            placeholder="Search messages..."
            className="border rounded px-3 py-1.5 text-sm flex-1"
          />
          <select name="status" className="border rounded px-2 py-1.5 text-sm">
            <option value="">All status</option>
            <option value="new">New</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
            <option value="spam">Spam</option>
          </select>
          <select name="category" className="border rounded px-2 py-1.5 text-sm">
            <option value="">All categories</option>
            <option value="bug">Bug</option>
            <option value="feature">Feature</option>
            <option value="general">General</option>
            <option value="billing">Billing</option>
          </select>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm"
          >
            Filter
          </button>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">From</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Rating</th>
              <th className="py-3 px-4">Message</th>
              <th className="py-3 px-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((fb) => (
              <tr key={fb.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">
                  <span
                    className={`px-2 py-0.5 rounded text-xs ${
                      fb.status === "new"
                        ? "bg-blue-100 text-blue-800"
                        : fb.status === "open"
                          ? "bg-yellow-100 text-yellow-800"
                          : fb.status === "resolved"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {fb.status}
                  </span>
                </td>
                <td className="py-3 px-4">
                  <div>{fb.name}</div>
                  <div className="text-xs text-gray-400">{fb.email}</div>
                </td>
                <td className="py-3 px-4">{fb.category}</td>
                <td className="py-3 px-4">{fb.rating}</td>
                <td
                  className="py-3 px-4 max-w-[300px] truncate"
                  title={fb.message}
                >
                  {fb.message.slice(0, 80)}
                  {fb.message.length > 80 ? "..." : ""}
                </td>
                <td className="py-3 px-4 text-gray-500">
                  {new Date(fb.createdAt).toLocaleDateString()}
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
