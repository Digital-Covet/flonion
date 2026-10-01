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
    findMany: async (args: { where: { id: { in: string[] } } }) =>
      args.where.id.in
        .filter((id) => id === "teammate" || id === "other_mate")
        .map((id) => ({ id })),
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

describe("/api/tasks with several assignees", () => {
  const post = (body: object, task = {}) => {
    const create = vi.fn(async (args: { data: object }) => ({
      ...args.data,
      assignee: {
        id: "teammate",
        name: "Lead",
        email: "l@x.test",
        image: null,
      },
      coAssignees: [
        {
          user: {
            id: "other_mate",
            name: "Also",
            email: "a@x.test",
            image: null,
          },
        },
      ],
    }));
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        ...member,
        task: {
          aggregate: async () => ({ _max: { position: 0 } }),
          create,
          ...task,
        },
      }),
    });
    return {
      create,
      send: async () =>
        read(
          await tasks.POST(
            fakeEvent({ body: { title: "Team task", ...body } }),
          ),
        ),
    };
  };

  it("makes the first assignee the lead and the rest co-assignees", async () => {
    const { create, send } = post({ assigneeIds: ["teammate", "other_mate"] });
    const res = await send();
    expect(res.status).toBe(201);
    expect(create.mock.calls[0][0]).toMatchObject({
      data: {
        assigneeId: "teammate",
        coAssignees: { create: [{ userId: "other_mate" }] },
      },
    });
    // One list for clients, lead first; the raw join rows are not exposed.
    expect(res.body.assignees.map((a: { id: string }) => a.id)).toEqual([
      "teammate",
      "other_mate",
    ]);
    expect(res.body).not.toHaveProperty("coAssignees");
  });

  it("still accepts a single assigneeId", async () => {
    const { create, send } = post({ assigneeId: "teammate" });
    expect((await send()).status).toBe(201);
    expect(create.mock.calls[0][0]).toMatchObject({
      data: { assigneeId: "teammate", coAssignees: { create: [] } },
    });
  });

  it("refuses an empty list, a stranger among them, or too many", async () => {
    expect((await post({ assigneeIds: [] }).send()).status).toBe(400);
    const stranger = await post({
      assigneeIds: ["teammate", "stranger"],
    }).send();
    expect(stranger).toEqual({
      status: 400,
      body: { error: "Assignee is not a member of this team" },
    });
    const many = Array.from({ length: 11 }, (_, i) => `u${i}`);
    const tooMany = await post({ assigneeIds: many }).send();
    expect(tooMany.status).toBe(400);
    expect(tooMany.body.error).toMatch(/up to 10/);
  });

  it("counts a co-assignee as on the task", async () => {
    useRuntime({
      auth: fakeAuth(fakeSession("user_1")),
      db: fakeDb({
        ...member,
        task: {
          findUnique: async () => ({
            businessId: "b1",
            column: "todo",
            assigneeId: "someone",
            coAssignees: [{ userId: "user_1" }],
          }),
          delete: async () => ({}),
        },
      }),
    });
    const e = fakeEvent({ method: "DELETE" });
    (e as { params: Record<string, string> }).params = { id: "t1" };
    expect(await read(await task.DELETE(e))).toEqual({
      status: 200,
      body: { success: true },
    });
  });

  it("replaces the assignees on update", async () => {
    const update = vi.fn(async (args: { data: object }) => args.data);
    useRuntime({
      auth: fakeAuth(fakeSession("user_1")),
      db: fakeDb({
        ...member,
        task: {
          findUnique: async () => ({
            businessId: "b1",
            column: "todo",
            assigneeId: "user_1",
            coAssignees: [],
          }),
          update,
        },
      }),
    });
    const e = fakeEvent({
      method: "PATCH",
      body: { assigneeIds: ["other_mate", "teammate"] },
    });
    (e as { params: Record<string, string> }).params = { id: "t1" };
    const res = await read(await task.PATCH(e));
    expect(res.status).toBe(200);
    expect(update.mock.calls[0][0]).toMatchObject({
      data: {
        assigneeId: "other_mate",
        coAssignees: { deleteMany: {}, create: [{ userId: "teammate" }] },
      },
    });
  });

  it("leaves assignees alone when an update doesn't mention them", async () => {
    const update = vi.fn(async (args: { data: object }) => args.data);
    useRuntime({
      auth: fakeAuth(fakeSession("user_1")),
      db: fakeDb({
        ...member,
        task: {
          findUnique: async () => ({
            businessId: "b1",
            column: "todo",
            assigneeId: "user_1",
            coAssignees: [],
          }),
          update,
        },
      }),
    });
    const e = fakeEvent({ method: "PATCH", body: { title: "Renamed" } });
    (e as { params: Record<string, string> }).params = { id: "t1" };
    await task.PATCH(e);
    const { data } = update.mock.calls[0][0] as {
      data: Record<string, unknown>;
    };
    expect(data).toEqual({ title: "Renamed" });
  });
});
