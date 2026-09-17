import type { Route } from "./+types/business-detail";
import { requireOperator } from "~/prisma/operator";
import { getBusiness, updateBusiness, clearRatingCache, resetQrCounter, deleteBusiness } from "~/prisma/businesses";
import { redirect } from "react-router";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireOperator(request);
  const business = await getBusiness(params.id);
  if (!business) throw redirect("/businesses");
  return business;
}

export async function action({ request, params }: Route.ActionArgs) {
  const operator = await requireOperator(request);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const body = await request.json();
  const intent = body.intent;

  switch (intent) {
    case "update-profile": {
      const { name, username, description, phone, address, sector, keywords, logo, reviewLink } = body;
      return updateBusiness(params.id, { name, username, description, phone, address, sector, keywords, logo, reviewLink }, operator, ip);
    }
    case "clear-rating": {
      await clearRatingCache(params.id, operator, ip);
      return { ok: true };
    }
    case "reset-qr": {
      await resetQrCounter(params.id, operator, ip);
      return { ok: true };
    }
    case "delete": {
      if (body.confirmName !== body.businessName) {
        return { ok: false, error: "Business name does not match" };
      }
      return deleteBusiness(params.id, operator, ip);
    }
    default:
      return { ok: false, error: "Unknown intent" };
  }
}

export default function BusinessDetailPage({
  loaderData,
}: Route.ComponentProps) {
  const biz = loaderData;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <a href="/businesses" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Businesses
        </a>
      </div>

      <h1 className="text-2xl font-bold mb-6">{biz.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Card */}
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Profile</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Username</dt>
              <dd>{biz.username ? `@${biz.username}` : "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Sector</dt>
              <dd>{biz.sector ?? "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Phone</dt>
              <dd>{biz.phone ?? "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Address</dt>
              <dd>{biz.address ?? "-"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Description</dt>
              <dd className="text-right max-w-[200px] truncate">
                {biz.description ?? "-"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Google Rating Card */}
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Google Rating</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Rating</dt>
              <dd className="text-lg font-bold">
                {biz.rating != null ? biz.rating.toFixed(1) : "-"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Review Count</dt>
              <dd>{biz.reviewCount ?? 0}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">QR Scans</dt>
              <dd>{biz.qrScanCount}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Last Refreshed</dt>
              <dd>
                {biz.ratingUpdatedAt
                  ? new Date(biz.ratingUpdatedAt).toLocaleDateString()
                  : "Never"}
              </dd>
            </div>
          </dl>
        </div>

        {/* Owner Card */}
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Owner</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd>{biz.user.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd>{biz.user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Onboarded</dt>
              <dd>{biz.user.onboardingCompleted ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Banned</dt>
              <dd>{biz.user.banned ? "Yes" : "No"}</dd>
            </div>
          </dl>
        </div>

        {/* Schedule Card (read-only) */}
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Schedule</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Working Days</dt>
              <dd>{biz.workingDays}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Working Hours</dt>
              <dd>
                {biz.workingStartTime} - {biz.workingEndTime}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Booking Window</dt>
              <dd>
                {biz.bookingStartTime} - {biz.bookingEndTime}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Slot Duration</dt>
              <dd>{biz.slotDuration} min</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Timezone</dt>
              <dd>{biz.timezone}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Content Counts */}
      <div className="mt-6 bg-white rounded-lg border p-4">
        <h2 className="font-semibold mb-3">Content</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
          {[
            ["Team Members", biz._count.teamMembers],
            ["Reviews", biz._count.sharedReviews],
            ["Services", biz._count.services],
            ["Projects", biz._count.projects],
            ["Contacts", biz._count.contacts],
            ["Favorites", biz._count.favoritePartners],
            ["Meetings", biz._count.meetingRequests],
            ["Tasks", biz._count.tasks],
            ["Invitations", biz._count.invitations],
            ["Join Requests", biz._count.joinRequests],
          ].map(([label, count]) => (
            <div key={label} className="text-center">
              <div className="text-lg font-bold">{count}</div>
              <div className="text-gray-500">{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Members */}
      {biz.teamMembers.length > 0 && (
        <div className="mt-6 bg-white rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Team Members</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">Name</th>
                <th className="py-2">Email</th>
                <th className="py-2">Role</th>
                <th className="py-2">Verified</th>
                <th className="py-2">2FA</th>
              </tr>
            </thead>
            <tbody>
              {biz.teamMembers.map((member) => (
                <tr key={member.id} className="border-b">
                  <td className="py-2">{member.name}</td>
                  <td className="py-2">{member.email}</td>
                  <td className="py-2">{member.role}</td>
                  <td className="py-2">{member.emailVerified ? "Yes" : "No"}</td>
                  <td className="py-2">
                    {member.twoFactorEnabled ? "Yes" : "No"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Moderation Actions */}
      <div className="mt-6 bg-white rounded-lg border p-4">
        <h2 className="font-semibold mb-3">Moderation</h2>
        <div className="flex flex-wrap gap-3">
          <a
            href={`/export/businesses.csv`}
            className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
          >
            Export CSV
          </a>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="mt-6 bg-white rounded-lg border p-4">
        <h2 className="font-semibold mb-3">Edit Profile</h2>
        <form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="update-profile" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Name</span>
              <input
                type="text"
                name="name"
                defaultValue={biz.name}
                className="border rounded px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Username</span>
              <input
                type="text"
                name="username"
                defaultValue={biz.username ?? ""}
                className="border rounded px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Phone</span>
              <input
                type="text"
                name="phone"
                defaultValue={biz.phone ?? ""}
                className="border rounded px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Sector</span>
              <input
                type="text"
                name="sector"
                defaultValue={biz.sector ?? ""}
                className="border rounded px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-gray-500">Address</span>
              <input
                type="text"
                name="address"
                defaultValue={biz.address ?? ""}
                className="border rounded px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-gray-500">Description</span>
              <textarea
                name="description"
                defaultValue={biz.description ?? ""}
                rows={3}
                className="border rounded px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-gray-500">Keywords</span>
              <input
                type="text"
                name="keywords"
                defaultValue={biz.keywords ?? ""}
                className="border rounded px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Review Link</span>
              <input
                type="text"
                name="reviewLink"
                defaultValue={biz.reviewLink ?? ""}
                className="border rounded px-3 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-gray-500">Logo URL</span>
              <input
                type="text"
                name="logo"
                defaultValue={biz.logo ?? ""}
                className="border rounded px-3 py-1.5"
              />
            </label>
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
          >
            Save Changes
          </button>
        </form>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 bg-white rounded-lg border p-4">
        <h2 className="font-semibold mb-3">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <form method="post">
            <input type="hidden" name="intent" value="clear-rating" />
            <button
              type="submit"
              className="px-4 py-2 border border-yellow-300 bg-yellow-50 text-yellow-800 rounded text-sm hover:bg-yellow-100"
            >
              Clear Rating Cache
            </button>
          </form>
          <form method="post">
            <input type="hidden" name="intent" value="reset-qr" />
            <button
              type="submit"
              className="px-4 py-2 border border-orange-300 bg-orange-50 text-orange-800 rounded text-sm hover:bg-orange-100"
            >
              Reset QR Counter
            </button>
          </form>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="mt-6 bg-white rounded-lg border border-red-200 p-4">
        <h2 className="font-semibold mb-3 text-red-600">Danger Zone</h2>
        <p className="text-sm text-gray-500 mb-4">
          This will permanently delete the business and all{" "}
          {Object.values(biz._count).reduce((a, b) => a + b, 0)} child records.
        </p>
        <form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="businessName" value={biz.name} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-500">
              Type <strong>{biz.name}</strong> to confirm
            </span>
            <input
              type="text"
              name="confirmName"
              className="border rounded px-3 py-1.5 max-w-sm"
              placeholder="Business name"
            />
          </label>
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Delete Business
          </button>
        </form>
      </div>
    </div>
  );
}
