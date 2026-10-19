import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname } from "node:path";
import Database from "better-sqlite3";
import { TaskPresetError } from "../domain/errors.js";

export const BUSY_TIMEOUT_MS = 5000;

export interface OpenedDatabase {
  db: Database.Database;
  /** True when the file did not exist (or was empty) before opening. */
  created: boolean;
}

/**
 * Open a TaskPreset SQLite file with foreign keys, WAL and a bounded busy timeout. Creates the
 * parent directory for a new store. Refuses non-empty files that are not TaskPreset stores so
 * migrations are never applied to someone else's database.
 */
export function openDatabase(path: string): OpenedDatabase {
  const existed = existsSync(path) && statSync(path).size > 0;
  if (!existed) mkdirSync(dirname(path), { recursive: true });

  let db: Database.Database | undefined;
  try {
    db = new Database(path);
    db.pragma(`busy_timeout = ${BUSY_TIMEOUT_MS}`);
    db.pragma("foreign_keys = ON");
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
  } catch (error) {
    if (db?.open) db.close();
    throw mapSqliteError(error, `Could not open database at ${path}`);
  }

  if (existed) {
    const marker = db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .get();
    if (marker === undefined) {
      db.close();
      throw new TaskPresetError(
        "config",
        `${path} is an existing SQLite database but not a TaskPreset store. Choose a different path.`,
      );
    }
  }
  return { db, created: !existed };
}

/** Convert better-sqlite3 errors into TaskPresetErrors with actionable messages. */
export function mapSqliteError(error: unknown, context: string): Error {
  if (error instanceof TaskPresetError) return error;
  const code = (error as { code?: unknown }).code;
  if (code === "SQLITE_BUSY" || code === "SQLITE_LOCKED") {
    return new TaskPresetError(
      "busy",
      "The store is busy because another client is writing. Retry the operation shortly.",
    );
  }
  if (code === "SQLITE_NOTADB") {
    return new TaskPresetError("config", `${context}: the file is not a SQLite database.`);
  }
  if (typeof code === "string" && code.startsWith("SQLITE_")) {
    const message = error instanceof Error ? error.message : String(error);
    return new TaskPresetError("storage", `${context}: ${message}`);
  }
  // Not a database error (e.g. a programming bug): surface it unchanged.
  return error instanceof Error ? error : new Error(String(error));
}
