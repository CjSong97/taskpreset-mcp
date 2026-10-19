import { describe, expect, it } from "vitest";
import { countItems, expectTaskPresetError, testApp } from "../support/app.js";

describe("capture_item service", () => {
  it("creates an item with preset defaults and clock timestamps", () => {
    const app = testApp();
    const { item, replayed } = app.items.capture({ type: "task", title: "  Write report  " });
    expect(replayed).toBe(false);
    expect(item).toMatchObject({
      type: "task",
      title: "Write report",
      description: null,
      status: "not_started",
      parentId: null,
      tags: [],
      priority: 3,
      dueDate: null,
      createdAt: "2026-10-18T09:00:00.000Z",
      updatedAt: "2026-10-18T09:00:00.000Z",
      completedAt: null,
    });
    expect(item.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("nests items according to allowed parent types", () => {
    const app = testApp();
    const project = app.items.capture({ type: "project", title: "P" }).item;
    const goal = app.items.capture({ type: "goal", title: "G", parentId: project.id }).item;
    const task = app.items.capture({ type: "task", title: "T", parentId: goal.id }).item;
    expect(task.parentId).toBe(goal.id);

    expectTaskPresetError(
      () => app.items.capture({ type: "project", title: "X", parentId: task.id }),
      "validation",
    );
    expectTaskPresetError(
      () =>
        app.items.capture({
          type: "task",
          title: "X",
          parentId: "00000000-0000-4000-8000-000000000000",
        }),
      "not_found",
    );
  });

  it("rejects invalid input without writing anything", () => {
    const app = testApp();
    expectTaskPresetError(() => app.items.capture({ type: "epic", title: "X" }), "validation");
    expectTaskPresetError(() => app.items.capture({ type: "task", title: "   " }), "validation");
    expectTaskPresetError(
      () => app.items.capture({ type: "task", title: "X", status: "done" }),
      "validation",
    );
    expectTaskPresetError(
      () => app.items.capture({ type: "task", title: "X", status: "nope" }),
      "validation",
    );
    expectTaskPresetError(
      () => app.items.capture({ type: "task", title: "X", dueDate: "2026-02-30" }),
      "validation",
    );
    expect(countItems(app)).toBe(0);
  });

  it("replays a capture with the same request_id and payload", () => {
    const app = testApp();
    const first = app.items.capture({ type: "task", title: "Once", requestId: "req-1" });
    app.clock.advance(60_000);
    const again = app.items.capture({ type: "task", title: "Once", requestId: "req-1" });
    expect(again.replayed).toBe(true);
    expect(again.item).toEqual(first.item);
    expect(countItems(app)).toBe(1);
  });

  it("rejects a reused request_id with a different payload", () => {
    const app = testApp();
    const first = app.items.capture({ type: "task", title: "Once", requestId: "req-1" });
    const error = expectTaskPresetError(
      () => app.items.capture({ type: "task", title: "Different", requestId: "req-1" }),
      "conflict",
    );
    expect(error.details).toEqual({ item_id: first.item.id });
    expect(countItems(app)).toBe(1);
  });
});

describe("query_items service", () => {
  function seed() {
    const app = testApp();
    const project = app.items.capture({ type: "project", title: "P" }).item;
    app.clock.advance(1000);
    const a = app.items.capture({
      type: "task",
      title: "A",
      parentId: project.id,
      tags: ["fire"],
      dueDate: "2026-10-20",
    }).item;
    app.clock.advance(1000);
    const b = app.items.capture({
      type: "task",
      title: "B",
      status: "in_progress",
      tags: ["water"],
      dueDate: "2026-10-25",
    }).item;
    app.clock.advance(1000);
    const c = app.items.capture({ type: "task", title: "C", tags: ["fire", "air"] }).item;
    return { app, project, a, b, c };
  }

  it("filters by type, status, category, parent, root, tag and due range", () => {
    const { app, project, a, b, c } = seed();
    const ids = (input: Parameters<typeof app.items.query>[0]) =>
      app.items.query(input).items.map((i) => i.id);

    expect(ids({ type: "task" })).toEqual([a.id, b.id, c.id]);
    expect(ids({ statuses: ["in_progress"] })).toEqual([b.id]);
    expect(ids({ statusCategory: "open", type: "task" })).toEqual([a.id, b.id, c.id]);
    expect(ids({ statusCategory: "done" })).toEqual([]);
    expect(ids({ parentId: project.id })).toEqual([a.id]);
    expect(ids({ rootOnly: true })).toEqual([project.id, b.id, c.id]);
    expect(ids({ tag: "fire" })).toEqual([a.id, c.id]);
    expect(ids({ dueFrom: "2026-10-21" })).toEqual([b.id]);
    expect(ids({ dueTo: "2026-10-20" })).toEqual([a.id]);
    expect(ids({ id: b.id })).toEqual([b.id]);
  });

  it("returns not_found for an unknown single id and validates filters", () => {
    const { app } = seed();
    expectTaskPresetError(
      () => app.items.query({ id: "00000000-0000-4000-8000-000000000000" }),
      "not_found",
    );
    expectTaskPresetError(() => app.items.query({ type: "epic" }), "validation");
    expectTaskPresetError(() => app.items.query({ statuses: ["nope"] }), "validation");
    expectTaskPresetError(() => app.items.query({ dueFrom: "2026-02-31" }), "validation");
    expectTaskPresetError(() => app.items.query({ cursor: "garbage" }), "validation");
  });

  it("paginates deterministically, including items created in the same instant", () => {
    const app = testApp();
    const created = Array.from(
      { length: 7 },
      (_, i) => app.items.capture({ type: "task", title: `T${i}` }).item.id,
    );
    const expected = [...created].sort(); // same createdAt, so ordered by id

    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = app.items.query({ limit: 3, cursor });
      seen.push(...page.items.map((i) => i.id));
      cursor = page.nextCursor ?? undefined;
      pages += 1;
    } while (cursor !== undefined);

    expect(pages).toBe(3);
    expect(seen).toEqual(expected);
    expect(app.items.query({ limit: 3 }).items.map((i) => i.id)).toEqual(expected.slice(0, 3));
  });

  it("caps the page size", () => {
    const app = testApp();
    for (let i = 0; i < 3; i++) app.items.capture({ type: "task", title: `T${i}` });
    expect(app.items.query({ limit: 1000 }).items).toHaveLength(3);
  });
});
