import type { APIEvent } from "@solidjs/start/server";
import { getSessionFromHeaders } from "~/lib/server-auth";
import { prisma } from "~/db/prisma";

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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { businessId: true },
  });

  if (!user?.businessId || task.businessId !== user.businessId) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  return Response.json(task);
}

export async function PATCH(event: APIEvent) {
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = event.params.id;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { businessId: true },
  });

  if (!user?.businessId) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { businessId: true },
  });

  if (!existing || existing.businessId !== user.businessId) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

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
  const session = await getSessionFromHeaders(event.request.headers);
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const taskId = event.params.id;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { businessId: true },
  });

  if (!user?.businessId) {
    return Response.json({ error: "No business found" }, { status: 404 });
  }

  const existing = await prisma.task.findUnique({
    where: { id: taskId },
    select: { businessId: true },
  });

  if (!existing || existing.businessId !== user.businessId) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  await prisma.task.delete({ where: { id: taskId } });

  return Response.json({ success: true });
}
