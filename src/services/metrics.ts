import { WaypointError } from "../domain/errors.js";
import { assertDateOnly, statusesIn } from "../domain/item.js";
import type { Preset } from "../domain/preset.js";
import { addDays, daysBetween, localDate, startOfLocalDay, type Clock } from "../domain/time.js";
import type { ItemRepository, PlanRepository, UnitOfWork } from "./ports.js";

export const METRICS_MAX_RANGE_DAYS = 366;

export interface MetricsInput {
  from?: string | undefined;
  to?: string | undefined;
}

export interface DailyPlanMetrics {
  date: string;
  revision: number;
  dayStartUtc: string;
  dayEndUtc: string;
  plannedCount: number;
  completedPlannedCount: number;
  /** null when plannedCount is 0. */
  planCompletionRatio: number | null;
}

export interface Metrics {
  timezone: string;
  from: string;
  to: string;
  /** Inclusive lower bound of the completion interval. */
  startUtc: string;
  /** Exclusive upper bound of the completion interval. */
  endUtc: string;
  /** The instant current_open_count describes. */
  asOf: string;
  completedCount: number;
  currentOpenCount: number;
  dailyPlans: DailyPlanMetrics[];
}

export interface MetricsServiceDeps {
  preset: Preset;
  timezone: string;
  items: ItemRepository;
  plans: PlanRepository;
  tx: UnitOfWork;
  clock: Clock;
}

/** Deterministic metrics as defined in docs/metrics.md. */
export class MetricsService {
  constructor(private readonly deps: MetricsServiceDeps) {}

  get(input: MetricsInput): Metrics {
    const { preset, timezone, items, plans, tx, clock } = this.deps;
    const now = clock.now();
    const today = localDate(now, timezone);
    const from = input.from ?? input.to ?? today;
    const to = input.to ?? input.from ?? today;
    assertDateOnly("from", from);
    assertDateOnly("to", to);
    const span = daysBetween(from, to) + 1;
    if (span < 1) throw new WaypointError("validation", "from must be on or before to.");
    if (span > METRICS_MAX_RANGE_DAYS) {
      throw new WaypointError(
        "validation",
        `The range may cover at most ${METRICS_MAX_RANGE_DAYS} days.`,
      );
    }

    const executable = Object.entries(preset.itemTypes)
      .filter(([, t]) => t.executable)
      .map(([id]) => id);
    const startUtc = startOfLocalDay(from, timezone).toISOString();
    const endUtc = startOfLocalDay(addDays(to, 1), timezone).toISOString();

    return tx.read(() => ({
      timezone,
      from,
      to,
      startUtc,
      endUtc,
      asOf: now.toISOString(),
      completedCount: items.countCompletedBetween(executable, startUtc, endUtc),
      currentOpenCount: items.countPlanningCandidates(statusesIn(preset, "open"), executable),
      dailyPlans: plans.listBetween(from, to).map((plan) => {
        const dayStartUtc = startOfLocalDay(plan.date, timezone).toISOString();
        const dayEndUtc = startOfLocalDay(addDays(plan.date, 1), timezone).toISOString();
        const plannedCount = plan.itemIds.length;
        const completedPlannedCount = plans.countMembersCompletedBetween(
          plan.id,
          dayStartUtc,
          dayEndUtc,
        );
        return {
          date: plan.date,
          revision: plan.revision,
          dayStartUtc,
          dayEndUtc,
          plannedCount,
          completedPlannedCount,
          planCompletionRatio: plannedCount === 0 ? null : completedPlannedCount / plannedCount,
        };
      }),
    }));
  }
}
