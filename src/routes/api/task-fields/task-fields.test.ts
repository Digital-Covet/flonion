import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/server-auth", () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock("~/server/effect/runtime", async () => {
  const { testRuntime } = await import("~/server/effect/testing");
  return { getRuntime: () => testRuntime.current };
});

const { fakeAuth, fakeDb, fakeEvent, fakeSession, useRuntime } = await import(
  "~/server/effect/testing"
);
const fields = await import("./index");
const field = await import("./[id]");
const values = await import("./values");

async function read(res: Response) {
  return { status: res.status, body: await res.json() };
}

function event(init: {
  method?: string;
  body?: unknown;
  params?: Record<string, string>;
}) {
  const e = fakeEvent({ method: init.method, body: init.body });
  (e as { params: Record<string, string> }).params = init.params ?? {};
  return e;
}

const owner = {
  user: {
    findUnique: async () => ({
      businessId: "b1",
      role: "member",
      business: { id: "b1" },
    }),
  },
};
const member = {
  user: {
    findUnique: async () => ({
      businessId: "b1",
      role: "member",
      business: null,
    }),
  },
};

/** The column ids in the order they were given a position, from `update` calls. */
function positions(update: { mock: { calls: unknown[][] } }): string[] {
  return (
    update.mock.calls as unknown as [
      { where: { id: string }; data: { position: number } },
    ][]
  )
    .map(([args]) => args)
    .sort((x, y) => x.data.position - y.data.position)
    .map((args) => args.where.id);
}

describe("GET /api/task-fields", () => {
  it("returns the team's columns and only the values that still fit", async () => {
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        ...member,
        taskField: {
          findMany: async () => [
            { id: "f1", title: "Cost", type: "number" },
            { id: "f2", title: "Odd", type: "mystery" },
          ],
        },
        taskFieldValue: {
          findMany: async () => [
            { taskId: "t1", fieldId: "f1", value: 5 },
            { taskId: "t2", fieldId: "f1", value: "five" },
            { taskId: "t1", fieldId: "f2", value: "x" },
          ],
        },
      }),
    });
    const res = await read(await fields.GET(event({ method: "GET" })));
    expect(res.status).toBe(200);
    expect(res.body.fields).toEqual([
      { id: "f1", title: "Cost", type: "number" },
    ]);
    expect(res.body.values).toEqual([
      { taskId: "t1", fieldId: "f1", value: 5 },
    ]);
  });
});

describe("POST /api/task-fields", () => {
  it("is for the owner and admins", async () => {
    useRuntime({ auth: fakeAuth(fakeSession()), db: fakeDb(member) });
    const res = await read(
      await fields.POST(event({ body: { type: "tags" } })),
    );
    expect(res).toEqual({
      status: 403,
      body: { error: "Only the owner or an admin can add columns" },
    });
  });

  it("names the column after its type, numbering repeats, and appends it", async () => {
    const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: "f9",
      title: args.data.title,
      type: args.data.type,
    }));
    const update = vi.fn(async () => ({}));
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        ...owner,
        taskField: {
          findMany: async () => [{ id: "f1", title: "Tags", type: "tags" }],
          create,
          update,
        },
      }),
    });
    const res = await read(
      await fields.POST(event({ body: { type: "tags" } })),
    );
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "f9", title: "Tags 2", type: "tags" });
    expect(create.mock.calls[0][0].data).toMatchObject({ businessId: "b1" });
    expect(positions(update)).toEqual(["f1", "f9"]);
  });

  it("inserts next to a named column and renumbers", async () => {
    const update = vi.fn(async () => ({}));
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        ...owner,
        taskField: {
          findMany: async () => [
            { id: "a", title: "A", type: "text" },
            { id: "b", title: "B", type: "text" },
          ],
          create: async () => ({ id: "n", title: "Number", type: "number" }),
          update,
        },
      }),
    });
    const before = await read(
      await fields.POST(event({ body: { type: "number", beforeId: "b" } })),
    );
    expect(before.status).toBe(201);
    expect(positions(update)).toEqual(["a", "n", "b"]);

    const missing = await read(
      await fields.POST(event({ body: { type: "number", afterId: "zzz" } })),
    );
    expect(missing.status).toBe(404);
  });

  it("duplicates a column with its values, next to the original", async () => {
    const create = vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: "n",
      title: args.data.title,
      type: args.data.type,
    }));
    const createMany = vi.fn(async () => ({ count: 2 }));
    const update = vi.fn(async () => ({}));
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        ...owner,
        taskField: {
          findMany: async () => [
            { id: "a", title: "Cost", type: "number" },
            { id: "b", title: "Other", type: "text" },
          ],
          create,
          update,
        },
        taskFieldValue: {
          findMany: async () => [
            { taskId: "t1", value: 5 },
            { taskId: "t2", value: 7 },
          ],
          createMany,
        },
      }),
    });
    const res = await read(
      await fields.POST(event({ body: { duplicateOf: "a", afterId: "a" } })),
    );
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ id: "n", title: "Cost copy", type: "number" });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        { taskId: "t1", fieldId: "n", value: 5 },
        { taskId: "t2", fieldId: "n", value: 7 },
      ],
    });
    expect(positions(update)).toEqual(["a", "n", "b"]);

    const unknown = await read(
      await fields.POST(event({ body: { duplicateOf: "zzz" } })),
    );
    expect(unknown.status).toBe(404);
  });

  it("refuses an unknown type", async () => {
    useRuntime({ auth: fakeAuth(fakeSession()), db: fakeDb(owner) });
    const res = await read(
      await fields.POST(event({ body: { type: "audio" } })),
    );
    expect(res).toEqual({
      status: 400,
      body: { error: "Unknown column type" },
    });
  });

  it("stops at the cap", async () => {
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        ...owner,
        taskField: {
          findMany: async () =>
            Array.from({ length: 12 }, (_, i) => ({
              title: `C${i}`,
              position: i,
            })),
        },
      }),
    });
    const res = await read(
      await fields.POST(event({ body: { type: "text" } })),
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/up to 12/);
  });
});

describe("/api/task-fields/[id]", () => {
  const ownField = {
    findUnique: async () => ({ businessId: "b1", type: "link" }),
  };

  it("renames a column, with the type's name for a blank title", async () => {
    const update = vi.fn(async (args: { data: { title: string } }) => ({
      id: "f1",
      type: "link",
      title: args.data.title,
    }));
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({ ...owner, taskField: { ...ownField, update } }),
    });
    const named = await read(
      await field.PATCH(
        event({
          method: "PATCH",
          params: { id: "f1" },
          body: { title: " Spec " },
        }),
      ),
    );
    expect(named.body.title).toBe("Spec");
    const blank = await read(
      await field.PATCH(
        event({ method: "PATCH", params: { id: "f1" }, body: { title: "  " } }),
      ),
    );
    expect(blank.body.title).toBe("Link");
  });

  it("changes a column's type, converting values and dropping the rest", async () => {
    const update = vi.fn(async (args: { data: Record<string, unknown> }) => ({
      id: "f1",
      title: "Cost",
      type: args.data.type ?? "text",
    }));
    const valueUpdate = vi.fn(async () => ({}));
    const valueDelete = vi.fn(async () => ({}));
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        ...owner,
        taskField: {
          findUnique: async () => ({
            businessId: "b1",
            type: "text",
            title: "Cost",
          }),
          update,
        },
        taskFieldValue: {
          findMany: async () => [
            { taskId: "t1", value: "42" },
            { taskId: "t2", value: "soon" },
          ],
          update: valueUpdate,
          delete: valueDelete,
        },
      }),
    });
    const res = await read(
      await field.PATCH(
        event({
          method: "PATCH",
          params: { id: "f1" },
          body: { type: "number" },
        }),
      ),
    );
    expect(res.body).toEqual({ id: "f1", title: "Cost", type: "number" });
    expect(valueUpdate).toHaveBeenCalledWith({
      where: { taskId_fieldId: { taskId: "t1", fieldId: "f1" } },
      data: { value: 42 },
    });
    expect(valueDelete).toHaveBeenCalledWith({
      where: { taskId_fieldId: { taskId: "t2", fieldId: "f1" } },
    });
  });

  it("moves a column one place", async () => {
    const update = vi.fn(async () => ({ id: "b", title: "B", type: "text" }));
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        ...owner,
        taskField: {
          findUnique: async () => ({
            businessId: "b1",
            type: "text",
            title: "B",
          }),
          findMany: async () => [{ id: "a" }, { id: "b" }, { id: "c" }],
          update,
        },
      }),
    });
    await field.PATCH(
      event({ method: "PATCH", params: { id: "b" }, body: { move: "right" } }),
    );
    const order = (
      update.mock.calls as unknown as [
        { where: { id: string }; data: { position?: number } },
      ][]
    )
      .map(([a]) => a)
      .filter((a) => a.data.position !== undefined)
      .sort((x, y) => (x.data.position ?? 0) - (y.data.position ?? 0))
      .map((a) => a.where.id);
    expect(order).toEqual(["a", "c", "b"]);
  });

  it("refuses an unknown type or move", async () => {
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({ ...owner, taskField: ownField }),
    });
    const type = await read(
      await field.PATCH(
        event({
          method: "PATCH",
          params: { id: "f1" },
          body: { type: "audio" },
        }),
      ),
    );
    expect(type.status).toBe(400);
    const move = await read(
      await field.PATCH(
        event({ method: "PATCH", params: { id: "f1" }, body: { move: "up" } }),
      ),
    );
    expect(move.status).toBe(400);
  });

  it("answers 404 for another team's column, 403 for a member", async () => {
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        ...owner,
        taskField: {
          findUnique: async () => ({ businessId: "other", type: "text" }),
        },
      }),
    });
    const foreign = await read(
      await field.DELETE(event({ method: "DELETE", params: { id: "f1" } })),
    );
    expect(foreign.status).toBe(404);

    useRuntime({ auth: fakeAuth(fakeSession()), db: fakeDb(member) });
    const forbidden = await read(
      await field.DELETE(event({ method: "DELETE", params: { id: "f1" } })),
    );
    expect(forbidden.status).toBe(403);
  });

  it("deletes a column", async () => {
    const del = vi.fn(async () => ({}));
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({ ...owner, taskField: { ...ownField, delete: del } }),
    });
    const res = await read(
      await field.DELETE(event({ method: "DELETE", params: { id: "f1" } })),
    );
    expect(res).toEqual({ status: 200, body: { success: true } });
    expect(del).toHaveBeenCalledWith({ where: { id: "f1" } });
  });
});

describe("DELETE /api/task-fields/values", () => {
  const clear = (body: unknown) =>
    values.DELETE(event({ method: "DELETE", body }));

  it("empties a column, for the owner and admins", async () => {
    const deleteMany = vi.fn(async () => ({ count: 4 }));
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        ...owner,
        taskField: { findUnique: async () => ({ businessId: "b1" }) },
        taskFieldValue: { deleteMany },
      }),
    });
    const res = await read(await clear({ fieldId: "f1" }));
    expect(res).toEqual({ status: 200, body: { success: true } });
    expect(deleteMany).toHaveBeenCalledWith({ where: { fieldId: "f1" } });
  });

  it("is refused for a member, and for another team's column", async () => {
    useRuntime({ auth: fakeAuth(fakeSession()), db: fakeDb(member) });
    expect((await read(await clear({ fieldId: "f1" }))).status).toBe(403);

    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        ...owner,
        taskField: { findUnique: async () => ({ businessId: "other" }) },
      }),
    });
    expect((await read(await clear({ fieldId: "f1" }))).status).toBe(404);
  });
});

describe("PUT /api/task-fields/values", () => {
  const taskOf = (assigneeId: string, businessId = "b1") => ({
    findUnique: async () => ({ businessId, assigneeId }),
  });
  const numberField = {
    findUnique: async () => ({ businessId: "b1", type: "number" }),
  };
  const put = (body: unknown) => values.PUT(event({ method: "PUT", body }));

  it("saves a value that fits the column", async () => {
    const upsert = vi.fn(async () => ({}));
    useRuntime({
      auth: fakeAuth(fakeSession("user_1")),
      db: fakeDb({
        ...member,
        task: taskOf("user_1"),
        taskField: numberField,
        taskFieldValue: { upsert },
      }),
    });
    const res = await read(
      await put({ taskId: "t1", fieldId: "f1", value: 42 }),
    );
    expect(res).toEqual({ status: 200, body: { success: true } });
    expect(upsert).toHaveBeenCalledWith({
      where: { taskId_fieldId: { taskId: "t1", fieldId: "f1" } },
      create: { taskId: "t1", fieldId: "f1", value: 42 },
      update: { value: 42 },
    });
  });

  it("refuses a value of the wrong shape", async () => {
    useRuntime({
      auth: fakeAuth(fakeSession("user_1")),
      db: fakeDb({ ...member, task: taskOf("user_1"), taskField: numberField }),
    });
    const res = await read(
      await put({ taskId: "t1", fieldId: "f1", value: "lots" }),
    );
    expect(res).toEqual({
      status: 400,
      body: { error: "That value doesn't fit this column" },
    });
  });

  it("clears the cell for null", async () => {
    const deleteMany = vi.fn(async () => ({ count: 1 }));
    useRuntime({
      auth: fakeAuth(fakeSession("user_1")),
      db: fakeDb({
        ...member,
        task: taskOf("user_1"),
        taskField: numberField,
        taskFieldValue: { deleteMany },
      }),
    });
    const res = await read(
      await put({ taskId: "t1", fieldId: "f1", value: null }),
    );
    expect(res.status).toBe(200);
    expect(deleteMany).toHaveBeenCalledWith({
      where: { taskId: "t1", fieldId: "f1" },
    });
  });

  it("lets a member fill in only their own tasks", async () => {
    useRuntime({
      auth: fakeAuth(fakeSession("user_1")),
      db: fakeDb({
        ...member,
        task: taskOf("someone"),
        taskField: numberField,
      }),
    });
    const res = await read(
      await put({ taskId: "t1", fieldId: "f1", value: 1 }),
    );
    expect(res.status).toBe(403);
  });

  it("answers 404 for another team's task or column", async () => {
    useRuntime({
      auth: fakeAuth(fakeSession("user_1")),
      db: fakeDb({
        ...owner,
        task: taskOf("user_1", "other"),
        taskField: numberField,
      }),
    });
    const foreignTask = await read(
      await put({ taskId: "t1", fieldId: "f1", value: 1 }),
    );
    expect(foreignTask.status).toBe(404);

    useRuntime({
      auth: fakeAuth(fakeSession("user_1")),
      db: fakeDb({
        ...owner,
        task: taskOf("user_1"),
        taskField: {
          findUnique: async () => ({ businessId: "other", type: "number" }),
        },
      }),
    });
    const foreignField = await read(
      await put({ taskId: "t1", fieldId: "f1", value: 1 }),
    );
    expect(foreignField.status).toBe(404);
  });
});
