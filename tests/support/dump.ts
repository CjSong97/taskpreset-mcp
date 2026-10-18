import type Database from "better-sqlite3";

/** Every row of every user table, for asserting that an operation wrote nothing. */
export function dumpDatabase(db: Database.Database): Record<string, unknown[]> {
  const tables = db
    .prepare<[], { name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    )
    .all()
    .map((t) => t.name);
  return Object.fromEntries(
    tables.map((name) => [name, db.prepare(`SELECT * FROM "${name}" ORDER BY rowid`).all()]),
  );
}
