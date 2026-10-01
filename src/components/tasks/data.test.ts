import { describe, expect, it, vi } from "vitest";

// data.ts fetches through the onboarding UI module, which is a component
// file; the month helpers under test never touch it.
vi.mock("~/components/onboarding/ui", () => ({ api: vi.fn() }));

const {
  finishedIn,
  finishersIn,
  groupByCustom,
  monthGrid,
  monthTallies,
  moveTask,
  pruneCustomAssign,
  shiftMonth,
  subtasksByParent,
  tableRows,
} = await import("./data");
type Task = import("./data").Task;

function task(over: Partial<Task>): Task {
  return {
    id: "t",
    title: "Task",
    description: null,
    column: "done",
    priority: "medium",
    dueDate: null,
    position: 0,
    completedAt: null,
    parentId: null,
    assigneeId: "u1",
    assignee: { id: "u1", name: "Priya", email: "p@x.test", image: null },
    createdAt: "2026-08-01T09:00:00",
    updatedAt: "2026-08-01T09:00:00",
    ...over,
  };
}

// Local-time timestamps, so the tests read the same in every time zone.
const tasks = [
  task({ id: "a", completedAt: "2026-09-14T10:00:00" }),
  task({ id: "b", completedAt: "2026-09-14T16:00:00", assigneeId: "u2" }),
  task({ id: "c", completedAt: "2026-09-02T10:00:00" }),
  task({ id: "d", completedAt: "2026-08-20T10:00:00" }),
  // Reached Done before completedAt existed: falls back to updatedAt.
  task({ id: "e", updatedAt: "2026-09-30T08:00:00" }),
  // Open work never counts, whatever it says.
  task({ id: "f", column: "todo", completedAt: "2026-09-14T10:00:00" }),
];

describe("done calendar", () => {
  it("pages across year boundaries", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2025-12", 1)).toBe("2026-01");
  });

  it("lists a month's finished tasks, latest first", () => {
    expect(finishedIn(tasks, "2026-09").map((t) => t.id)).toEqual([
      "e",
      "b",
      "a",
      "c",
    ]);
  });

  it("lays the month out in Monday-first weeks", () => {
    // 1 Sep 2026 is a Tuesday and 30 Sep a Wednesday.
    const weeks = monthGrid(tasks, "2026-09");
    expect(weeks).toHaveLength(5);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks[0][0]).toMatchObject({ key: "2026-08-31", inMonth: false });
    expect(weeks[0][0].tasks).toEqual([]);
    expect(weeks[0][1]).toMatchObject({ key: "2026-09-01", inMonth: true });

    const byKey = new Map(weeks.flat().map((d) => [d.key, d.tasks.length]));
    expect(byKey.get("2026-09-14")).toBe(2);
    expect(byKey.get("2026-09-30")).toBe(1);
  });

  it("tallies months oldest first, zeros included", () => {
    expect(monthTallies(tasks, "2026-09", 3)).toEqual([
      { key: "2026-07", count: 0 },
      { key: "2026-08", count: 1 },
      { key: "2026-09", count: 4 },
    ]);
  });

  it("credits the assignee, busiest first", () => {
    const members = [
      { id: "u1", name: "Priya", email: "", image: null },
      { id: "u2", name: "Arjun", email: "", image: null },
    ];
    expect(
      finishersIn(tasks, "2026-09", members).map((f) => [f.name, f.count]),
    ).toEqual([
      ["Priya", 3],
      ["Arjun", 1],
    ]);
  });

  it("stamps and clears completedAt as cards move", () => {
    const now = new Date("2026-09-30T12:00:00");
    const board = [
      task({ id: "open", column: "todo" }),
      task({ id: "done", completedAt: "2026-09-01T10:00:00" }),
    ];

    const finished = moveTask(board, "open", "done", 0, now);
    expect(finished.find((t) => t.id === "open")?.completedAt).toBe(
      now.toISOString(),
    );

    const reordered = moveTask(board, "done", "done", 0, now);
    expect(reordered.find((t) => t.id === "done")?.completedAt).toBe(
      "2026-09-01T10:00:00",
    );

    const reopened = moveTask(board, "done", "waiting", 0, now);
    expect(reopened.find((t) => t.id === "done")?.completedAt).toBeNull();
  });
});

describe("subtasks in the main table", () => {
  const parent = task({ id: "p", column: "todo" });
  const early = task({
    id: "s1",
    parentId: "p",
    createdAt: "2026-08-02T09:00:00",
  });
  const late = task({
    id: "s2",
    parentId: "p",
    createdAt: "2026-08-03T09:00:00",
  });

  it("groups subtasks under their parent, oldest first", () => {
    const map = subtasksByParent([late, parent, early]);
    expect(map.get("p")?.map((t) => t.id)).toEqual(["s1", "s2"]);
    expect(map.has("s1")).toBe(false);
  });

  it("nests subtasks whose parent is showing", () => {
    expect(tableRows([parent, early, late]).map((t) => t.id)).toEqual(["p"]);
  });

  it("keeps a subtask as its own row when its parent is filtered out", () => {
    expect(tableRows([early]).map((t) => t.id)).toEqual(["s1"]);
  });
});

describe("custom sections in the main table", () => {
  const a = task({ id: "a", column: "todo", title: "B task" });
  const b = task({ id: "b", column: "todo", title: "A task" });
  const sections = [
    { id: "s1", title: "Sprint" },
    { id: "s2", title: "Backlog" },
  ];

  it("puts assigned tasks in their section and the rest in No section", () => {
    const groups = groupByCustom([a, b], sections, { a: "s1" }, "manual");
    expect(groups.map((g) => g.key)).toEqual([
      "custom-s1",
      "custom-s2",
      "custom-none",
    ]);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["a"]);
    expect(groups[1].tasks).toEqual([]);
    expect(groups[2].tasks.map((t) => t.id)).toEqual(["b"]);
  });

  it("keeps empty sections and marks them with their section id", () => {
    const groups = groupByCustom([], sections, {}, "manual");
    expect(groups.map((g) => g.customSectionId)).toEqual(["s1", "s2", null]);
    expect(groups.every((g) => g.defaults !== null)).toBe(true);
  });

  it("always keeps No section, even once everything is assigned", () => {
    const groups = groupByCustom(
      [a, b],
      sections,
      { a: "s1", b: "s2" },
      "manual",
    );
    expect(groups.map((g) => g.key)).toEqual([
      "custom-s1",
      "custom-s2",
      "custom-none",
    ]);
    expect(groups[2].tasks).toEqual([]);
  });

  it("treats assignments to deleted sections as unassigned", () => {
    const groups = groupByCustom([a], sections, { a: "gone" }, "manual");
    expect(groups[2].tasks.map((t) => t.id)).toEqual(["a"]);
  });

  it("uses a custom name for No section, falling back when blank", () => {
    const named = groupByCustom([a], [], {}, "manual", "Inbox");
    expect(named[0].label).toBe("Inbox");
    expect(named[0].customSectionId).toBeNull();
    expect(groupByCustom([a], [], {}, "manual", "  ")[0].label).toBe(
      "No section",
    );
  });

  it("prunes assignments for missing tasks and sections", () => {
    const pruned = pruneCustomAssign(
      { a: "s1", b: "gone", deleted: "s2" },
      [a, b],
      sections,
    );
    expect(pruned).toEqual({ a: "s1" });
  });

  it("reports nothing to prune when every entry is live", () => {
    expect(pruneCustomAssign({ a: "s1" }, [a, b], sections)).toBeNull();
  });

  it("sorts each section the way the table asked", () => {
    const c = task({ id: "c", column: "todo", title: "C task" });
    const groups = groupByCustom([c, a, b], [], {}, "title");
    expect(groups).toHaveLength(1);
    expect(groups[0].tasks.map((t) => t.id)).toEqual(["b", "a", "c"]);
  });
});
