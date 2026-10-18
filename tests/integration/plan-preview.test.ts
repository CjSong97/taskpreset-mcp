import { describe, expect, it } from "vitest";
import { WORKFLOWS } from "../fixtures/workflows.js";
import { expectWaypointError, testApp } from "../support/app.js";
import { dumpDatabase } from "../support/dump.js";

describe("plan_day preview", () => {
  function seed() {
    const app = testApp();
    const c = (title: string, extra: Record<string, unknown> = {}) => {
      const item = app.items.capture({ type: "task", title, ...extra }).item;
      app.clock.advance(1000);
      return item;
    };
    const lowUndated = c("low undated", { priority: 4 });
    const midLate = c("mid late", { priority: 3, dueDate: "2026-10-30" });
    const midUndated = c("mid undated", { priority: 3 });
    const midSoon = c("mid soon", { priority: 3, dueDate: "2026-10-19" });
    const top = c("top", { priority: 1 });
    const midSoonLater = c("mid soon later", { priority: 3, dueDate: "2026-10-19" });
    const project = app.items.capture({ type: "project", title: "container", priority: 1 }).item;
    const done = c("done", { priority: 1 });
    app.items.complete(done.id);
    const cancelled = c("cancelled", { priority: 1 });
    app.items.update({ id: cancelled.id, status: "cancelled" });
    return { app, lowUndated, midLate, midUndated, midSoon, top, midSoonLater, project };
  }

  it("orders eligible open executable work by priority, due date, then creation", () => {
    const s = seed();
    const preview = s.app.plans.preview({ maxItems: 20 });
    expect(preview.candidates.map((i) => i.id)).toEqual([
      s.top.id,
      s.midSoon.id,
      s.midSoonLater.id,
      s.midLate.id,
      s.midUndated.id,
      s.lowUndated.id,
    ]);
    expect(preview.totalEligible).toBe(6);
    expect(preview).toMatchObject({ date: "2026-10-18", timezone: "Europe/London", maxItems: 20 });
  });

  it("bounds the count and defaults to five", () => {
    const s = seed();
    expect(s.app.plans.preview({ maxItems: 2 }).candidates.map((i) => i.id)).toEqual([
      s.top.id,
      s.midSoon.id,
    ]);
    expect(s.app.plans.preview({}).candidates).toHaveLength(5);
    expectWaypointError(() => s.app.plans.preview({ maxItems: 0 }), "validation");
    expectWaypointError(() => s.app.plans.preview({ maxItems: 21 }), "validation");
  });

  it("is stable for identical input and clock and writes nothing", () => {
    const { app } = seed();
    const before = dumpDatabase(app.store.db);
    const first = app.plans.preview({ maxItems: 4, date: "2026-10-20" });
    const second = app.plans.preview({ maxItems: 4, date: "2026-10-20" });
    expect(second).toEqual(first);
    expect(dumpDatabase(app.store.db)).toEqual(before);
  });

  it("uses the store's local date and rejects past or malformed dates", () => {
    const { app } = seed();
    app.clock.set("2026-10-18T23:30:00.000Z"); // 00:30 BST on the 19th
    expect(app.plans.today()).toBe("2026-10-19");
    expect(app.plans.preview({}).date).toBe("2026-10-19");
    expectWaypointError(() => app.plans.preview({ date: "2026-10-18" }), "validation");
    expectWaypointError(() => app.plans.preview({ date: "2026-02-30" }), "validation");
  });

  it.each(WORKFLOWS)("suggests only executable work for $preset", (w) => {
    const app = testApp({ preset: w.preset });
    const container = app.items.capture({ type: w.container, title: "C", priority: 1 }).item;
    const work = app.items.capture({ type: w.work, title: "W", parentId: container.id }).item;
    expect(app.plans.preview({}).candidates.map((i) => i.id)).toEqual([work.id]);
  });
});
