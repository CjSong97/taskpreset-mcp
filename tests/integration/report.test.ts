import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { seedDemo, DEMO_END } from "../../src/cli/demo.js";
import { writeReport } from "../../src/cli/report.js";
import { openReadonlyStore, SqliteReportReader } from "../../src/storage/report.js";
import { buildReport, boardStatuses } from "../../src/services/report.js";
import { MetricsService } from "../../src/services/metrics.js";
import { SqliteItemRepository } from "../../src/storage/items.js";
import { SqlitePlanRepository } from "../../src/storage/plans.js";
import { expectWaypointError, testApp } from "../support/app.js";
import { tempDir, tempDbPath } from "../support/tmp.js";

const sha = (path: string) => createHash("sha256").update(readFileSync(path)).digest("hex");

function modelFor(path: string, asOf: string, includeTitles = true) {
  const store = openReadonlyStore(path);
  try {
    const clock = { now: () => new Date(`${asOf}T12:00:00Z`) };
    const items = new SqliteItemRepository(store.db);
    const plans = new SqlitePlanRepository(store.db);
    return buildReport(
      {
        preset: store.preset,
        timezone: store.timezone,
        reader: new SqliteReportReader(store.db),
        metrics: new MetricsService({
          preset: store.preset,
          timezone: store.timezone,
          items,
          plans,
          tx: store,
          clock,
        }),
        tx: store,
        clock,
      },
      { includeTitles },
    );
  } finally {
    store.close();
  }
}

describe("report model", () => {
  it("buckets completions by the store's local day across the London DST change", () => {
    const app = testApp();
    app.clock.set("2026-03-20T09:00:00Z");
    const ids = ["a", "b", "c"].map((title) => app.items.capture({ type: "task", title }).item.id);
    // 22:30Z is still 29 Mar in London (GMT); 23:30Z is 00:30 BST on 30 Mar, after the clocks go forward.
    app.clock.set("2026-03-29T22:30:00Z");
    app.items.complete(ids[0] as string);
    app.clock.set("2026-03-29T23:30:00Z");
    app.items.complete(ids[1] as string);
    app.clock.set("2026-03-30T08:00:00Z");
    app.items.complete(ids[2] as string);
    app.close();

    const model = modelFor(app.path, "2026-03-30");
    const count = (date: string) => model.daily.find((d) => d.date === date)?.count;
    expect(count("2026-03-29")).toBe(1);
    expect(count("2026-03-30")).toBe(2);
  });

  it("agrees with the metrics service and never counts containers on the board", () => {
    const app = testApp();
    app.clock.set("2026-10-01T09:00:00Z");
    const project = app.items.capture({ type: "project", title: "Container" }).item;
    const task = app.items.capture({
      type: "task",
      title: "Work",
      parentId: project.id,
      tags: ["Fire"],
    }).item;
    app.items.capture({ type: "task", title: "More work", tags: ["Fire", "Air"] });
    app.plans.commit({ itemIds: [task.id] });
    app.clock.set("2026-10-01T12:00:00Z");
    app.items.complete(task.id);
    app.close();

    const model = modelFor(app.path, "2026-10-01");
    const store = openReadonlyStore(app.path);
    let metrics;
    try {
      metrics = new MetricsService({
        preset: store.preset,
        timezone: store.timezone,
        items: new SqliteItemRepository(store.db),
        plans: new SqlitePlanRepository(store.db),
        tx: store,
        clock: { now: () => new Date("2026-10-01T12:00:00Z") },
      }).get({ from: "2026-10-01", to: "2026-10-01" });
    } finally {
      store.close();
    }

    expect(model.heatmap.total).toBe(metrics.completedCount);
    expect(model.totals.openWork).toBe(metrics.currentOpenCount);
    expect(model.totals.items).toBe(2); // the project is not on the board
    expect(model.columns.flatMap((c) => c.cards.map((card) => card.title))).not.toContain(
      "Container",
    );
    expect(model.todayPlan).toMatchObject({ planned: 1, completed: 1, ratio: 1 });
    expect(model.tags).toEqual([
      { tag: "Air", count: 1 },
      { tag: "Fire", count: 1 },
    ]);
  });

  it("orders columns open-first even though stored presets are key-sorted", () => {
    const app = testApp({ preset: "gtd-lite" });
    expect(boardStatuses(app.store.preset)).toEqual([
      "inbox",
      "next",
      "waiting",
      "done",
      "cancelled",
    ]);
    app.close();
  });
});

describe("report command", () => {
  it("writes HTML without modifying the store and never prints item content", () => {
    const app = testApp();
    const secret = "Confidential synthetic title 5e1a";
    app.items.capture({ type: "task", title: secret });
    app.close();
    const before = sha(app.path);
    const out = join(tempDir(), "report.html");

    const lines = writeReport({ source: app.path, out, asOf: undefined, includeTitles: true });

    expect(existsSync(out)).toBe(true);
    expect(readFileSync(out, "utf8")).toContain(secret);
    expect(lines.join("\n")).not.toContain(secret);
    expect(sha(app.path)).toBe(before);
  });

  it("omits titles with includeTitles=false", () => {
    const app = testApp();
    app.items.capture({ type: "task", title: "Private plan" });
    app.close();
    const out = join(tempDir(), "report.html");
    writeReport({ source: app.path, out, asOf: undefined, includeTitles: false });
    expect(readFileSync(out, "utf8")).not.toContain("Private plan");
  });

  it("refuses unsafe or invalid destinations and inputs", () => {
    const app = testApp();
    app.close();
    const dir = tempDir();
    const run = (out: string | undefined, asOf?: string) =>
      writeReport({ source: app.path, out, asOf, includeTitles: true });

    expectWaypointError(() => run(undefined), "config");
    expectWaypointError(() => run("relative.html"), "config");
    expectWaypointError(() => run(join(dir, "report.txt")), "config");
    expectWaypointError(() => run(join(dir, "ok.html"), "2026-02-30"), "config");
    run(join(dir, "ok.html"));
    expectWaypointError(() => run(join(dir, "ok.html")), "config"); // never overwrites
    expectWaypointError(
      () =>
        writeReport({
          source: tempDbPath(),
          out: join(dir, "x.html"),
          asOf: undefined,
          includeTitles: true,
        }),
      "config",
    );
  });

  it("rejects a store that was never created without creating it", () => {
    const missing = tempDbPath();
    expect(() => openReadonlyStore(missing)).toThrow(/No store/);
    expect(existsSync(missing)).toBe(false);
  });
});

describe("demo store", () => {
  it("is deterministic and renders for both bundled presets", () => {
    for (const preset of ["avatar-lite", "gtd-lite"]) {
      const a = join(tempDir(), "a.db");
      const b = join(tempDir(), "b.db");
      const first = seedDemo({ out: a, preset });
      const second = seedDemo({ out: b, preset });
      expect(first.slice(2, 3)).toEqual(second.slice(2, 3));

      const model = modelFor(a, DEMO_END);
      expect(model.heatmap.total).toBeGreaterThan(20);
      expect(model.columns.length).toBeGreaterThanOrEqual(4);
      expect(model.totals.openWork).toBeGreaterThanOrEqual(9);
      expect(modelFor(b, DEMO_END).daily).toEqual(model.daily);

      const out = join(tempDir(), "demo.html");
      writeReport({ source: a, out, asOf: DEMO_END, includeTitles: false });
      expect(readFileSync(out, "utf8")).toContain(model.presetName);
    }
  });

  it("only creates new stores at explicit absolute paths", () => {
    const path = join(tempDir(), "d.db");
    seedDemo({ out: path, preset: undefined });
    expectWaypointError(() => seedDemo({ out: path, preset: undefined }), "config");
    expectWaypointError(() => seedDemo({ out: undefined, preset: undefined }), "config");
    expectWaypointError(() => seedDemo({ out: "d.db", preset: undefined }), "config");
    expectWaypointError(() => seedDemo({ out: join(tempDir(), "e.db"), preset: "nope" }), "config");
  });
});
