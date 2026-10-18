import { describe, expect, it } from "vitest";
import { METRIC_FIXTURES } from "../fixtures/metrics.js";
import { testApp } from "../support/app.js";
import { runMetricFixture } from "../support/metrics-runner.js";

const edgeFixtures = METRIC_FIXTURES.filter((f) => !f.name.startsWith("basic"));
const HOUR = 3_600_000;

function fixture(prefix: string) {
  const found = METRIC_FIXTURES.find((f) => f.name.startsWith(prefix));
  if (!found) throw new Error(`fixture ${prefix} missing`);
  return found;
}

describe("metric edge cases", () => {
  it.each(edgeFixtures)("matches hand-calculated fixture: $name", (f) => {
    for (const { expected, actual } of runMetricFixture(f)) {
      expect(actual).toEqual(expected);
    }
  });

  it.each([
    ["spring-forward", 23],
    ["fall-back", 25],
  ])("uses a %s local day of %i hours", (prefix, hours) => {
    const [first] = runMetricFixture(fixture(prefix));
    const m = first?.metrics;
    if (!m) throw new Error("no result");
    expect((Date.parse(m.endUtc) - Date.parse(m.startUtc)) / HOUR).toBe(hours);
    const plan = m.dailyPlans[0];
    expect(plan && (Date.parse(plan.dayEndUtc) - Date.parse(plan.dayStartUtc)) / HOUR).toBe(hours);
  });

  it("keeps cancelled plan members in the denominator", () => {
    const app = testApp();
    const ids = ["a", "b"].map((t) => app.items.capture({ type: "task", title: t }).item.id);
    app.plans.commit({ itemIds: ids });
    app.items.complete(ids[0] ?? "");
    app.items.update({ id: ids[1] ?? "", status: "cancelled" });
    expect(app.metrics.get({}).dailyPlans[0]).toMatchObject({
      plannedCount: 2,
      completedPlannedCount: 1,
      planCompletionRatio: 0.5,
    });
  });

  it("counts a completion at local midnight in the new day only", () => {
    const app = testApp();
    const task = app.items.capture({ type: "task", title: "t" }).item;
    app.clock.set("2026-10-18T23:00:00.000Z"); // 00:00 BST on 19 October
    app.items.complete(task.id);
    expect(app.metrics.get({ from: "2026-10-18" }).completedCount).toBe(0);
    expect(app.metrics.get({ from: "2026-10-19" }).completedCount).toBe(1);
    expect(app.metrics.get({ from: "2026-10-18", to: "2026-10-19" }).completedCount).toBe(1);
  });

  it("does not count containers as completed or open work", () => {
    const app = testApp();
    const project = app.items.capture({ type: "project", title: "p" }).item;
    app.items.capture({ type: "goal", title: "g" });
    app.items.complete(project.id);
    const m = app.metrics.get({});
    expect(m.completedCount).toBe(0);
    expect(m.currentOpenCount).toBe(0);
  });
});
