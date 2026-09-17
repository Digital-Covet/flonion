import type { Route } from "./+types/marketplace";
import { requireOperator } from "~/prisma/operator";
import {
  getCategoryDistribution,
  listPartnerReadiness,
  getFavouritesLeaderboard,
  getNewArrivals,
} from "~/prisma/marketplace";

export async function loader({ request }: Route.LoaderArgs) {
  await requireOperator(request);
  const url = new URL(request.url);

  const [categories, partners, favourites, newArrivals] = await Promise.all([
    getCategoryDistribution(),
    listPartnerReadiness(url.searchParams),
    getFavouritesLeaderboard(),
    getNewArrivals(),
  ]);

  return { categories, partners, favourites, newArrivals };
}

export default function MarketplacePage({ loaderData }: Route.ComponentProps) {
  const { categories, partners, favourites, newArrivals } = loaderData;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Marketplace</h1>
      <p className="text-sm text-gray-500 mb-6">
        A view of businesses through the partner lens. Not a storefront.
      </p>

      {/* Category Distribution */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <h2 className="font-semibold mb-3">Category Distribution</h2>
        <div className="space-y-2">
          {categories.map((cat) => (
            <div key={cat.category} className="flex items-center gap-3 text-sm">
              <span className="w-40 truncate">{cat.category}</span>
              <div className="flex-1 bg-gray-100 rounded h-4">
                <div
                  className="bg-blue-500 rounded h-4"
                  style={{
                    width: `${partners.total > 0 ? (cat.count / partners.total) * 100 : 0}%`,
                  }}
                />
              </div>
              <span className="w-10 text-right text-gray-500">{cat.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Favourites Leaderboard */}
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-semibold mb-3">
            Most Favourited
            {favourites.orphanedCount > 0 && (
              <span className="text-red-500 text-xs ml-2">
                ({favourites.orphanedCount} orphaned)
              </span>
            )}
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-1">#</th>
                <th className="py-1">Business</th>
                <th className="py-1 text-right">Favs</th>
              </tr>
            </thead>
            <tbody>
              {favourites.rows.map((fav, i) => (
                <tr key={fav.businessId} className="border-b">
                  <td className="py-1 text-gray-400">{i + 1}</td>
                  <td className="py-1">{fav.businessName}</td>
                  <td className="py-1 text-right font-medium">{fav.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* New Arrivals */}
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-semibold mb-3">New Arrivals (30d)</h2>
          {newArrivals.length === 0 ? (
            <p className="text-sm text-gray-500">No new businesses.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-1">Business</th>
                  <th className="py-1">Created</th>
                </tr>
              </thead>
              <tbody>
                {newArrivals.map((biz) => (
                  <tr key={biz.id} className="border-b">
                    <td className="py-1">
                      <a
                        href={`/businesses/${biz.id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {biz.name}
                      </a>
                    </td>
                    <td className="py-1 text-gray-500">
                      {new Date(biz.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Partner-Readiness Table */}
      <div className="bg-white rounded-lg border overflow-x-auto">
        <div className="p-4 border-b">
          <h2 className="font-semibold">Partner Readiness</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-gray-500">
              <th className="py-3 px-4">Business</th>
              <th className="py-3 px-4">Sector</th>
              <th className="py-3 px-4">Services</th>
              <th className="py-3 px-4">Projects</th>
              <th className="py-3 px-4">Contacts</th>
              <th className="py-3 px-4">Slots</th>
              <th className="py-3 px-4">Score</th>
            </tr>
          </thead>
          <tbody>
            {partners.rows.map((biz) => (
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
                <td className="py-3 px-4">{biz.sector ?? "-"}</td>
                <td className="py-3 px-4">{biz.servicesCount}</td>
                <td className="py-3 px-4">{biz.projectsCount}</td>
                <td className="py-3 px-4">{biz.contactsCount}</td>
                <td className="py-3 px-4">{biz.futureSlots}</td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-100 rounded h-2">
                      <div
                        className={`rounded h-2 ${
                          biz.completeness >= 75
                            ? "bg-green-500"
                            : biz.completeness >= 50
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{ width: `${biz.completeness}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-500">
                      {biz.completeness}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
