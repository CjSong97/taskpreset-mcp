import { WaypointError } from "../domain/errors.js";
import {
  assertDateOnly,
  isExecutable,
  statusCategory,
  statusesIn,
  type Item,
} from "../domain/item.js";
import { LIMITS } from "../domain/limits.js";
import type { DayPlan } from "../domain/plan.js";
import type { Preset } from "../domain/preset.js";
import { localDate, type Clock } from "../domain/time.js";
import type { ItemRepository, PlanRepository, UnitOfWork } from "./ports.js";

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

export interface CommitInput {
  date?: string | undefined;
  /** Ordered member IDs. */
  itemIds: string[];
  /** Required when a plan already exists for the date; must match its current revision. */
  expectedRevision?: number | undefined;
}

export interface PlanWithItems {
  plan: DayPlan;
  /** Members in plan order with their current state. */
  items: Item[];
}

export interface PlanServiceDeps {
  preset: Preset;
  timezone: string;
  items: ItemRepository;
  plans: PlanRepository;
  tx: UnitOfWork;
  clock: Clock;
  newId: () => string;
}

export class PlanService {
  constructor(private readonly deps: PlanServiceDeps) {}

  get timezone(): string {
    return this.deps.timezone;
  }

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

  /** The committed plan for a date (today by default; past dates are readable), or null. */
  get(date?: string): PlanWithItems | null {
    const resolved = date ?? this.today();
    assertDateOnly("date", resolved);
    return this.deps.tx.read(() => {
      const plan = this.deps.plans.getByDate(resolved);
      return plan ? this.withItems(plan) : null;
    });
  }

  /**
   * Save an explicit ordered plan. A new plan starts at revision 1; replacing a plan requires
   * its current revision. Members must exist and be open executable work, except items already
   * in the plan being replaced (so finished work can stay planned). Item status and due dates
   * are never changed. All checks run before any write in one transaction.
   */
  commit(input: CommitInput): PlanWithItems {
    const { preset, items, plans, tx, clock, newId } = this.deps;
    const date = this.planDate(input.date);
    if (input.itemIds.length > LIMITS.planMaxItems) {
      throw new WaypointError("validation", `A plan holds at most ${LIMITS.planMaxItems} items.`);
    }
    const duplicates = input.itemIds.filter((id, i) => input.itemIds.indexOf(id) !== i);
    if (duplicates.length > 0) {
      throw new WaypointError("validation", "item_ids must not contain duplicates.", {
        duplicates: [...new Set(duplicates)],
      });
    }

    return tx.write(() => {
      const existing = plans.getByDate(date);
      if (existing) {
        if (input.expectedRevision !== existing.revision) {
          throw new WaypointError(
            "conflict",
            input.expectedRevision === undefined
              ? `A plan for ${date} already exists at revision ${existing.revision}; pass expected_revision to replace it.`
              : `The plan for ${date} is at revision ${existing.revision}, not ${input.expectedRevision}. Re-read it with get_day_plan and retry.`,
            { current_revision: existing.revision },
          );
        }
      } else if (input.expectedRevision !== undefined && input.expectedRevision !== 0) {
        throw new WaypointError(
          "conflict",
          `No plan exists for ${date}; omit expected_revision (or pass 0) to create one.`,
          { current_revision: 0 },
        );
      }

      const unknown: string[] = [];
      const ineligible: string[] = [];
      for (const id of input.itemIds) {
        const item = items.get(id);
        if (!item) {
          unknown.push(id);
          continue;
        }
        const alreadyPlanned = existing?.itemIds.includes(id) ?? false;
        const open = statusCategory(preset, item.status) === "open";
        if (!isExecutable(preset, item.type) || (!open && !alreadyPlanned)) ineligible.push(id);
      }
      if (unknown.length > 0) {
        throw new WaypointError("not_found", "Some item_ids do not exist.", { unknown });
      }
      if (ineligible.length > 0) {
        throw new WaypointError(
          "ineligible",
          "Plans may only include open executable work (or items already in this plan).",
          { ineligible },
        );
      }

      const now = clock.now().toISOString();
      let plan: DayPlan;
      if (existing) {
        plan = {
          ...existing,
          revision: existing.revision + 1,
          updatedAt: now,
          itemIds: input.itemIds,
        };
        plans.replace(plan);
      } else {
        plan = {
          id: newId(),
          date,
          revision: 1,
          createdAt: now,
          updatedAt: now,
          itemIds: input.itemIds,
        };
        plans.insert(plan);
      }
      return this.withItems(plan);
    });
  }

  private withItems(plan: DayPlan): PlanWithItems {
    const members = plan.itemIds.map((id) => {
      const item = this.deps.items.get(id);
      if (!item) throw new WaypointError("storage", `Plan member ${id} is missing.`);
      return item;
    });
    return { plan, items: members };
  }
}
