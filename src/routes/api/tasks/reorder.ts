import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

export async function PATCH(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { businessId: true },
  });

  if (!user?.businessId) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  const businessId = user.businessId;

  try {
    const body = await event.request.json();
    const { taskId, targetColumn, newPosition } = body;

    if (typeof taskId !== "string" || typeof targetColumn !== "string" || typeof newPosition !== "number") {
      return Response.json({ error: "Invalid parameters" }, { status: 400 });
    }

    const validColumns = ["todo", "in_progress", "waiting", "done"];
    if (!validColumns.includes(targetColumn)) {
      return Response.json({ error: "Invalid column" }, { status: 400 });
    }

    const existing = await prisma.task.findUnique({
      where: { id: taskId },
      select: { businessId: true, column: true, position: true },
    });

    if (!existing || existing.businessId !== businessId) {
      return Response.json({ error: "Task not found" }, { status: 404 });
    }

    const oldColumn = existing.column;
    const oldPosition = existing.position;

    await prisma.$transaction(async (tx) => {
      if (oldColumn === targetColumn) {
        if (oldPosition < newPosition) {
          await tx.task.updateMany({
            where: {
              businessId,
              column: targetColumn,
              position: { gt: oldPosition, lte: newPosition },
            },
            data: { position: { decrement: 1 } },
          });
        } else if (oldPosition > newPosition) {
          await tx.task.updateMany({
            where: {
              businessId,
              column: targetColumn,
              position: { gte: newPosition, lt: oldPosition },
            },
            data: { position: { increment: 1 } },
          });
        }
      } else {
        await tx.task.updateMany({
          where: {
            businessId,
            column: oldColumn,
            position: { gt: oldPosition },
          },
          data: { position: { decrement: 1 } },
        });

        await tx.task.updateMany({
          where: {
            businessId,
            column: targetColumn,
            position: { gte: newPosition },
          },
          data: { position: { increment: 1 } },
        });
      }

      await tx.task.update({
        where: { id: taskId },
        data: { column: targetColumn, position: newPosition },
      });
    });

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
