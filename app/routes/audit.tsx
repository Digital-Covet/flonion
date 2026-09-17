import type { Route } from "./+types/audit";
import { requireOperator } from "~/prisma/operator";
import { db } from "~/prisma/db";
import { parsePageParams, offset, orderBy, pageResult } from "~/prisma/paging";
import { formatDateTime } from "~/prisma/time";

export async function loader({ request }: Route.LoaderArgs) {
  await requireOperator(request);

  const url = new URL(request.url);
  const params = parsePageParams(url.searchParams, {
    createdAt: "createdAt",
    operatorId: "operatorId",
    entity: "entity",
    action: "action",
  });

  const where: Record<string, unknown> = {};

  const entity = url.searchParams.get("entity");
  if (entity) where.entity = entity;

  const action = url.searchParams.get("action");
  if (action) where.action = { contains: action, mode: "insensitive" };

  const operatorId = url.searchParams.get("operatorId");
  if (operatorId) where.operatorId = operatorId;

  const entityId = url.searchParams.get("entityId");
  if (entityId) where.entityId = entityId;

  const search = url.searchParams.get("q");
  if (search) {
    where.OR = [
      { action: { contains: search, mode: "insensitive" } },
      { entity: { contains: search, mode: "insensitive" } },
      { entityId: { contains: search, mode: "insensitive" } },
      { note: { contains: search, mode: "insensitive" } },
    ];
  }

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: orderBy(params.sort, params.dir),
      skip: offset(params),
      take: params.size,
    }),
    db.auditLog.count({ where }),
  ]);

  return pageResult(rows, total, params);
}

export default function AuditLogPage({ loaderData }: Route.ComponentProps) {
  const { rows, total, page, size, totalPages } = loaderData;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Audit Log</h1>
      <p className="text-sm text-gray-500 mb-6">
        {total} total entries
      </p>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-gray-500">
            <th className="py-2">Time</th>
            <th className="py-2">Operator</th>
            <th className="py-2">Action</th>
            <th className="py-2">Entity</th>
            <th className="py-2">Entity ID</th>
            <th className="py-2">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="border-b">
              <td className="py-2 whitespace-nowrap">
                {formatDateTime(row.createdAt)}
              </td>
              <td className="py-2">{row.operatorId}</td>
              <td className="py-2 font-mono text-xs">{row.action}</td>
              <td className="py-2">{row.entity}</td>
              <td className="py-2 font-mono text-xs truncate max-w-[200px]">
                {row.entityId}
              </td>
              <td className="py-2 text-gray-500 truncate max-w-[200px]">
                {row.note ?? ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex gap-2 mt-4 text-sm">
        <span>
          Page {page} of {totalPages}
        </span>
      </div>
    </div>
  );
}
