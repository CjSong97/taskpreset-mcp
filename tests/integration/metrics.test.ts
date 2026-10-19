import { describe, expect, it } from "vitest";
import { METRIC_FIXTURES } from "../fixtures/metrics.js";
import { expectTaskPresetError, testApp } from "../support/app.js";
import { runMetricFixture } from "../support/metrics-runner.js";

const basic = METRIC_FIXTURES.filter((f) => f.name.startsWith("basic"));

describe("get_metrics service", () => {
  it.each(basic)("matches hand-calculated fixture: $name", (fixture) => {
    for (const { expected, actual } of runMetricFixture(fixture)) {
      expect(actual).toEqual(expected);
    }
  });

  it("reports the timezone, range and as_of instant used", () => {
    const fixture = basic[0];
    if (!fixture) throw new Error("basic fixture missing");
    const [result] = runMetricFixture(fixture);
    expect(result?.metrics).toMatchObject({
      timezone: "Europe/London",
      from: "2026-10-20",
      to: "2026-10-20",
      asOf: "2026-10-21T08:00:00.000Z",
    });
    expect(result?.metrics.dailyPlans[0]).toMatchObject({
      dayStartUtc: "2026-10-19T23:00:00.000Z",
      dayEndUtc: "2026-10-20T23:00:00.000Z",
    });
  });

  it("never adds credit for repeated completion", () => {
    const app = testApp();
    const task = app.items.capture({ type: "task", title: "T" }).item;
    app.items.complete(task.id);
    const once = app.metrics.get({}).completedCount;
    app.clock.advance(60_000);
    app.items.complete(task.id);
    app.items.complete(task.id);
    expect(app.metrics.get({}).completedCount).toBe(once);
    expect(once).toBe(1);
  });

  it("treats current_open_count as a snapshot independent of the range", () => {
    const app = testApp();
    app.items.capture({ type: "task", title: "open" });
    expect(app.metrics.get({ from: "2020-01-01", to: "2020-01-01" }).currentOpenCount).toBe(1);
  });

  it("validates ranges", () => {
    const app = testApp();
    expectTaskPresetError(
      () => app.metrics.get({ from: "2026-10-20", to: "2026-10-19" }),
      "validation",
    );
    expectTaskPresetError(() => app.metrics.get({ from: "2026-02-30" }), "validation");
    expectTaskPresetError(
      () => app.metrics.get({ from: "2025-01-01", to: "2026-01-02" }),
      "validation",
    );
    expect(app.metrics.get({ from: "2025-01-01", to: "2026-01-01" }).from).toBe("2025-01-01");
  });
});
