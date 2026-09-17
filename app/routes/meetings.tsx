import { useState } from "react";
import type { Route } from "./+types/meetings";
import { requireOperator } from "~/prisma/operator";
import {
  listMeetingRequests,
  listTeamMeetings,
  getSlotHealth,
} from "~/prisma/meetings";

export async function loader({ request }: Route.LoaderArgs) {
  await requireOperator(request);
  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") ?? "requests";

  const [requests, teamMeetings, slotHealth] = await Promise.all([
    tab === "requests" ? listMeetingRequests(url.searchParams) : null,
    tab === "team" ? listTeamMeetings(url.searchParams) : null,
    getSlotHealth(),
  ]);

  return { tab, requests, teamMeetings, slotHealth };
}

export default function MeetingsPage({ loaderData }: Route.ComponentProps) {
  const { tab, requests, teamMeetings, slotHealth } = loaderData;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Meetings</h1>

      {/* Slot Health */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Total Slots</div>
          <div className="text-2xl font-bold mt-1">{slotHealth.totalSlots}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Booked</div>
          <div className="text-2xl font-bold mt-1">{slotHealth.bookedSlots}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Free</div>
          <div className="text-2xl font-bold mt-1">{slotHealth.freeSlots}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Zero Future Slots</div>
          <div className="text-2xl font-bold mt-1">
            {slotHealth.businessesWithZeroFutureSlots}
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Orphaned Bookings</div>
          <div className="text-2xl font-bold text-red-600 mt-1">
            {slotHealth.orphanedBookings}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b mb-6">
        <a
          href="?tab=requests"
          className={`pb-2 text-sm font-medium ${
            tab === "requests"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500"
          }`}
        >
          Meeting Requests
        </a>
        <a
          href="?tab=team"
          className={`pb-2 text-sm font-medium ${
            tab === "team"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500"
          }`}
        >
          Team Meetings
        </a>
      </div>

      {/* Meeting Requests Tab */}
      {tab === "requests" && requests && (
        <div>
          <div className="mb-4">
            <form method="get" className="flex gap-2">
              <input type="hidden" name="tab" value="requests" />
              <select name="status" className="border rounded px-2 py-1.5 text-sm">
                <option value="">All status</option>
                <option value="pending">Pending</option>
                <option value="accepted">Accepted</option>
                <option value="rejected">Rejected</option>
                <option value="cancelled">Cancelled</option>
              </select>
              <select name="isGuest" className="border rounded px-2 py-1.5 text-sm">
                <option value="">All</option>
                <option value="true">Guest</option>
                <option value="false">Member</option>
              </select>
              <select name="hasMeet" className="border rounded px-2 py-1.5 text-sm">
                <option value="">All</option>
                <option value="true">Has Meet link</option>
                <option value="false">No Meet link</option>
              </select>
              <button
                type="submit"
                className="bg-blue-600 text-white px-4 py-1.5 rounded text-sm"
              >
                Filter
              </button>
            </form>
          </div>

          <div className="bg-white rounded-lg border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Time</th>
                  <th className="py-3 px-4">Business</th>
                  <th className="py-3 px-4">Requester</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Meet</th>
                  <th className="py-3 px-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {requests.rows.map((req) => (
                  <tr key={req.id} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-4">
                      {new Date(req.slot.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-4">
                      {req.slot.startTime} - {req.slot.endTime}
                    </td>
                    <td className="py-3 px-4">{req.business.name}</td>
                    <td className="py-3 px-4">
                      {req.requester ? (
                        <div>
                          <div>{req.requester.name}</div>
                          <div className="text-xs text-gray-400">
                            {req.requester.email}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div>{req.guestName ?? "Guest"}</div>
                          <div className="text-xs text-gray-400">
                            {req.guestEmail}
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          req.status === "pending"
                            ? "bg-yellow-100 text-yellow-800"
                            : req.status === "accepted"
                              ? "bg-green-100 text-green-800"
                              : req.status === "cancelled"
                                ? "bg-gray-100 text-gray-800"
                                : "bg-red-100 text-red-800"
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {req.meetUri ? "Yes" : "-"}
                    </td>
                    <td className="py-3 px-4 text-gray-500">
                      {new Date(req.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Team Meetings Tab */}
      {tab === "team" && teamMeetings && (
        <div className="bg-white rounded-lg border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Location</th>
                <th className="py-3 px-4">Business</th>
                <th className="py-3 px-4">Meet</th>
              </tr>
            </thead>
            <tbody>
              {teamMeetings.rows.map((mtg) => (
                <tr key={mtg.id} className="border-b hover:bg-gray-50">
                  <td className="py-3 px-4 font-medium">{mtg.title}</td>
                  <td className="py-3 px-4">
                    {new Date(mtg.date).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    {mtg.startTime} - {mtg.endTime}
                  </td>
                  <td className="py-3 px-4">{mtg.location}</td>
                  <td className="py-3 px-4">{mtg.business.name}</td>
                  <td className="py-3 px-4">{mtg.meetUri ? "Yes" : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
