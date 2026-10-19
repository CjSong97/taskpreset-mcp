import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { App } from "../../src/app.js";
import { expectTaskPresetError, testApp } from "../support/app.js";
import { tempDir } from "../support/tmp.js";

function snapshot(app: App, id: string) {
  return app.items.query({ id }).items[0];
}

describe("update_item service", () => {
  it("edits approved fields and stamps updated_at", () => {
    const app = testApp();
    const task = app.items.capture({
      type: "task",
      title: "Old",
      description: "desc",
      dueDate: "2026-10-20",
    }).item;
    app.clock.advance(60_000);
    const updated = app.items.update({
      id: task.id,
      title: " New ",
      tags: ["air", "air"],
      priority: 1,
      description: null,
      dueDate: null,
    });
    expect(updated).toMatchObject({
      title: "New",
      tags: ["air"],
      priority: 1,
      description: null,
      dueDate: null,
      createdAt: task.createdAt,
      updatedAt: "2026-10-18T09:01:00.000Z",
      completedAt: null,
    });
    expect(snapshot(app, task.id)).toEqual(updated);
  });

  it("applies permitted transitions, including cancellation", () => {
    const app = testApp();
    const task = app.items.capture({ type: "task", title: "T" }).item;
    expect(app.items.update({ id: task.id, status: "in_progress" }).status).toBe("in_progress");
    const cancelled = app.items.update({ id: task.id, status: "cancelled" });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.completedAt).toBeNull();
  });

  it("rejects illegal transitions without writing", () => {
    const app = testApp();
    const task = app.items.capture({ type: "task", title: "T" }).item;
    expectTaskPresetError(
      () => app.items.update({ id: task.id, status: "done" }),
      "invalid_transition",
    );
    expectTaskPresetError(() => app.items.update({ id: task.id, status: "nope" }), "validation");

    app.items.update({ id: task.id, status: "cancelled" });
    const cancelled = snapshot(app, task.id);
    const error = expectTaskPresetError(
      () => app.items.update({ id: task.id, status: "not_started", title: "Changed" }),
      "invalid_transition",
    );
    expect(error.details).toEqual({ allowed: [] });
    expect(snapshot(app, task.id)).toEqual(cancelled);
  });

  it("never reopens or moves completed work, but allows editing its details", () => {
    const app = testApp();
    const task = app.items.capture({ type: "task", title: "T" }).item;
    const done = app.items.complete(task.id).item;
    expectTaskPresetError(
      () => app.items.update({ id: task.id, status: "in_progress" }),
      "invalid_transition",
    );
    expectTaskPresetError(
      () => app.items.update({ id: task.id, status: "cancelled" }),
      "invalid_transition",
    );
    expect(snapshot(app, task.id)).toEqual(done);

    const renamed = app.items.update({ id: task.id, title: "Renamed" });
    expect(renamed.status).toBe("done");
    expect(renamed.completedAt).toBe(done.completedAt);
  });

  it("validates re-parenting and leaves the item unchanged on failure", () => {
    const app = testApp();
    const project = app.items.capture({ type: "project", title: "P" }).item;
    const goal = app.items.capture({ type: "goal", title: "G" }).item;
    const task = app.items.capture({ type: "task", title: "T" }).item;

    expect(app.items.update({ id: task.id, parentId: goal.id }).parentId).toBe(goal.id);
    expect(app.items.update({ id: goal.id, parentId: project.id }).parentId).toBe(project.id);
    expect(app.items.update({ id: task.id, parentId: null }).parentId).toBeNull();

    const before = snapshot(app, project.id);
    expectTaskPresetError(
      () => app.items.update({ id: project.id, parentId: goal.id }),
      "validation",
    );
    expectTaskPresetError(
      () => app.items.update({ id: task.id, parentId: "00000000-0000-4000-8000-000000000000" }),
      "not_found",
    );
    expect(snapshot(app, project.id)).toEqual(before);
  });

  it("rejects cycles for self-nesting types", () => {
    const presetPath = join(tempDir(), "areas.json");
    writeFileSync(
      presetPath,
      JSON.stringify({
        id: "areas-test",
        version: "1.0.0",
        name: "Areas",
        description: "Synthetic preset with self-nesting areas.",
        tagLabel: "Tag",
        itemTypes: {
          area: { label: "Area", executable: false, parents: ["area"], rootAllowed: true },
          todo: { label: "Todo", executable: true, parents: ["area"], rootAllowed: true },
        },
        statuses: {
          open: { label: "Open", category: "open" },
          done: { label: "Done", category: "done" },
        },
        initialStatuses: ["open"],
        transitions: {},
      }),
    );
    const app = testApp({ preset: presetPath });
    const a = app.items.capture({ type: "area", title: "A" }).item;
    const b = app.items.capture({ type: "area", title: "B", parentId: a.id }).item;
    const c = app.items.capture({ type: "area", title: "C", parentId: b.id }).item;

    expectTaskPresetError(() => app.items.update({ id: a.id, parentId: c.id }), "validation");
    expectTaskPresetError(() => app.items.update({ id: a.id, parentId: a.id }), "validation");
    expect(snapshot(app, a.id)?.parentId).toBeNull();
  });

  it("requires at least one change and an existing item", () => {
    const app = testApp();
    const task = app.items.capture({ type: "task", title: "T" }).item;
    expectTaskPresetError(() => app.items.update({ id: task.id }), "validation");
    expectTaskPresetError(
      () => app.items.update({ id: "00000000-0000-4000-8000-000000000000", title: "X" }),
      "not_found",
    );
  });
});
