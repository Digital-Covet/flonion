import { describe, expect, it, vi } from "vitest";

process.env.TOKEN_ENCRYPTION_KEY ??= "test-token-encryption-key-32-bytes!!";

vi.mock("~/lib/server-auth", () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock("~/server/effect/runtime", async () => {
  const { testRuntime } = await import("~/server/effect/testing");
  return { getRuntime: () => testRuntime.current };
});

const { fakeAuth, fakeDb, fakeEvent, fakeMailer, fakeSession, useRuntime } =
  await import("~/server/effect/testing");
const contacts = await import("./contacts");
const slots = await import("./slots/index");
const meetings = await import("./meetings/index");
const decision = await import("./meetings/[id]");

async function read(res: Response) {
  const text = await res.text();
  let body: unknown = text;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: res.status, body };
}

describe("POST /api/marketplace/contacts", () => {
  const owned = (userId: string) => ({
    business: { findUnique: async () => ({ userId }) },
  });

  it("rejects an invalid batch with the bulk message", async () => {
    useRuntime({ auth: fakeAuth(fakeSession()), db: fakeDb(owned("user_1")) });
    const res = await read(
      await contacts.POST(
        fakeEvent({ body: { businessId: "b1", contacts: [{ name: "  " }] } }),
      ),
    );
    expect(res).toEqual({
      status: 400,
      body: { error: "Between 1 and 50 valid contacts are required" },
    });
  });

  it("403s a business the caller does not own", async () => {
    useRuntime({ auth: fakeAuth(fakeSession()), db: fakeDb(owned("someone")) });
    const res = await read(
      await contacts.POST(
        fakeEvent({
          body: { businessId: "b1", contacts: [{ name: "A", role: "" }] },
        }),
      ),
    );
    expect(res).toEqual({ status: 403, body: { error: "Unauthorized" } });
  });

  it("trims fields, gates the avatar, and creates", async () => {
    const createMany = vi.fn(async (args: { data: unknown[] }) => ({
      count: args.data.length,
    }));
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({ ...owned("user_1"), businessContact: { createMany } }),
    });
    const res = await read(
      await contacts.POST(
        fakeEvent({
          body: {
            businessId: "b1",
            contacts: [
              { name: "  Asha ", role: " Lead ", avatarUrl: "javascript:x" },
            ],
          },
        }),
      ),
    );
    expect(res).toEqual({ status: 200, body: { created: 1 } });
    expect(createMany.mock.calls[0][0].data[0]).toMatchObject({
      name: "Asha",
      role: "Lead",
      avatarUrl: null,
      position: 0,
    });
  });

  it("answers a failed write with the old 400", async () => {
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        ...owned("user_1"),
        businessContact: {
          delete: async () => Promise.reject(new Error("P2025")),
        },
      }),
    });
    const res = await read(
      await contacts.DELETE(
        fakeEvent({ method: "DELETE", body: { id: "c1", businessId: "b1" } }),
      ),
    );
    expect(res).toEqual({
      status: 400,
      body: { error: "Invalid request body" },
    });
  });

  it("checks id before businessId", async () => {
    useRuntime({ auth: fakeAuth(fakeSession()) });
    const res = await read(
      await contacts.PATCH(fakeEvent({ method: "PATCH", body: {} })),
    );
    expect(res).toEqual({ status: 400, body: { error: "id is required" } });
  });
});

describe("POST /api/marketplace/slots", () => {
  it("decodes dates from strings and epoch millis", async () => {
    const createMany = vi.fn(async () => ({ count: 2 }));
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        business: { findUnique: async () => ({ id: "b1" }) },
        availabilitySlot: { createMany },
      }),
    });
    const res = await read(
      await slots.POST(
        fakeEvent({
          body: {
            slots: [
              { date: "2026-10-01", startTime: "09:00", endTime: "09:30" },
              { date: 1790000000000, startTime: " 10:00 ", endTime: "10:30" },
            ],
          },
        }),
      ),
    );
    expect(res).toEqual({ status: 200, body: { created: 2 } });
    const data = (
      createMany.mock.calls[0] as unknown as [
        { data: Array<{ date: Date; startTime: string }> },
      ]
    )[0].data;
    expect(data[0].date).toBeInstanceOf(Date);
    expect(data[1].startTime).toBe("10:00");
  });

  it("rejects an unparseable date", async () => {
    useRuntime({ auth: fakeAuth(fakeSession()) });
    const res = await read(
      await slots.POST(
        fakeEvent({
          body: {
            slots: [
              { date: "not a date", startTime: "09:00", endTime: "09:30" },
            ],
          },
        }),
      ),
    );
    expect(res.status).toBe(400);
  });
});

describe("POST /api/marketplace/meetings", () => {
  const slot = {
    id: "s1",
    businessId: "b1",
    isBooked: false,
    date: new Date(Date.now() + 86_400_000),
    startTime: "09:00",
    endTime: "09:30",
    business: {
      id: "b1",
      name: "Acme",
      userId: "owner",
      status: "active",
      user: { email: "owner@example.com", name: "Owner" },
    },
  };

  function setup(opts: { booked?: boolean; mailFails?: boolean } = {}) {
    const mailer = fakeMailer(opts.mailFails);
    useRuntime({
      auth: fakeAuth(fakeSession()),
      mailer: mailer.layer,
      db: fakeDb({
        availabilitySlot: {
          findUnique: async () => ({ ...slot, isBooked: !!opts.booked }),
          update: async () => ({ id: "s1" }),
        },
        meetingRequest: {
          create: async () => ({ id: "m1", message: null }),
        },
      }),
    });
    return mailer;
  }

  it("409s a slot that is already booked", async () => {
    setup({ booked: true });
    const res = await read(
      await meetings.POST(
        fakeEvent({ body: { slotId: "s1", businessId: "b1" } }),
      ),
    );
    expect(res).toEqual({
      status: 409,
      body: { error: "This slot is no longer available" },
    });
  });

  it("books and emails the owner", async () => {
    const mailer = setup();
    const res = await read(
      await meetings.POST(
        fakeEvent({ body: { slotId: "s1", businessId: "b1" } }),
      ),
    );
    expect(res.status).toBe(200);
    expect(mailer.sent).toEqual([
      {
        to: "owner@example.com",
        subject: expect.stringContaining("New meeting request"),
      },
    ]);
  });

  it("keeps the booking when the email fails", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    setup({ mailFails: true });
    const res = await read(
      await meetings.POST(
        fakeEvent({ body: { slotId: "s1", businessId: "b1" } }),
      ),
    );
    log.mockRestore();
    expect(res.status).toBe(200);
  });
});

describe("POST /api/marketplace/meetings/:id (confirmation form)", () => {
  function formEvent(fields: Record<string, string>) {
    const request = new Request(
      "http://localhost/api/marketplace/meetings/m1",
      {
        method: "POST",
        body: new URLSearchParams(fields),
      },
    );
    return { request, params: {}, locals: {} } as never;
  }

  it("answers plain-text errors as before", async () => {
    useRuntime();
    const bad = await decision.POST(formEvent({ action: "maybe" }));
    expect([bad.status, await bad.text()]).toEqual([400, "Invalid action"]);

    const unsigned = await decision.POST(formEvent({ action: "accept" }));
    expect([unsigned.status, await unsigned.text()]).toEqual([
      401,
      "Unauthorized",
    ]);
  });

  it("lets the owner decide without a signed link", async () => {
    useRuntime({
      auth: fakeAuth(fakeSession("owner")),
      db: fakeDb({
        meetingRequest: {
          findUnique: async () => ({
            id: "m1",
            slotId: "s1",
            status: "pending",
            business: { userId: "owner" },
          }),
          updateMany: async () => ({ count: 1 }),
        },
        availabilitySlot: { update: async () => ({}) },
      }),
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await decision.POST(formEvent({ action: "reject" }));
    log.mockRestore();
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Meeting Rejected");
  });
});
