import type Database from "better-sqlite3";
import { WaypointError } from "../domain/errors.js";

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

function appliedVersions(db: Database.Database): number[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL
  ) STRICT`);
  return db
    .prepare<[], { version: number }>("SELECT version FROM schema_migrations ORDER BY version")
    .all()
    .map((r) => r.version);
}

/**
 * Apply pending migrations in order, each in its own IMMEDIATE transaction. Re-running is a
 * no-op. A failing migration rolls back completely and is reported; the store is never reset.
 * Returns the schema version after migrating.
 */
export function runMigrations(
  db: Database.Database,
  migrations: readonly Migration[],
  now: () => Date = () => new Date(),
): number {
  const sorted = [...migrations].sort((a, b) => a.version - b.version);
  const known = new Set(sorted.map((m) => m.version));
  const applied = appliedVersions(db);
  const latestKnown = sorted.at(-1)?.version ?? 0;

  const unknown = applied.filter((v) => !known.has(v));
  if (unknown.length > 0) {
    throw new WaypointError(
      "storage",
      `Store has schema version(s) ${unknown.join(", ")} that this Waypoint build does not know (latest ${latestKnown}). Upgrade Waypoint instead of opening this store with an older build.`,
    );
  }

  const insert = db.prepare(
    "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
  );
  for (const migration of sorted) {
    if (applied.includes(migration.version)) continue;
    const apply = db.transaction(() => {
      db.exec(migration.sql);
      insert.run(migration.version, migration.name, now().toISOString());
    });
    try {
      apply.immediate();
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const current = applied.at(-1) ?? 0;
      throw new WaypointError(
        "storage",
        `Migration ${migration.version} (${migration.name}) failed and was rolled back; the store remains at schema version ${current}. The store was not modified or reset. Cause: ${reason}`,
      );
    }
    applied.push(migration.version);
  }
  return applied.at(-1) ?? 0;
}
