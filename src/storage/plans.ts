import type Database from "better-sqlite3";
import type { DayPlan } from "../domain/plan.js";
import type { PlanRepository } from "../services/ports.js";

interface PlanRow {
  id: string;
  plan_date: string;
  revision: number;
  created_at: string;
  updated_at: string;
}

export class SqlitePlanRepository implements PlanRepository {
  constructor(private readonly db: Database.Database) {}

  getByDate(date: string): DayPlan | undefined {
    const row = this.db
      .prepare<[string], PlanRow>(
        "SELECT id, plan_date, revision, created_at, updated_at FROM day_plans WHERE plan_date = ?",
      )
      .get(date);
    if (!row) return undefined;
    const itemIds = this.db
      .prepare<[string], { item_id: string }>(
        "SELECT item_id FROM day_plan_items WHERE plan_id = ? ORDER BY position",
      )
      .all(row.id)
      .map((r) => r.item_id);
    return {
      id: row.id,
      date: row.plan_date,
      revision: row.revision,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      itemIds,
    };
  }

  insert(plan: DayPlan): void {
    this.db
      .prepare(
        "INSERT INTO day_plans (id, plan_date, revision, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
      )
      .run(plan.id, plan.date, plan.revision, plan.createdAt, plan.updatedAt);
    this.insertMembers(plan);
  }

  replace(plan: DayPlan): void {
    this.db
      .prepare("UPDATE day_plans SET revision = ?, updated_at = ? WHERE id = ?")
      .run(plan.revision, plan.updatedAt, plan.id);
    this.db.prepare("DELETE FROM day_plan_items WHERE plan_id = ?").run(plan.id);
    this.insertMembers(plan);
  }

  listBetween(from: string, to: string): DayPlan[] {
    return this.db
      .prepare<[string, string], { plan_date: string }>(
        "SELECT plan_date FROM day_plans WHERE plan_date >= ? AND plan_date <= ? ORDER BY plan_date",
      )
      .all(from, to)
      .flatMap((r) => this.getByDate(r.plan_date) ?? []);
  }

  countMembersCompletedBetween(planId: string, startUtc: string, endUtc: string): number {
    const row = this.db
      .prepare<[string, string, string], { n: number }>(
        `SELECT count(*) AS n FROM day_plan_items m JOIN items i ON i.id = m.item_id
          WHERE m.plan_id = ? AND i.completed_at >= ? AND i.completed_at < ?`,
      )
      .get(planId, startUtc, endUtc);
    return row?.n ?? 0;
  }

  private insertMembers(plan: DayPlan): void {
    const insert = this.db.prepare(
      "INSERT INTO day_plan_items (plan_id, item_id, position) VALUES (?, ?, ?)",
    );
    plan.itemIds.forEach((itemId, index) => insert.run(plan.id, itemId, index + 1));
  }
}
