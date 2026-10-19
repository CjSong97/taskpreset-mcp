import type { Item } from "../domain/item.js";
import type { DayPlan } from "../domain/plan.js";

/** Keyset position: items are ordered by (createdAt, id). */
export interface ItemCursor {
  createdAt: string;
  id: string;
}

export interface ItemFilter {
  id?: string | undefined;
  type?: string | undefined;
  statuses?: string[] | undefined;
  parentId?: string | undefined;
  rootOnly?: boolean | undefined;
  tag?: string | undefined;
  dueFrom?: string | undefined;
  dueTo?: string | undefined;
}

export interface ItemRepository {
  insert(item: Item, request?: { id: string; fingerprint: string }): void;
  get(id: string): Item | undefined;
  findByRequestId(requestId: string): { item: Item; fingerprint: string } | undefined;
  query(filter: ItemFilter, limit: number, after?: ItemCursor): Item[];
  update(item: Item): void;
  /** IDs from the item's parent up to the root. */
  ancestorIds(id: string): string[];
  /**
   * Items with one of `statuses` and one of `types`, ordered for planning: priority, due date
   * (undated last), creation time, id.
   */
  planningCandidates(statuses: string[], types: string[], limit: number): Item[];
  countPlanningCandidates(statuses: string[], types: string[]): number;
  /** Items of `types` with completed_at in [startUtc, endUtc). */
  countCompletedBetween(types: string[], startUtc: string, endUtc: string): number;
}

/** Read-only queries behind the static report. */
export interface ReportReader {
  /** Count of `types` items per status that has at least one. */
  statusCounts(types: string[]): Record<string, number>;
  /**
   * Up to `limit` `types` items in `status`. `order` "work" puts the most important first
   * (priority, due date, creation); "recent" puts the latest change first.
   */
  cards(status: string, types: string[], order: "work" | "recent", limit: number): Item[];
  /** completed_at instants of `types` items in [startUtc, endUtc). */
  completedAt(types: string[], startUtc: string, endUtc: string): string[];
  /** Number of `types` items in `statuses` per tag, most frequent first. */
  tagCounts(statuses: string[], types: string[]): { tag: string; count: number }[];
}

/** Transaction boundary implemented by the store. */
export interface UnitOfWork {
  write<T>(fn: () => T): T;
  read<T>(fn: () => T): T;
}

export interface PlanRepository {
  getByDate(date: string): DayPlan | undefined;
  insert(plan: DayPlan): void;
  /** Replace membership and bump revision/updated_at of an existing plan. */
  replace(plan: DayPlan): void;
  /** Plans dated within [from, to] (inclusive local dates), in date order. */
  listBetween(from: string, to: string): DayPlan[];
  /** Members of the plan whose completed_at is in [startUtc, endUtc). */
  countMembersCompletedBetween(planId: string, startUtc: string, endUtc: string): number;
}
