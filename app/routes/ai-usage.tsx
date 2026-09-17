import type { Route } from "./+types/ai-usage";
import { requireOperator } from "~/prisma/operator";
import { listAiUsage, getAiUsageStats } from "~/prisma/aiUsage";

export async function loader({ request }: Route.LoaderArgs) {
  await requireOperator(request);
  const url = new URL(request.url);
  const [page, stats] = await Promise.all([
    listAiUsage(url.searchParams),
    getAiUsageStats(),
  ]);
  return { ...page, stats };
}

export default function AiUsagePage({ loaderData }: Route.ComponentProps) {
  const { rows, total, page, totalPages, stats } = loaderData;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">AI Usage</h1>

      {/* Headline Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Total Calls (30d)</div>
          <div className="text-2xl font-bold mt-1">{stats.totalCalls}</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Total Cost (30d)</div>
          <div className="text-2xl font-bold mt-1">
            ${stats.totalCost.toFixed(4)}
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Success Rate</div>
          <div className="text-2xl font-bold mt-1">
            {(stats.successRate * 100).toFixed(1)}%
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Rate Limit Rejections</div>
          <div className="text-2xl font-bold mt-1 text-red-600">
            {stats.rateLimitRejections}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Prompt Tokens (30d)</div>
          <div className="text-xl font-bold mt-1">
            {stats.totalPromptTokens.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Completion Tokens (30d)</div>
          <div className="text-xl font-bold mt-1">
            {stats.totalCompletionTokens.toLocaleString()}
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-sm text-gray-500">Latency p50 / p95</div>
          <div className="text-xl font-bold mt-1">
            {stats.p50Latency}ms / {stats.p95Latency}ms
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <form method="get" className="flex flex-wrap gap-2">
          <select name="endpoint" className="border rounded px-2 py-1.5 text-sm">
            <option value="">All endpoints</option>
            <option value="draft-reply">draft-reply</option>
            <option value="suggest-review">suggest-review</option>
          </select>
          <select name="stage" className="border rounded px-2 py-1.5 text-sm">
            <option value="">All stages</option>
            <option value="sentiment">sentiment</option>
            <option value="draft">draft</option>
            <option value="suggest">suggest</option>
          </select>
          <select name="ok" className="border rounded px-2 py-1.5 text-sm">
            <option value="">All</option>
            <option value="true">Success</option>
            <option value="false">Failed</option>
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
              <th className="py-3 px-4">Time</th>
              <th className="py-3 px-4">Endpoint</th>
              <th className="py-3 px-4">Stage</th>
              <th className="py-3 px-4">Model</th>
              <th className="py-3 px-4">Tokens</th>
              <th className="py-3 px-4">Cost</th>
              <th className="py-3 px-4">Latency</th>
              <th className="py-3 px-4">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b hover:bg-gray-50">
                <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                  {new Date(row.createdAt).toLocaleString()}
                </td>
                <td className="py-3 px-4 font-mono text-xs">{row.endpoint}</td>
                <td className="py-3 px-4">{row.stage}</td>
                <td className="py-3 px-4 text-xs">{row.model}</td>
                <td className="py-3 px-4">
                  {row.promptTokens} / {row.completionTokens}
                </td>
                <td className="py-3 px-4">
                  {row.costUsd
                    ? `$${Number.parseFloat(row.costUsd).toFixed(6)}`
                    : "-"}
                </td>
                <td className="py-3 px-4">{row.latencyMs}ms</td>
                <td className="py-3 px-4">
                  {row.ok ? (
                    <span className="text-green-600">OK</span>
                  ) : (
                    <span className="text-red-600" title={row.errorKind ?? ""}>
                      FAIL
                    </span>
                  )}
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
