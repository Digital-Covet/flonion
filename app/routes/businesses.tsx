import type { Route } from "./+types/businesses";
import { requireOperator } from "~/prisma/operator";
import { listBusinesses } from "~/prisma/businesses";

export async function loader({ request }: Route.LoaderArgs) {
  await requireOperator(request);
  const url = new URL(request.url);
  return listBusinesses(url.searchParams);
}

export default function BusinessesPage({
  loaderData,
}: Route.ComponentProps) {
  const { rows, total, page, totalPages } = loaderData;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Businesses</h1>
      <p className="text-sm text-gray-500 mb-6">{total} total</p>

      <div className="mb-4">
        <form method="get" className="flex gap-2">
          <input
            type="text"
            name="q"
            placeholder="Search businesses..."
            className="border rounded px-3 py-1.5 text-sm flex-1"
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm"
          >
            Search
          </button>
        </form>
      </div>

      <div className="bg-white rounded-lg border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-3 px-4">Business</th>
              <th className="py-3 px-4">Owner</th>
              <th className="py-3 px-4">Sector</th>
              <th className="py-3 px-4">Rating</th>
              <th className="py-3 px-4">Reviews</th>
              <th className="py-3 px-4">QR Scans</th>
              <th className="py-3 px-4">Team</th>
              <th className="py-3 px-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((biz) => (
              <tr key={biz.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">
                  <a
                    href={`/businesses/${biz.id}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {biz.name}
                  </a>
                  {biz.username && (
                    <span className="text-gray-400 text-xs ml-1">
                      @{biz.username}
                    </span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div>{biz.user.name}</div>
                  <div className="text-xs text-gray-400">{biz.user.email}</div>
                </td>
                <td className="py-3 px-4">{biz.sector ?? "-"}</td>
                <td className="py-3 px-4">
                  {biz.rating != null ? biz.rating.toFixed(1) : "-"}
                </td>
                <td className="py-3 px-4">{biz.reviewCount ?? 0}</td>
                <td className="py-3 px-4">{biz.qrScanCount}</td>
                <td className="py-3 px-4">{biz._count.teamMembers}</td>
                <td className="py-3 px-4 text-gray-500">
                  {new Date(biz.createdAt).toLocaleDateString()}
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
