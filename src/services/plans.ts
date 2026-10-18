import { WaypointError } from "../domain/errors.js";
import { assertDateOnly, statusesIn, type Item } from "../domain/item.js";
import { LIMITS } from "../domain/limits.js";
import type { Preset } from "../domain/preset.js";
import { localDate, type Clock } from "../domain/time.js";
import type { ItemRepository, UnitOfWork } from "./ports.js";

export interface PreviewInput {
  date?: string | undefined;
  maxItems?: number | undefined;
}

export interface PlanPreview {
  date: string;
  timezone: string;
  maxItems: number;
  candidates: Item[];
  totalEligible: number;
}

export interface PlanServiceDeps {
  preset: Preset;
  timezone: string;
  items: ItemRepository;
  tx: UnitOfWork;
  clock: Clock;
}

export class PlanService {
  constructor(private readonly deps: PlanServiceDeps) {}

  /** Today's calendar date in the store's timezone. */
  today(): string {
    return localDate(this.deps.clock.now(), this.deps.timezone);
  }

  /** Resolve and validate a plan date: defaults to today; past dates are rejected. */
  private planDate(date: string | undefined): string {
    const today = this.today();
    if (date === undefined) return today;
    assertDateOnly("date", date);
    if (date < today) {
      throw new WaypointError(
        "validation",
        `${date} is in the past (today is ${today} in ${this.deps.timezone}); past-day plans cannot be changed.`,
      );
    }
    return date;
  }

  private eligibility(): { statuses: string[]; types: string[] } {
    const { preset } = this.deps;
    return {
      statuses: statusesIn(preset, "open"),
      types: Object.entries(preset.itemTypes)
        .filter(([, t]) => t.executable)
        .map(([id]) => id),
    };
  }

  /**
   * Read-only suggestion of open executable work in deterministic order. It never writes and
   * implies no time scheduling or effort estimate.
   */
  preview(input: PreviewInput): PlanPreview {
    const { items, tx, timezone } = this.deps;
    const date = this.planDate(input.date);
    const maxItems = input.maxItems ?? LIMITS.planPreviewDefault;
    if (!Number.isInteger(maxItems) || maxItems < 1 || maxItems > LIMITS.planMaxItems) {
      throw new WaypointError(
        "validation",
        `max_items must be between 1 and ${LIMITS.planMaxItems}.`,
      );
    }
    const { statuses, types } = this.eligibility();
    return tx.read(() => ({
      date,
      timezone,
      maxItems,
      candidates: items.planningCandidates(statuses, types, maxItems),
      totalEligible: items.countPlanningCandidates(statuses, types),
    }));
  }
}
