import { describe, expect, it, vi } from "vitest";

// data.ts fetches through the onboarding UI module, which is a component
// file; the month helpers under test never touch it.
vi.mock("~/components/onboarding/ui", () => ({ api: vi.fn() }));

const {
  assigneeNames,
  assigneesOf,
  canEditTask,
  customSortKey,
  DEFAULT_HEADINGS,
  draftFrom,
  emptyDraft,
  finishedIn,
  finishersIn,
  groupByCustom,
  groupTasks,
  isAssignee,
  liveSorts,
  loadHeadings,
  matchesView,
  monthGrid,
  monthTallies,
  moveTask,
  nextSorts,
  pruneCustomAssign,
  richTextLines,
  saveHeadings,
  loadTaskFields,
  setFieldValue,
  shiftMonth,
  sortByColumns,
  subtasksByParent,
  tableRows,
  withoutColumnValues,
  workload,
} = await import("./data");
type Task = import("./data").Task;

function task(over: Partial<Task>): Task {
  // The lead and the people list stay in step, as the API keeps them.
  const lead = over.assigneeId ?? "u1";
  const person =
    lead === "u1"
      ? { id: "u1", name: "Priya", email: "p@x.test", image: null }
      : { id: lead, name: lead, email: `${lead}@x.test`, image: null };
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
    assigneeId: lead,
    assignee: person,
    assignees: [person],
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

describe("several assignees", () => {
  const priya = { id: "u1", name: "Priya", email: "p@x.test", image: null };
  const sam = { id: "u2", name: "Sam", email: "s@x.test", image: null };
  const lee = { id: "u3", name: "Lee", email: "l@x.test", image: null };
  const members = [priya, sam, lee].map(({ id, name, email, image }) => ({
    id,
    name,
    email,
    image,
  }));
  const shared = task({
    id: "s",
    column: "todo",
    assigneeId: "u1",
    assignee: priya,
    assignees: [priya, sam],
  });
  const solo = task({
    id: "o",
    column: "todo",
    assigneeId: "u3",
    assignee: lee,
    assignees: [lee],
  });
  const view = {
    tab: "table" as const,
    assignee: "all",
    priority: "all" as const,
    due: "all" as const,
    q: "",
    sort: "manual" as const,
    group: "due" as const,
  };

  it("lists everyone on a task, lead first, falling back to the lead", () => {
    expect(assigneesOf(shared).map((p) => p.id)).toEqual(["u1", "u2"]);
    const old = task({ assignees: [], assignee: priya });
    expect(assigneesOf(old).map((p) => p.id)).toEqual(["u1"]);
  });

  it("knows who is on a task, lead or not", () => {
    expect(isAssignee(shared, "u1")).toBe(true);
    expect(isAssignee(shared, "u2")).toBe(true);
    expect(isAssignee(shared, "u3")).toBe(false);
  });

  it("lets a co-assignee edit the task, but not an outsider", () => {
    const viewer = (userId: string) => ({
      userId,
      isOwner: false,
      role: "member",
    });
    expect(canEditTask(shared, viewer("u2"))).toBe(true);
    expect(canEditTask(shared, viewer("u3"))).toBe(false);
  });

  it("matches a person filter and a search against any assignee", () => {
    expect(matchesView(shared, { ...view, assignee: "u2" }, "u3")).toBe(true);
    expect(matchesView(shared, { ...view, assignee: "me" }, "u2")).toBe(true);
    expect(matchesView(solo, { ...view, assignee: "u2" }, "u3")).toBe(false);
    expect(matchesView(shared, { ...view, q: "sam" }, "u3")).toBe(true);
    expect(matchesView(shared, { ...view, q: "lee" }, "u3")).toBe(false);
  });

  it("shows a shared task under each person when grouped by assignee", () => {
    const groups = groupTasks([shared, solo], "assignee", "manual", members);
    const idsOf = (label: string) =>
      groups.find((g) => g.label === label)?.tasks.map((t) => t.id);
    expect(idsOf("Priya")).toEqual(["s"]);
    expect(idsOf("Sam")).toEqual(["s"]);
    expect(idsOf("Lee")).toEqual(["o"]);
    // A new task typed into Sam's group is assigned to Sam.
    expect(groups.find((g) => g.label === "Sam")?.defaults).toEqual({
      assigneeIds: ["u2"],
    });
  });

  it("counts a shared task toward each person's workload", () => {
    const rows = workload([shared, solo], members);
    const open = (name: string) =>
      rows.find((r) => r.member.name === name)?.open;
    expect(open("Priya")).toBe(1);
    expect(open("Sam")).toBe(1);
    expect(open("Lee")).toBe(1);
  });

  it("credits everyone on a finished task", () => {
    const done = task({
      id: "d",
      assigneeId: "u1",
      assignee: priya,
      assignees: [priya, sam],
      completedAt: "2026-09-14T10:00:00",
    });
    const finishers = finishersIn([done], "2026-09", members);
    expect(finishers.map((f) => [f.name, f.count])).toEqual([
      ["Priya", 1],
      ["Sam", 1],
    ]);
  });

  it("describes the people in plain words", () => {
    expect(assigneeNames(solo)).toBe("Lee");
    expect(assigneeNames(shared)).toBe("Priya and Sam");
    const crowd = task({ assignees: [priya, sam, lee, lee] });
    expect(assigneeNames(crowd)).toBe("Priya, Sam and 2 others");
    expect(assigneeNames(task({ assignees: [], assignee: null }))).toBe(
      "Unassigned",
    );
  });

  it("starts a draft from everyone on the task", () => {
    expect(draftFrom(shared).assigneeIds).toEqual(["u1", "u2"]);
    expect(emptyDraft("u3").assigneeIds).toEqual(["u3"]);
    expect(emptyDraft("").assigneeIds).toEqual([]);
  });
});

describe("sorting by columns", () => {
  const cost = { id: "c1", title: "Cost", type: "number" as const };
  const note = { id: "c2", title: "Note", type: "text" as const };
  const done = { id: "c3", title: "Done", type: "checkbox" as const };
  const columns = [cost, note, done];
  const a = task({ id: "a", column: "todo", title: "A", priority: "low" });
  const b = task({ id: "b", column: "todo", title: "B", priority: "high" });
  const c = task({ id: "c", column: "todo", title: "C", priority: "medium" });
  const values = {
    a: { c1: 10, c2: "pear", c3: true },
    b: { c1: 2, c2: "apple" },
    // c has no cost and no note at all.
  };
  const ids = (list: Task[]) => list.map((t) => t.id);

  it("sorts a number column both ways, with empty cells always last", () => {
    const asc = [{ key: customSortKey("c1"), dir: "asc" as const }];
    const desc = [{ key: customSortKey("c1"), dir: "desc" as const }];
    expect(ids(sortByColumns([a, b, c], asc, columns, values))).toEqual([
      "b",
      "a",
      "c",
    ]);
    expect(ids(sortByColumns([a, b, c], desc, columns, values))).toEqual([
      "a",
      "b",
      "c",
    ]);
  });

  it("sorts text naturally and checkboxes unchecked-first", () => {
    const text = [{ key: customSortKey("c2"), dir: "asc" as const }];
    expect(ids(sortByColumns([a, b, c], text, columns, values))).toEqual([
      "b",
      "a",
      "c",
    ]);
    const box = [{ key: customSortKey("c3"), dir: "asc" as const }];
    expect(ids(sortByColumns([a, b, c], box, columns, values))).toEqual([
      "b",
      "c",
      "a",
    ]);
  });

  it("breaks ties with the next sort", () => {
    const tied = { x: { c1: 5 }, y: { c1: 5 }, z: { c1: 1 } };
    const x = task({ id: "x", column: "todo", description: "beta" });
    const y = task({ id: "y", column: "todo", description: "alpha" });
    const z = task({ id: "z", column: "todo", description: "aaa" });
    const sorts = [
      { key: customSortKey("c1"), dir: "desc" as const },
      { key: "description", dir: "asc" as const },
    ];
    // x and y tie on cost (5), so the description decides: y ("alpha") first.
    expect(ids(sortByColumns([x, y, z], sorts, columns, tied))).toEqual([
      "y",
      "x",
      "z",
    ]);
    // Without the second sort the tie keeps the incoming order.
    expect(
      ids(sortByColumns([x, y, z], sorts.slice(0, 1), columns, tied)),
    ).toEqual(["x", "y", "z"]);
  });

  it("sorts the table's own columns, priority running low to high", () => {
    const sorts = [{ key: "priority", dir: "asc" as const }];
    expect(ids(sortByColumns([a, b, c], sorts, columns, {}))).toEqual([
      "a",
      "c",
      "b",
    ]);
  });

  it("returns the rows untouched with no sorts", () => {
    const rows = [c, a, b];
    expect(sortByColumns(rows, [], columns, values)).toBe(rows);
  });

  it("starts over on Sort and keeps the rest on Add sort", () => {
    const first = nextSorts([], "status", "asc", "replace");
    expect(first).toEqual([{ key: "status", dir: "asc" }]);
    const both = nextSorts(first, "date", "desc", "add");
    expect(both).toEqual([
      { key: "status", dir: "asc" },
      { key: "date", dir: "desc" },
    ]);
    expect(nextSorts(both, "status", "desc", "add")).toEqual([
      { key: "status", dir: "desc" },
      { key: "date", dir: "desc" },
    ]);
    expect(nextSorts(both, "priority", "asc", "replace")).toEqual([
      { key: "priority", dir: "asc" },
    ]);
  });

  it("drops sorts that point at a column that is gone", () => {
    const sorts = [
      { key: "status", dir: "asc" as const },
      { key: customSortKey("c1"), dir: "asc" as const },
      { key: customSortKey("gone"), dir: "asc" as const },
    ];
    expect(liveSorts(sorts, [cost]).map((s) => s.key)).toEqual([
      "status",
      "col:c1",
    ]);
  });
});

describe("added column values", () => {
  it("tokenises rich text without ever producing unsafe links", () => {
    const [line, second] = richTextLines(
      "a **bold** and *it* [site](https://x.dev) [bad](javascript:alert(1))\nsee https://y.dev",
    );
    expect(line.map((t) => t.kind)).toEqual([
      "text",
      "bold",
      "text",
      "italic",
      "text",
      "link",
      "text",
      "text",
      "text",
    ]);
    // The unsafe address is left as plain text, never made clickable.
    expect(
      line.some((t) => t.kind === "link" && t.href.startsWith("javascript")),
    ).toBe(false);
    expect(line[line.length - 2]).toEqual({
      kind: "text",
      text: "[bad](javascript:alert(1)",
    });
    expect(second[1]).toEqual({
      kind: "link",
      text: "https://y.dev",
      href: "https://y.dev/",
    });
  });

  it("sets and clears cell values without leaving empty shells", () => {
    let values = setFieldValue({}, "t1", "c1", "hi");
    values = setFieldValue(values, "t1", "c2", 5);
    expect(values).toEqual({ t1: { c1: "hi", c2: 5 } });
    values = setFieldValue(values, "t1", "c1", null);
    expect(values).toEqual({ t1: { c2: 5 } });
    expect(setFieldValue(values, "t1", "c2", null)).toEqual({});
  });

  it("deleting a column leaves none of its values behind", () => {
    const values = { t1: { c1: "a", c2: 3 }, t2: { c1: "b" } };
    expect(withoutColumnValues(values, "c1")).toEqual({ t1: { c2: 3 } });
    expect(withoutColumnValues(values, "missing")).toEqual(values);
  });

  it("builds the values map from the API's flat list", async () => {
    const { api } = await import("~/components/onboarding/ui");
    vi.mocked(api).mockResolvedValueOnce({
      ok: true,
      data: {
        fields: [{ id: "c1", title: "Cost", type: "number" }],
        values: [
          { taskId: "t1", fieldId: "c1", value: 12 },
          { taskId: "t2", fieldId: "c1", value: 3 },
        ],
      },
    } as never);
    expect(await loadTaskFields()).toEqual({
      columns: [{ id: "c1", title: "Cost", type: "number" }],
      values: { t1: { c1: 12 }, t2: { c1: 3 } },
    });
  });
});

describe("column headings", () => {
  function fakeStorage() {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => void store.set(k, v),
      },
    });
    return store;
  }

  it("returns the defaults when nothing was saved or there is no team", () => {
    fakeStorage();
    expect(loadHeadings("b1")).toEqual(DEFAULT_HEADINGS);
    expect(loadHeadings(undefined)).toEqual(DEFAULT_HEADINGS);
  });

  it("round-trips renamed headings per team and stores only the changes", () => {
    const store = fakeStorage();
    saveHeadings("b1", { ...DEFAULT_HEADINGS, status: "Stage" });
    expect(JSON.parse(store.get("tasks.column-headings.b1") as string)).toEqual(
      {
        status: "Stage",
      },
    );
    expect(loadHeadings("b1").status).toBe("Stage");
    expect(loadHeadings("b1").date).toBe("Date");
    expect(loadHeadings("b2")).toEqual(DEFAULT_HEADINGS);
  });

  it("ignores blank or malformed saved names", () => {
    const store = fakeStorage();
    store.set("tasks.column-headings.b1", '{"status":"  ","date":5}');
    expect(loadHeadings("b1")).toEqual(DEFAULT_HEADINGS);
    store.set("tasks.column-headings.b1", "not json");
    expect(loadHeadings("b1")).toEqual(DEFAULT_HEADINGS);
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
