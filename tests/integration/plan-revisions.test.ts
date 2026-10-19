import { describe, expect, it } from "vitest";
import { expectTaskPresetError, testApp } from "../support/app.js";
import { dumpDatabase } from "../support/dump.js";

function seed() {
  const app = testApp();
  const ids = ["A", "B", "C"].map((title) => app.items.capture({ type: "task", title }).item.id);
  return { app, ids: ids as [string, string, string] };
}

describe("plan revisions", () => {
  it("rejects stale, missing and spurious expected revisions without changes", () => {
    const { app, ids } = seed();
    expectTaskPresetError(
      () => app.plans.commit({ itemIds: [ids[0]], expectedRevision: 3 }),
      "conflict",
    );
    app.plans.commit({ itemIds: [ids[0]] });
    app.plans.commit({ itemIds: [ids[1]], expectedRevision: 1 });
    const before = dumpDatabase(app.store.db);

    const stale = expectTaskPresetError(
      () => app.plans.commit({ itemIds: [ids[2]], expectedRevision: 1 }),
      "conflict",
    );
    expect(stale.details).toEqual({ current_revision: 2 });
    expectTaskPresetError(() => app.plans.commit({ itemIds: [ids[2]] }), "conflict");
    expect(dumpDatabase(app.store.db)).toEqual(before);
    expect(app.plans.get()?.plan).toMatchObject({ revision: 2, itemIds: [ids[1]] });
  });

  it("accepts expected_revision 0 for a new plan", () => {
    const { app, ids } = seed();
    expect(app.plans.commit({ itemIds: [ids[0]], expectedRevision: 0 }).plan.revision).toBe(1);
  });
});

describe("plan date boundaries", () => {
  it("maps 'today' to the Europe/London calendar date in summer and winter", () => {
    const { app, ids } = seed();
    app.clock.set("2026-07-01T23:30:00.000Z"); // 00:30 BST on 2 July
    expect(app.plans.commit({ itemIds: [ids[0]] }).plan.date).toBe("2026-07-02");
    app.clock.set("2026-12-01T23:30:00.000Z"); // 23:30 GMT on 1 December
    expect(app.plans.commit({ itemIds: [ids[0]] }).plan.date).toBe("2026-12-01");
  });

  it("refuses to edit a plan once its local day has passed, but still reads it", () => {
    const { app, ids } = seed();
    app.clock.set("2026-10-18T22:59:00.000Z"); // 23:59 BST
    app.plans.commit({ itemIds: [ids[0], ids[1]] });
    app.clock.set("2026-10-18T23:00:00.000Z"); // 00:00 BST on the 19th
    const before = dumpDatabase(app.store.db);

    expectTaskPresetError(
      () => app.plans.commit({ date: "2026-10-18", itemIds: [ids[2]], expectedRevision: 1 }),
      "validation",
    );
    expect(dumpDatabase(app.store.db)).toEqual(before);
    expect(app.plans.get("2026-10-18")?.plan.itemIds).toEqual([ids[0], ids[1]]);
    expect(app.plans.get()).toBeNull();
  });

  it("rejects malformed dates without partial membership changes", () => {
    const { app, ids } = seed();
    app.plans.commit({ itemIds: [ids[0]] });
    const before = dumpDatabase(app.store.db);
    for (const date of ["2026-10-32", "2026-02-29", "18-10-2026", "2026-10-18T00:00:00Z"]) {
      expectTaskPresetError(
        () => app.plans.commit({ date, itemIds: [ids[1]], expectedRevision: 1 }),
        "validation",
      );
    }
    expectTaskPresetError(() => app.plans.get("not-a-date"), "validation");
    expect(dumpDatabase(app.store.db)).toEqual(before);
  });

  it("plans future dates independently", () => {
    const { app, ids } = seed();
    app.plans.commit({ itemIds: [ids[0]] });
    const tomorrow = app.plans.commit({ date: "2026-10-19", itemIds: [ids[0], ids[1]] });
    expect(tomorrow.plan.revision).toBe(1);
    expect(app.plans.get("2026-10-18")?.plan.itemIds).toEqual([ids[0]]);
  });
});
