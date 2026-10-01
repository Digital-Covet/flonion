import { Effect, Option } from "effect";
import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/server-auth", () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock("~/server/effect/runtime", async () => {
  const { testRuntime } = await import("~/server/effect/testing");
  return { getRuntime: () => testRuntime.current };
});

const { fakeAuth, fakeDb, fakeEvent, fakeGoogle, fakeSession, useRuntime } =
  await import("~/server/effect/testing");
const tasks = await import("./index");
const task = await import("./[id]");
const reorder = await import("./reorder");
const teamMeetings = await import("../team-meetings/index");
const { completedAtFor } = await import("~/server/task-rules");

async function read(res: Response) {
  return { status: res.status, body: await res.json() };
}

/** A member (not owner, not admin) of business "b1". */
const member = {
  user: {
    findUnique: async () => ({
      businessId: "b1",
      role: "member",
      business: null,
    }),
    findFirst: async (args: { where: { id: string } }) =>
      args.where.id === "teammate" ? { id: "teammate" } : null,
  },
};

describe("/api/tasks", () => {
  it("refuses an assignee from outside the team", async () => {
    useRuntime({ auth: fakeAuth(fakeSession()), db: fakeDb(member) });
    const res = await read(
      await tasks.POST(
        fakeEvent({ body: { title: "x", assigneeId: "stranger" } }),
      ),
    );
    expect(res).toEqual({
      status: 400,
      body: { error: "Assignee is not a member of this team" },
    });
  });

  it("appends a new task to the end of its column", async () => {
    const create = vi.fn(async (args: { data: object }) => args.data);
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        ...member,
        task: {
          aggregate: async () => ({ _max: { position: 4 } }),
          create,
        },
      }),
    });
    const res = await read(
      await tasks.POST(
        fakeEvent({
          body: { title: " Call ", assigneeId: "teammate", column: "bogus" },
        }),
      ),
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      title: "Call",
      column: "todo",
      priority: "medium",
      position: 5,
    });
  });

  it("lets a member edit only their own tasks", async () => {
    useRuntime({
      auth: fakeAuth(fakeSession("user_1")),
      db: fakeDb({
        ...member,
        task: {
          findUnique: async () => ({ businessId: "b1", assigneeId: "someone" }),
        },
      }),
    });
    const e = fakeEvent({ method: "DELETE" });
    (e as { params: Record<string, string> }).params = { id: "t1" };
    const res = await read(await task.DELETE(e));
    expect(res).toEqual({
      status: 403,
      body: {
        error: "Only the assignee, an admin, or the owner can modify this task",
      },
    });
  });

  it("reorders within a column inside one transaction", async () => {
    const updateMany = vi.fn(async () => ({ count: 2 }));
    const update = vi.fn(async () => ({}));
    useRuntime({
      auth: fakeAuth(fakeSession("user_1")),
      db: fakeDb({
        ...member,
        task: {
          findUnique: async () => ({
            businessId: "b1",
            column: "todo",
            position: 1,
            assigneeId: "user_1",
          }),
          updateMany,
          update,
        },
      }),
    });
    const res = await read(
      await reorder.PATCH(
        fakeEvent({
          method: "PATCH",
          body: { taskId: "t1", targetColumn: "todo", newPosition: 3 },
        }),
      ),
    );
    expect(res).toEqual({ status: 200, body: { success: true } });
    expect(updateMany).toHaveBeenCalledWith({
      where: { businessId: "b1", column: "todo", position: { gt: 1, lte: 3 } },
      data: { position: { decrement: 1 } },
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { column: "todo", position: 3 },
    });
  });

  it("stamps completedAt when a task moves into Done", async () => {
    const update = vi.fn(async () => ({}));
    useRuntime({
      auth: fakeAuth(fakeSession("user_1")),
      db: fakeDb({
        ...member,
        task: {
          findUnique: async () => ({
            businessId: "b1",
            column: "waiting",
            position: 0,
            assigneeId: "user_1",
          }),
          updateMany: async () => ({ count: 0 }),
          update,
        },
      }),
    });
    await reorder.PATCH(
      fakeEvent({
        method: "PATCH",
        body: { taskId: "t1", targetColumn: "done", newPosition: 0 },
      }),
    );
    expect(update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { column: "done", position: 0, completedAt: expect.any(Date) },
    });
  });
});

describe("completedAtFor", () => {
  const now = new Date("2026-09-30T10:00:00Z");

  it("stamps a task landing in Done, new or moved", () => {
    expect(completedAtFor(null, "done", now)).toBe(now);
    expect(completedAtFor("todo", "done", now)).toBe(now);
  });

  it("clears it when a finished task is reopened", () => {
    expect(completedAtFor("done", "in_progress", now)).toBeNull();
  });

  it("leaves it alone otherwise, so reordering Done keeps the date", () => {
    expect(completedAtFor("done", "done", now)).toBeUndefined();
    expect(completedAtFor("todo", "waiting", now)).toBeUndefined();
    expect(completedAtFor(null, "todo", now)).toBeUndefined();
  });
});

describe("POST /api/team-meetings", () => {
  it("saves the meeting and attaches a Meet link when one is made", async () => {
    const update = vi.fn(async () => ({}));
    useRuntime({
      auth: fakeAuth(fakeSession()),
      google: fakeGoogle({
        createMeetLink: () =>
          Effect.succeed(
            Option.some({ meetUri: "https://meet/x", spaceId: "x" }),
          ),
      }),
      db: fakeDb({
        user: { findUnique: async () => ({ businessId: "b1" }) },
        teamMeeting: {
          create: async (args: { data: object }) => ({
            id: "tm1",
            ...args.data,
          }),
          update,
        },
      }),
    });
    const res = await read(
      await teamMeetings.POST(
        fakeEvent({
          body: {
            title: "Standup",
            date: "2026-10-01",
            startTime: "09:00",
            endTime: "09:15",
            location: "Office",
          },
        }),
      ),
    );
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      meetUri: "https://meet/x",
      meetSpaceId: "x",
    });
    expect(update).toHaveBeenCalledOnce();
  });

  it("keeps the first missing field's message", async () => {
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({ user: { findUnique: async () => ({ businessId: "b1" }) } }),
    });
    const res = await read(
      await teamMeetings.POST(
        fakeEvent({ body: { title: "x", date: "2026-10-01" } }),
      ),
    );
    expect(res).toEqual({
      status: 400,
      body: { error: "Start time is required" },
    });
  });
});

describe("/api/tasks subtasks", () => {
  const post = (parent: object | null) => {
    const create = vi.fn(async (args: { data: object }) => args.data);
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        ...member,
        task: {
          findUnique: async () => parent,
          aggregate: async () => ({ _max: { position: null } }),
          create,
        },
      }),
    });
    return tasks.POST(
      fakeEvent({
        body: { title: "Sub", assigneeId: "teammate", parentId: "p1" },
      }),
    );
  };

  it("creates a subtask under a top-level task of this business", async () => {
    const res = await read(await post({ businessId: "b1", parentId: null }));
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ parentId: "p1" });
  });

  it("refuses a parent from another business", async () => {
    const res = await read(await post({ businessId: "other", parentId: null }));
    expect(res).toEqual({
      status: 400,
      body: { error: "Invalid parent task" },
    });
  });

  it("refuses a subtask of a subtask", async () => {
    const res = await read(await post({ businessId: "b1", parentId: "x" }));
    expect(res.status).toBe(400);
  });
});
