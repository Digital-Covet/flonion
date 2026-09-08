import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { canManageTeam, getBusinessContext } from "~/lib/business-context";
import { getSessionFromHeaders } from "~/lib/server-auth";

/** Owner/admins may modify any task; members only tasks assigned to them. */
async function getEditableTask(event: APIEvent, taskId: string) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return { error: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const ctx = await getBusinessContext(session.user.id);
  if (!ctx) {
    return {
      error: Response.json({ error: "No business found" }, { status: 404 }),
    };
  }

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { businessId: true, assigneeId: true },
  });

  if (!task || task.businessId !== ctx.businessId) {
    return {
      error: Response.json({ error: "Task not found" }, { status: 404 }),
    };
  }

  if (!canManageTeam(ctx) && task.assigneeId !== ctx.userId) {
    return {
      error: Response.json(
        {
          error:
            "Only the assignee, an admin, or the owner can modify this task",
        },
        { status: 403 },
      ),
    };
  }

  return { ctx };
}

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = event.params.id;

  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      assignee: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });

  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  // getBusinessContext also resolves businesses for owners whose `businessId`
  // column is stale/NULL -- see the note in lib/business-context.ts.
  const ctx = await getBusinessContext(session.user.id);

  if (!ctx || task.businessId !== ctx.businessId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json(task);
}

export async function PATCH(event: APIEvent) {
  const taskId = event.params.id;

  const guard = await getEditableTask(event, taskId);
  if (guard.error) return guard.error;
  const ctx = guard.ctx;

  try {
    const body = await event.request.json();
    const { title, description, column, priority, dueDate, assigneeId } = body;

    const data: Record<string, unknown> = {};

    if (typeof title === "string" && title.trim()) {
      data.title = title.trim();
    }
    if (description !== undefined) {
      data.description = description?.trim() || null;
    }
    if (typeof column === "string") {
      const validColumns = ["todo", "in_progress", "waiting", "done"];
      if (validColumns.includes(column)) {
        data.column = column;
      }
    }
    if (typeof priority === "string") {
      const validPriorities = ["low", "medium", "high"];
      if (validPriorities.includes(priority)) {
        data.priority = priority;
      }
    }
    if (dueDate !== undefined) {
      data.dueDate = dueDate ? new Date(dueDate) : null;
    }
    if (typeof assigneeId === "string") {
      // Must be a member of this business -- see the note in tasks/index.ts.
      const assignee = await prisma.user.findFirst({
        where: { id: assigneeId, businessId: ctx.businessId },
        select: { id: true },
      });

      if (!assignee) {
        return Response.json(
          { error: "Assignee is not a member of this team" },
          { status: 400 },
        );
      }

      data.assigneeId = assigneeId;
    }

    const task = await prisma.task.update({
      where: { id: taskId },
      data,
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return Response.json(task);
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(event: APIEvent) {
  const taskId = event.params.id;

  const guard = await getEditableTask(event, taskId);
  if (guard.error) return guard.error;

  await prisma.task.delete({ where: { id: taskId } });

  return Response.json({ success: true });
}
