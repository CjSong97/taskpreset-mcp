import type { MetricFixture } from "../fixtures/metrics.js";
import { testApp } from "./app.js";

/** Replay a fixture's steps on a fresh store and return each query's actual metrics. */
export function runMetricFixture(fixture: MetricFixture) {
  const app = testApp();
  const ids = new Map<string, string>();
  const id = (key: string) => {
    const value = ids.get(key);
    if (value === undefined) throw new Error(`fixture references unknown key ${key}`);
    return value;
  };

  for (const step of fixture.steps) {
    app.clock.set(step.at);
    if ("capture" in step) {
      ids.set(
        step.capture,
        app.items.capture({ type: step.type ?? "task", title: step.capture }).item.id,
      );
    } else if ("complete" in step) {
      app.items.complete(id(step.complete));
    } else if ("cancel" in step) {
      app.items.update({ id: id(step.cancel), status: "cancelled" });
    } else {
      app.plans.commit({
        date: step.plan,
        itemIds: step.members.map(id),
        expectedRevision: step.expectedRevision,
      });
    }
  }

  return fixture.queries.map((query) => {
    app.clock.set(query.at);
    const m = app.metrics.get({ from: query.from, to: query.to });
    return {
      expected: query.expected,
      actual: {
        start_utc: m.startUtc,
        end_utc: m.endUtc,
        completed_count: m.completedCount,
        current_open_count: m.currentOpenCount,
        daily_plans: m.dailyPlans.map((d) => ({
          date: d.date,
          revision: d.revision,
          planned_count: d.plannedCount,
          completed_planned_count: d.completedPlannedCount,
          plan_completion_ratio: d.planCompletionRatio,
        })),
      },
      metrics: m,
    };
  });
}
