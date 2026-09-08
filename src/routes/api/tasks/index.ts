import type { APIEvent } from "@solidjs/start/server";
import { prisma } from "~/db/prisma";
import { getBusinessContext } from "~/lib/business-context";
import { getSessionFromHeaders } from "~/lib/server-auth";

export async function GET(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // getBusinessContext also resolves businesses for owners whose `businessId`
  // column is stale/NULL -- see the note in lib/business-context.ts.
  const ctx = await getBusinessContext(session.user.id);

  if (!ctx) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  const url = new URL(event.request.url);
  const assigneeId = url.searchParams.get("assigneeId");

  const where: Record<string, unknown> = { businessId: ctx.businessId };
  if (assigneeId) {
    where.assigneeId = assigneeId;
  }

  const tasks = await prisma.task.findMany({
    where,
    include: {
      assignee: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
    orderBy: [{ column: "asc" }, { position: "asc" }],
  });

  return Response.json(tasks);
}

export async function POST(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await getBusinessContext(session.user.id);

  if (!ctx) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  try {
    const body = await event.request.json();
    const { title, description, column, priority, dueDate, assigneeId } = body;

    if (typeof title !== "string" || !title.trim()) {
      return Response.json({ error: "Title is required" }, { status: 400 });
    }

    if (typeof assigneeId !== "string" || !assigneeId) {
      return Response.json({ error: "Assignee is required" }, { status: 400 });
    }

    // The response includes the assignee's name, email and avatar, so an
    // unchecked id here turned this endpoint into a lookup for any user in the
    // system -- besides assigning work to someone who cannot see it.
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

    const validColumns = ["todo", "in_progress", "waiting", "done"];
    const taskColumn = validColumns.includes(column) ? column : "todo";

    const validPriorities = ["low", "medium", "high"];
    const taskPriority = validPriorities.includes(priority)
      ? priority
      : "medium";

    const maxPosition = await prisma.task.aggregate({
      where: { businessId: ctx.businessId, column: taskColumn },
      _max: { position: true },
    });

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        column: taskColumn,
        priority: taskPriority,
        dueDate: dueDate ? new Date(dueDate) : null,
        position: (maxPosition._max.position ?? -1) + 1,
        assigneeId,
        businessId: ctx.businessId,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    });

    return Response.json(task, { status: 201 });
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
}
