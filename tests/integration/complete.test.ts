import { describe, expect, it } from "vitest";
import { expectWaypointError, testApp } from "../support/app.js";

describe("complete_item service", () => {
  it("sets the done status and completed_at atomically", () => {
    const app = testApp();
    const task = app.items.capture({ type: "task", title: "T" }).item;
    app.clock.advance(5 * 60_000);
    const { item, alreadyCompleted } = app.items.complete(task.id);
    expect(alreadyCompleted).toBe(false);
    expect(item.status).toBe("done");
    expect(item.completedAt).toBe("2026-10-18T09:05:00.000Z");
    expect(item.updatedAt).toBe("2026-10-18T09:05:00.000Z");
    expect(app.items.query({ id: task.id }).items[0]).toEqual(item);
  });

  it("returns the original completion on repeat calls", () => {
    const app = testApp();
    const task = app.items.capture({ type: "task", title: "T" }).item;
    const first = app.items.complete(task.id).item;
    app.clock.advance(3_600_000);
    const second = app.items.complete(task.id);
    expect(second.alreadyCompleted).toBe(true);
    expect(second.item).toEqual(first);
  });

  it("does not complete children of a completed project", () => {
    const app = testApp();
    const project = app.items.capture({ type: "project", title: "P" }).item;
    const child = app.items.capture({ type: "task", title: "C", parentId: project.id }).item;
    app.items.complete(project.id);
    expect(app.items.query({ id: child.id }).items[0]?.status).toBe("not_started");
  });

  it("rejects unknown and cancelled items without writing", () => {
    const app = testApp();
    expectWaypointError(
      () => app.items.complete("00000000-0000-4000-8000-000000000000"),
      "not_found",
    );
    const task = app.items.capture({ type: "task", title: "T" }).item;
    app.store.db.prepare("UPDATE items SET status = 'cancelled' WHERE id = ?").run(task.id);
    expectWaypointError(() => app.items.complete(task.id), "invalid_transition");
    const stored = app.items.query({ id: task.id }).items[0];
    expect(stored?.status).toBe("cancelled");
    expect(stored?.completedAt).toBeNull();
  });
});
