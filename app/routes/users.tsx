import type { Route } from "./+types/users";
import { requireOperator } from "~/prisma/operator";
import { listUsers, computeStanding } from "~/prisma/users";

export async function loader({ request }: Route.LoaderArgs) {
  await requireOperator(request);
  const url = new URL(request.url);
  return listUsers(url.searchParams);
}

export default function UsersPage({ loaderData }: Route.ComponentProps) {
  const { rows, total, page, totalPages } = loaderData;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <p className="text-sm text-gray-500 mb-6">{total} total</p>

      <div className="mb-4">
        <form method="get" className="flex gap-2">
          <input
            type="text"
            name="q"
            placeholder="Search by name or email..."
            className="border rounded px-3 py-1.5 text-sm flex-1"
          />
          <select name="role" className="border rounded px-2 py-1.5 text-sm">
            <option value="">All roles</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
            <option value="designer">Designer</option>
            <option value="developer">Developer</option>
            <option value="manager">Manager</option>
            <option value="marketing">Marketing</option>
          </select>
          <select name="banned" className="border rounded px-2 py-1.5 text-sm">
            <option value="">All</option>
            <option value="true">Banned</option>
            <option value="false">Active</option>
          </select>
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
              <th className="py-3 px-4">User</th>
              <th className="py-3 px-4">Role</th>
              <th className="py-3 px-4">Standing</th>
              <th className="py-3 px-4">Verified</th>
              <th className="py-3 px-4">2FA</th>
              <th className="py-3 px-4">Banned</th>
              <th className="py-3 px-4">Sessions</th>
              <th className="py-3 px-4">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => (
              <tr key={user.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4">
                  <a
                    href={`/users/${user.id}`}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    {user.name}
                  </a>
                  <div className="text-xs text-gray-400">{user.email}</div>
                </td>
                <td className="py-3 px-4">{user.role}</td>
                <td className="py-3 px-4 text-sm">
                  {computeStanding(user)}
                </td>
                <td className="py-3 px-4">
                  {user.emailVerified ? "Yes" : "No"}
                </td>
                <td className="py-3 px-4">
                  {user.twoFactorEnabled ? "Yes" : "No"}
                </td>
                <td className="py-3 px-4">
                  {user.banned ? (
                    <span className="text-red-600 font-medium">Banned</span>
                  ) : (
                    "Active"
                  )}
                </td>
                <td className="py-3 px-4">{user._count.sessions}</td>
                <td className="py-3 px-4 text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
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
