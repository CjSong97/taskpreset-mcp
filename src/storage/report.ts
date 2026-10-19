import Database from "better-sqlite3";
import { parsePreset } from "../config/presets.js";
import { WaypointError } from "../domain/errors.js";
import type { Item } from "../domain/item.js";
import type { Preset } from "../domain/preset.js";
import type { ReportReader, UnitOfWork } from "../services/ports.js";
import { mapSqliteError } from "./database.js";
import { MIGRATIONS } from "./migrations/index.js";
import { COLUMNS, toItem, type ItemRow } from "./items.js";

/** A store opened strictly for reading: never created, migrated or written. */
export interface ReadonlyStore extends UnitOfWork {
  readonly db: Database.Database;
  readonly preset: Preset;
  readonly timezone: string;
  close(): void;
}

/**
 * Open an existing store read-only. Unlike openStore this never creates the file, runs
 * migrations or changes the journal mode, so it is safe to run while a server has the store open.
 */
export function openReadonlyStore(path: string): ReadonlyStore {
  let db: Database.Database;
  try {
    db = new Database(path, { readonly: true, fileMustExist: true });
  } catch (error) {
    throw new WaypointError(
      "config",
      `No store at ${path} (${error instanceof Error ? error.message : String(error)}).`,
    );
  }
  try {
    const hasTable = (name: string) =>
      db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name) !==
      undefined;
    if (!hasTable("schema_migrations") || !hasTable("app_metadata")) {
      throw new WaypointError("config", `${path} is not a Waypoint store.`);
    }
    const current =
      (db.prepare("SELECT max(version) AS v FROM schema_migrations").get() as { v: number | null })
        .v ?? 0;
    const latest = MIGRATIONS.at(-1)?.version ?? 0;
    if (current > latest) {
      throw new WaypointError(
        "config",
        `Store schema version ${current} is newer than this build (${latest}); upgrade Waypoint.`,
      );
    }
    if (current < latest) {
      throw new WaypointError(
        "config",
        `Store schema version ${current} is older than this build (${latest}). Start "serve" once to migrate it, then retry.`,
      );
    }
    const metadata = Object.fromEntries(
      (
        db.prepare("SELECT key, value FROM app_metadata").all() as { key: string; value: string }[]
      ).map((r) => [r.key, r.value]),
    );
    if (metadata.preset_snapshot === undefined || metadata.timezone === undefined) {
      throw new WaypointError("config", `${path} has no bound preset; it is not a usable store.`);
    }
    const handle = db;
    return {
      db: handle,
      preset: parsePreset(JSON.parse(metadata.preset_snapshot), "stored snapshot"),
      timezone: metadata.timezone,
      write() {
        throw new WaypointError("storage", "This store is open read-only.");
      },
      read<T>(fn: () => T): T {
        try {
          return handle.transaction(fn).deferred();
        } catch (error) {
          throw mapSqliteError(error, "Read failed");
        }
      },
      close() {
        if (handle.open) handle.close();
      },
    };
  } catch (error) {
    db.close();
    throw error;
  }
}

const placeholders = (values: readonly unknown[]) => values.map(() => "?").join(", ");

export class SqliteReportReader implements ReportReader {
  constructor(private readonly db: Database.Database) {}

  statusCounts(types: string[]): Record<string, number> {
    if (types.length === 0) return {};
    const rows = this.db
      .prepare<string[], { status: string; n: number }>(
        `SELECT status, count(*) AS n FROM items WHERE type IN (${placeholders(types)}) GROUP BY status`,
      )
      .all(...types);
    return Object.fromEntries(rows.map((r) => [r.status, r.n]));
  }

  cards(status: string, types: string[], order: "work" | "recent", limit: number): Item[] {
    if (types.length === 0) return [];
    const orderBy =
      order === "work"
        ? "priority, due_date IS NULL, due_date, created_at, id"
        : "COALESCE(completed_at, updated_at) DESC, id";
    return this.db
      .prepare<(string | number)[], ItemRow>(
        `SELECT ${COLUMNS} FROM items
          WHERE status = ? AND type IN (${placeholders(types)})
          ORDER BY ${orderBy} LIMIT ?`,
      )
      .all(status, ...types, limit)
      .map(toItem);
  }

  completedAt(types: string[], startUtc: string, endUtc: string): string[] {
    if (types.length === 0) return [];
    return this.db
      .prepare<string[], { completed_at: string }>(
        `SELECT completed_at FROM items
          WHERE type IN (${placeholders(types)}) AND completed_at >= ? AND completed_at < ?
          ORDER BY completed_at`,
      )
      .all(...types, startUtc, endUtc)
      .map((r) => r.completed_at);
  }

  tagCounts(statuses: string[], types: string[]): { tag: string; count: number }[] {
    if (statuses.length === 0 || types.length === 0) return [];
    return this.db
      .prepare<string[], { tag: string; n: number }>(
        `SELECT j.value AS tag, count(*) AS n
           FROM items, json_each(items.tags) AS j
          WHERE items.status IN (${placeholders(statuses)})
            AND items.type IN (${placeholders(types)})
          GROUP BY j.value
          ORDER BY n DESC, j.value`,
      )
      .all(...statuses, ...types)
      .map((r) => ({ tag: r.tag, count: r.n }));
  }
}
