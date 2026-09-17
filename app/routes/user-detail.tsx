import type { Route } from "./+types/user-detail";
import { requireOperator } from "~/prisma/operator";
import { getUser, computeStanding, setUserRole, toggleOnboarding, forceEmailVerified, revokeSession, revokeAllSessions, clear2FALockout, banUser, unbanUser, deleteUser } from "~/prisma/users";
import { redirect } from "react-router";

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireOperator(request);
  const user = await getUser(params.id);
  if (!user) throw redirect("/users");
  return user;
}

export async function action({ request, params }: Route.ActionArgs) {
  const operator = await requireOperator(request);
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;
  const body = await request.json();
  const intent = body.intent;

  switch (intent) {
    case "set-role":
      await setUserRole(params.id, body.role, operator, ip);
      return { ok: true };
    case "toggle-onboarding":
      await toggleOnboarding(params.id, operator, ip);
      return { ok: true };
    case "force-email-verified":
      await forceEmailVerified(params.id, body.verified, operator, ip);
      return { ok: true };
    case "revoke-session":
      await revokeSession(body.sessionId, operator, ip);
      return { ok: true };
    case "revoke-all-sessions":
      await revokeAllSessions(params.id, operator, ip);
      return { ok: true };
    case "clear-2fa-lockout":
      await clear2FALockout(params.id, operator, ip);
      return { ok: true };
    case "ban":
      await banUser(params.id, body.reason ?? null, body.expiresAt ?? null, operator, ip);
      return { ok: true };
    case "unban":
      await unbanUser(params.id, operator, ip);
      return { ok: true };
    case "delete":
      if (body.confirmEmail !== body.userEmail) {
        return { ok: false, error: "Email does not match" };
      }
      return deleteUser(params.id, operator, ip);
    default:
      return { ok: false, error: "Unknown intent" };
  }
}

export default function UserDetailPage({ loaderData }: Route.ComponentProps) {
  const user = loaderData;

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-6">
        <a href="/users" className="text-blue-600 hover:underline text-sm">
          &larr; Back to Users
        </a>
      </div>

      <h1 className="text-2xl font-bold mb-6">{user.name}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Identity */}
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Identity</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Name</dt>
              <dd>{user.name}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Email Verified</dt>
              <dd>{user.emailVerified ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Role</dt>
              <dd>{user.role}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Standing</dt>
              <dd>{computeStanding(user)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Onboarded</dt>
              <dd>{user.onboardingCompleted ? "Yes" : "No"}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Created</dt>
              <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
            </div>
          </dl>
        </div>

        {/* Security */}
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Security</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">2FA Enabled</dt>
              <dd>{user.twoFactorEnabled ? "Yes" : "No"}</dd>
            </div>
            {user.twofactors.map((tf) => (
              <div key={tf.id} className="flex justify-between">
                <dt className="text-gray-500">2FA Status</dt>
                <dd>
                  {tf.verified ? "Verified" : "Unverified"} | Failures:{" "}
                  {tf.failedVerificationCount ?? 0}
                  {tf.lockedUntil && " | LOCKED"}
                </dd>
              </div>
            ))}
            <div className="flex justify-between">
              <dt className="text-gray-500">Banned</dt>
              <dd className={user.banned ? "text-red-600 font-medium" : ""}>
                {user.banned ? "Yes" : "No"}
              </dd>
            </div>
            {user.banReason && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Ban Reason</dt>
                <dd>{user.banReason}</dd>
              </div>
            )}
            {user.banExpires && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Ban Expires</dt>
                <dd>{new Date(user.banExpires).toLocaleDateString()}</dd>
              </div>
            )}
          </dl>
        </div>

        {/* Google */}
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Google</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Connected</dt>
              <dd>{user.googleToken ? "Yes" : "No"}</dd>
            </div>
            {user.googleToken && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Token Expires</dt>
                <dd>
                  {new Date(user.googleToken.expiresAt).toLocaleDateString()}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Content Counts */}
        <div className="bg-white rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Content</h2>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {[
              ["Sessions", user._count.sessions],
              ["Reviews", user._count.sharedReviews],
              ["Feedback", user._count.feedback],
              ["Join Requests", user._count.joinRequests],
              ["Tasks", user._count.assignedTasks],
              ["Invitations", user._count.sentInvitations],
            ].map(([label, count]) => (
              <div key={label} className="text-center">
                <div className="text-lg font-bold">{count}</div>
                <div className="text-gray-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sessions */}
      {user.sessions.length > 0 && (
        <div className="mt-6 bg-white rounded-lg border p-4">
          <h2 className="font-semibold mb-3">
            Recent Sessions ({user.sessions.length})
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">IP</th>
                <th className="py-2">User Agent</th>
                <th className="py-2">Created</th>
                <th className="py-2">Expires</th>
                <th className="py-2">Impersonated</th>
              </tr>
            </thead>
            <tbody>
              {user.sessions.map((s) => (
                <tr key={s.id} className="border-b">
                  <td className="py-2 font-mono text-xs">{s.ipAddress ?? "-"}</td>
                  <td className="py-2 text-xs truncate max-w-[200px]">
                    {s.userAgent ?? "-"}
                  </td>
                  <td className="py-2">{new Date(s.createdAt).toLocaleDateString()}</td>
                  <td className="py-2">{new Date(s.expiresAt).toLocaleDateString()}</td>
                  <td className="py-2">{s.impersonatedBy ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Linked Accounts */}
      {user.accounts.length > 0 && (
        <div className="mt-6 bg-white rounded-lg border p-4">
          <h2 className="font-semibold mb-3">Linked Accounts</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="py-2">Provider</th>
                <th className="py-2">Scope</th>
                <th className="py-2">Created</th>
              </tr>
            </thead>
            <tbody>
              {user.accounts.map((a) => (
                <tr key={a.id} className="border-b">
                  <td className="py-2">{a.providerId}</td>
                  <td className="py-2 text-xs">{a.scope ?? "-"}</td>
                  <td className="py-2">{new Date(a.createdAt).toLocaleDateString()}</td>
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
          <form method="post">
            <input type="hidden" name="intent" value="set-role" />
            <select name="role" defaultValue={user.role} className="border rounded px-2 py-1.5 text-sm">
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="designer">Designer</option>
              <option value="developer">Developer</option>
              <option value="manager">Manager</option>
              <option value="marketing">Marketing</option>
            </select>
            <button type="submit" className="ml-2 px-3 py-1.5 bg-blue-600 text-white rounded text-sm">
              Set Role
            </button>
          </form>

          <form method="post">
            <input type="hidden" name="intent" value="toggle-onboarding" />
            <button
              type="submit"
              className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
            >
              Toggle Onboarding
            </button>
          </form>

          <form method="post">
            <input type="hidden" name="intent" value="force-email-verified" />
            <input type="hidden" name="verified" value={user.emailVerified ? "false" : "true"} />
            <button
              type="submit"
              className="px-4 py-2 border rounded text-sm hover:bg-gray-50"
            >
              {user.emailVerified ? "Unverify Email" : "Force Verify Email"}
            </button>
          </form>

          <form method="post">
            <input type="hidden" name="intent" value="revoke-all-sessions" />
            <button
              type="submit"
              className="px-4 py-2 border border-orange-300 bg-orange-50 text-orange-800 rounded text-sm hover:bg-orange-100"
            >
              Revoke All Sessions
            </button>
          </form>

          {user.twofactors.some((tf) => tf.lockedUntil) && (
            <form method="post">
              <input type="hidden" name="intent" value="clear-2fa-lockout" />
              <button
                type="submit"
                className="px-4 py-2 border border-yellow-300 bg-yellow-50 text-yellow-800 rounded text-sm hover:bg-yellow-100"
              >
                Clear 2FA Lockout
              </button>
            </form>
          )}

          {user.banned ? (
            <form method="post">
              <input type="hidden" name="intent" value="unban" />
              <button
                type="submit"
                className="px-4 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700"
              >
                Unban User
              </button>
            </form>
          ) : (
            <form method="post" className="flex gap-2 items-end">
              <input type="hidden" name="intent" value="ban" />
              <label className="flex flex-col gap-1 text-sm">
                <span className="text-gray-500">Ban Reason</span>
                <input
                  type="text"
                  name="reason"
                  className="border rounded px-3 py-1.5"
                  placeholder="Optional reason"
                />
              </label>
              <button
                type="submit"
                className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
              >
                Ban User
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Impersonate */}
      <div className="mt-6 bg-white rounded-lg border p-4">
        <h2 className="font-semibold mb-3">Impersonation</h2>
        <p className="text-sm text-gray-500 mb-3">
          Create a session as this user. You will be redirected to the tenant app
          as this user. The session expires automatically.
        </p>
        <form method="post" action="/impersonate">
          <input type="hidden" name="userId" value={user.id} />
          <button
            type="submit"
            className="px-4 py-2 bg-purple-600 text-white rounded text-sm hover:bg-purple-700"
          >
            Impersonate User
          </button>
        </form>
      </div>

      {/* Danger Zone */}
      <div className="mt-6 bg-white rounded-lg border border-red-200 p-4">
        <h2 className="font-semibold mb-3 text-red-600">Danger Zone</h2>
        <p className="text-sm text-gray-500 mb-4">
          This will permanently delete the user and cascade to their owned
          business and all child records.
        </p>
        <form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="userEmail" value={user.email} />
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-500">
              Type <strong>{user.email}</strong> to confirm
            </span>
            <input
              type="text"
              name="confirmEmail"
              className="border rounded px-3 py-1.5 max-w-sm"
              placeholder="Email address"
            />
          </label>
          <button
            type="submit"
            className="px-4 py-2 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Delete User
          </button>
        </form>
      </div>
    </div>
  );
}
