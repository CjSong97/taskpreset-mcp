import type Database from "better-sqlite3";
import type { Item } from "../domain/item.js";
import type { ItemCursor, ItemFilter, ItemRepository } from "../services/ports.js";

interface ItemRow {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  parent_id: string | null;
  tags: string;
  priority: number;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

const COLUMNS =
  "id, type, title, description, status, parent_id, tags, priority, due_date, created_at, updated_at, completed_at";

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description,
    status: row.status,
    parentId: row.parent_id,
    tags: JSON.parse(row.tags) as string[],
    priority: row.priority,
    dueDate: row.due_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at,
  };
}

export class SqliteItemRepository implements ItemRepository {
  constructor(private readonly db: Database.Database) {}

  insert(item: Item, request?: { id: string; fingerprint: string }): void {
    this.db
      .prepare(
        `INSERT INTO items (${COLUMNS}, request_id, request_fingerprint)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        item.id,
        item.type,
        item.title,
        item.description,
        item.status,
        item.parentId,
        JSON.stringify(item.tags),
        item.priority,
        item.dueDate,
        item.createdAt,
        item.updatedAt,
        item.completedAt,
        request?.id ?? null,
        request?.fingerprint ?? null,
      );
  }

  get(id: string): Item | undefined {
    const row = this.db
      .prepare<[string], ItemRow>(`SELECT ${COLUMNS} FROM items WHERE id = ?`)
      .get(id);
    return row && toItem(row);
  }

  findByRequestId(requestId: string): { item: Item; fingerprint: string } | undefined {
    const row = this.db
      .prepare<[string], ItemRow & { request_fingerprint: string }>(
        `SELECT ${COLUMNS}, request_fingerprint FROM items WHERE request_id = ?`,
      )
      .get(requestId);
    return row && { item: toItem(row), fingerprint: row.request_fingerprint };
  }

  query(filter: ItemFilter, limit: number, after?: ItemCursor): Item[] {
    const where: string[] = [];
    const params: (string | number)[] = [];
    if (filter.id !== undefined) {
      where.push("id = ?");
      params.push(filter.id);
    }
    if (filter.type !== undefined) {
      where.push("type = ?");
      params.push(filter.type);
    }
    if (filter.statuses !== undefined) {
      where.push(`status IN (${filter.statuses.map(() => "?").join(", ") || "NULL"})`);
      params.push(...filter.statuses);
    }
    if (filter.parentId !== undefined) {
      where.push("parent_id = ?");
      params.push(filter.parentId);
    }
    if (filter.rootOnly === true) where.push("parent_id IS NULL");
    if (filter.tag !== undefined) {
      where.push("EXISTS (SELECT 1 FROM json_each(items.tags) WHERE json_each.value = ?)");
      params.push(filter.tag);
    }
    if (filter.dueFrom !== undefined) {
      where.push("due_date >= ?");
      params.push(filter.dueFrom);
    }
    if (filter.dueTo !== undefined) {
      where.push("due_date <= ?");
      params.push(filter.dueTo);
    }
    if (after !== undefined) {
      where.push("(created_at, id) > (?, ?)");
      params.push(after.createdAt, after.id);
    }
    const sql = `SELECT ${COLUMNS} FROM items
      ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY created_at, id
      LIMIT ?`;
    return this.db
      .prepare<(string | number)[], ItemRow>(sql)
      .all(...params, limit)
      .map(toItem);
  }

  update(item: Item): void {
    this.db
      .prepare(
        `UPDATE items SET title = ?, description = ?, status = ?, parent_id = ?, tags = ?,
           priority = ?, due_date = ?, updated_at = ?, completed_at = ?
         WHERE id = ?`,
      )
      .run(
        item.title,
        item.description,
        item.status,
        item.parentId,
        JSON.stringify(item.tags),
        item.priority,
        item.dueDate,
        item.updatedAt,
        item.completedAt,
        item.id,
      );
  }

  ancestorIds(id: string): string[] {
    return this.db
      .prepare<[string], { id: string }>(
        `WITH RECURSIVE chain(id, parent_id, depth) AS (
           SELECT id, parent_id, 0 FROM items WHERE id = (SELECT parent_id FROM items WHERE id = ?)
           UNION ALL
           SELECT items.id, items.parent_id, chain.depth + 1
             FROM items JOIN chain ON items.id = chain.parent_id
            WHERE chain.depth < 1000
         )
         SELECT id FROM chain ORDER BY depth`,
      )
      .all(id)
      .map((r) => r.id);
  }

  planningCandidates(statuses: string[], types: string[], limit: number): Item[] {
    if (statuses.length === 0 || types.length === 0) return [];
    return this.db
      .prepare<(string | number)[], ItemRow>(
        `SELECT ${COLUMNS} FROM items
          WHERE status IN (${statuses.map(() => "?").join(", ")})
            AND type IN (${types.map(() => "?").join(", ")})
          ORDER BY priority, due_date IS NULL, due_date, created_at, id
          LIMIT ?`,
      )
      .all(...statuses, ...types, limit)
      .map(toItem);
  }

  countPlanningCandidates(statuses: string[], types: string[]): number {
    if (statuses.length === 0 || types.length === 0) return 0;
    const row = this.db
      .prepare<string[], { n: number }>(
        `SELECT count(*) AS n FROM items
          WHERE status IN (${statuses.map(() => "?").join(", ")})
            AND type IN (${types.map(() => "?").join(", ")})`,
      )
      .get(...statuses, ...types);
    return row?.n ?? 0;
  }
}
