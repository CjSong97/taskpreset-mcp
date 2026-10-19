import { describe, expect, it } from "vitest";
import { expectTaskPresetError, testApp } from "../support/app.js";
import { dumpDatabase } from "../support/dump.js";

function seed() {
  const app = testApp();
  const t = (title: string, dueDate?: string) =>
    app.items.capture({ type: "task", title, dueDate }).item;
  const a = t("A", "2026-10-18");
  const b = t("B");
  const c = t("C", "2026-10-25");
  const project = app.items.capture({ type: "project", title: "P" }).item;
  return { app, a, b, c, project };
}

describe("committing day plans", () => {
  it("saves an ordered plan at revision 1 and returns current item states", () => {
    const { app, a, b, c } = seed();
    app.clock.advance(60_000);
    const saved = app.plans.commit({ itemIds: [c.id, a.id, b.id] });
    expect(saved.plan).toMatchObject({
      date: "2026-10-18",
      revision: 1,
      createdAt: "2026-10-18T09:01:00.000Z",
      updatedAt: "2026-10-18T09:01:00.000Z",
      itemIds: [c.id, a.id, b.id],
    });
    expect(saved.items.map((i) => i.id)).toEqual([c.id, a.id, b.id]);

    app.items.complete(a.id);
    const read = app.plans.get();
    expect(read?.plan.itemIds).toEqual([c.id, a.id, b.id]);
    expect(read?.items[1]?.status).toBe("done");
  });

  it("never changes item status or due dates", () => {
    const { app, a, b, c } = seed();
    const itemsBefore = dumpDatabase(app.store.db).items;
    app.plans.commit({ itemIds: [a.id, b.id, c.id] });
    app.plans.commit({ itemIds: [b.id], expectedRevision: 1, date: "2026-10-18" });
    expect(dumpDatabase(app.store.db).items).toEqual(itemsBefore);
  });

  it("rejects duplicates, unknown and ineligible items atomically", () => {
    const { app, a, b, project } = seed();
    const done = app.items.capture({ type: "task", title: "D" }).item;
    app.items.complete(done.id);
    const cancelled = app.items.capture({ type: "task", title: "X" }).item;
    app.items.update({ id: cancelled.id, status: "cancelled" });
    const before = dumpDatabase(app.store.db);

    expectTaskPresetError(() => app.plans.commit({ itemIds: [a.id, a.id] }), "validation");
    const unknown = expectTaskPresetError(
      () => app.plans.commit({ itemIds: [a.id, "00000000-0000-4000-8000-000000000000"] }),
      "not_found",
    );
    expect(unknown.details).toEqual({ unknown: ["00000000-0000-4000-8000-000000000000"] });
    const ineligible = expectTaskPresetError(
      () => app.plans.commit({ itemIds: [b.id, project.id, done.id, cancelled.id] }),
      "ineligible",
    );
    expect(ineligible.details).toEqual({ ineligible: [project.id, done.id, cancelled.id] });
    expect(dumpDatabase(app.store.db)).toEqual(before);
  });

  it("replaces a plan with the expected revision and keeps already-planned finished work", () => {
    const { app, a, b, c } = seed();
    app.plans.commit({ itemIds: [a.id, b.id] });
    app.items.complete(a.id);
    app.items.complete(c.id);

    const revised = app.plans.commit({ itemIds: [b.id, a.id], expectedRevision: 1 });
    expect(revised.plan.revision).toBe(2);
    expect(revised.plan.itemIds).toEqual([b.id, a.id]);

    // c is done but was never in the plan, so it cannot be added now.
    expectTaskPresetError(
      () => app.plans.commit({ itemIds: [b.id, c.id], expectedRevision: 2 }),
      "ineligible",
    );
  });

  it("allows an empty plan and reports no plan as null", () => {
    const { app } = seed();
    expect(app.plans.get("2026-10-19")).toBeNull();
    expect(app.plans.commit({ itemIds: [], date: "2026-10-19" }).items).toEqual([]);
  });

  it("enforces the plan size limit", () => {
    const { app } = seed();
    const ids = Array.from(
      { length: 21 },
      (_, i) => app.items.capture({ type: "task", title: `T${i}` }).item.id,
    );
    expectTaskPresetError(() => app.plans.commit({ itemIds: ids }), "validation");
  });
});
