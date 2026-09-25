import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/server-auth", () => ({ getSessionFromHeaders: vi.fn() }));
vi.mock("~/server/effect/runtime", async () => {
  const { testRuntime } = await import("~/server/effect/testing");
  return { getRuntime: () => testRuntime.current };
});

const { fakeAuth, fakeDb, fakeEvent, fakeMailer, fakeSession, useRuntime } =
  await import("~/server/effect/testing");
const acceptInvite = await import("./accept-invite");
const review = await import("./join-requests/[id]");
const invite = await import("./invite");

async function read(res: Response) {
  return { status: res.status, body: await res.json() };
}

/** Counts rows as `inspectOwnedBusiness` does; zero everywhere = empty. */
const emptyBusinessTables = {
  task: { count: async () => 0 },
  teamMeeting: { count: async () => 0 },
  sharedReview: { count: async () => 0 },
  availabilitySlot: { count: async () => 0 },
  meetingRequest: { count: async () => 0 },
  service: { count: async () => 0 },
  project: { count: async () => 0 },
  businessContact: { count: async () => 0 },
  favoritePartner: { count: async () => 0 },
  user: { count: async () => 0 },
  invitation: { count: async () => 0 },
  joinRequest: { count: async () => 0 },
  billingSubscription: { count: async () => 0 },
};

describe("POST /api/team/accept-invite", () => {
  const invitation = {
    id: "inv1",
    email: "user_1@example.com",
    businessId: "team",
    role: "member",
    status: "pending",
    expiresAt: new Date(Date.now() + 86_400_000),
  };

  it("joins the team when the user owns nothing", async () => {
    const userUpdate = vi.fn(async () => ({}));
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        invitation: {
          findUnique: async () => invitation,
          updateMany: async () => ({ count: 1 }),
        },
        user: {
          findUnique: async () => ({
            email: "user_1@example.com",
            businessId: null,
            business: null,
          }),
          update: userUpdate,
        },
        joinRequest: { updateMany: async () => ({ count: 0 }) },
      }),
    });
    const res = await read(
      await acceptInvite.POST(fakeEvent({ body: { token: "t" } })),
    );
    expect(res).toEqual({
      status: 200,
      body: { success: true, businessId: "team" },
    });
    expect(userUpdate).toHaveBeenCalledOnce();
  });

  it("maps a lost race to the old 400", async () => {
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        invitation: {
          findUnique: async () => invitation,
          updateMany: async () => ({ count: 0 }),
        },
        user: {
          findUnique: async () => ({
            email: "user_1@example.com",
            businessId: null,
            business: null,
          }),
        },
      }),
    });
    const res = await read(
      await acceptInvite.POST(fakeEvent({ body: { token: "t" } })),
    );
    expect(res).toEqual({
      status: 400,
      body: { error: "Invitation is no longer pending" },
    });
  });

  it("rejects an invitation meant for someone else", async () => {
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        invitation: { findUnique: async () => invitation },
        user: {
          findUnique: async () => ({
            email: "other@example.com",
            businessId: null,
            business: null,
          }),
        },
      }),
    });
    const res = await read(
      await acceptInvite.POST(fakeEvent({ body: { token: "t" } })),
    );
    expect(res.status).toBe(400);
    expect(res.body.error).toBe(
      "This invitation is for a different email address",
    );
  });

  it("answers an unexpected failure with the old 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    useRuntime({
      auth: fakeAuth(fakeSession()),
      db: fakeDb({
        invitation: { findUnique: async () => Promise.reject(new Error("db")) },
      }),
    });
    const res = await read(
      await acceptInvite.POST(fakeEvent({ body: { token: "t" } })),
    );
    log.mockRestore();
    expect(res).toEqual({
      status: 500,
      body: { error: "Couldn't accept the invitation. Please try again." },
    });
  });
});

describe("PATCH /api/team/join-requests/:id", () => {
  const joinRequest = {
    id: "jr1",
    businessId: "team",
    userId: "joiner",
    status: "pending",
    consentDeleteOwnedBusiness: false,
    business: { name: "Team" },
    user: { email: "joiner@example.com", name: "Joiner" },
  };

  function setup(joiner: object | null) {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const mailer = fakeMailer();
    useRuntime({
      auth: fakeAuth(fakeSession("admin")),
      mailer: mailer.layer,
      db: fakeDb({
        ...emptyBusinessTables,
        user: {
          findUnique: async (args: { where: { id: string } }) =>
            args.where.id === "admin"
              ? { businessId: "team", role: "admin", business: null }
              : joiner,
          update: async () => ({}),
        },
        joinRequest: { findUnique: async () => joinRequest, updateMany },
      }),
    });
    const event = () => {
      const e = fakeEvent({ method: "PATCH", body: { action: "approve" } });
      (e as { params: Record<string, string> }).params = { id: "jr1" };
      return e;
    };
    return { updateMany, mailer, event };
  }

  it("approves and emails the joiner", async () => {
    const { event, mailer } = setup({ businessId: null, business: null });
    const res = await read(await review.PATCH(event()));
    expect(res.body).toMatchObject({ success: true, status: "approved" });
    expect(mailer.sent).toHaveLength(1);
  });

  it("410s when the account is gone", async () => {
    const { event } = setup(null);
    const res = await read(await review.PATCH(event()));
    expect(res).toEqual({
      status: 410,
      body: { error: "That account no longer exists", blockers: [] },
    });
  });

  it("needs the joiner's consent to delete their business", async () => {
    const { event } = setup({ businessId: "own", business: { id: "own" } });
    const res = await read(await review.PATCH(event()));
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/haven't agreed/);
  });

  it("retires a request whose joiner joined elsewhere", async () => {
    const { event, updateMany } = setup({
      businessId: "elsewhere",
      business: null,
    });
    const res = await read(await review.PATCH(event()));
    expect(res).toEqual({
      status: 409,
      body: { error: "They have since joined another team", resolved: true },
    });
    // The claim, then the repair outside the rolled-back transaction.
    expect(updateMany).toHaveBeenCalledTimes(2);
    expect(updateMany.mock.calls[1]).toEqual([
      expect.objectContaining({
        data: expect.objectContaining({ status: "cancelled" }),
      }),
    ]);
  });
});

describe("POST /api/team/invite", () => {
  it("deletes the invitation and 502s when the email can't be sent", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const del = vi.fn(async () => ({}));
    useRuntime({
      auth: fakeAuth(fakeSession("owner")),
      mailer: fakeMailer(true).layer,
      db: fakeDb({
        user: {
          findUnique: async (args: {
            where: { id?: string; email?: string };
          }) =>
            args.where.id === "owner"
              ? {
                  businessId: "team",
                  role: "owner",
                  business: { id: "team" },
                  name: "Owner",
                  email: "owner@example.com",
                }
              : null,
        },
        invitation: {
          findFirst: async () => null,
          create: async (args: { data: object }) => ({
            id: "inv1",
            ...args.data,
          }),
          delete: del,
        },
      }),
    });
    const res = await read(
      await invite.POST(fakeEvent({ body: { email: "new@example.com" } })),
    );
    log.mockRestore();
    expect(res).toEqual({
      status: 502,
      body: {
        error:
          "Couldn't send the invitation email. Please check the address and try again.",
      },
    });
    expect(del).toHaveBeenCalledWith({ where: { id: "inv1" } });
  });
});
