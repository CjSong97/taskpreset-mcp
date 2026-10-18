import { existsSync, mkdirSync, statSync } from "node:fs";
import { dirname, isAbsolute, normalize } from "node:path";
import Database from "better-sqlite3";
import { WaypointError } from "../domain/errors.js";

export interface BackupOptions {
  source: string;
  out: string | undefined;
}

function counts(db: Database.Database) {
  const count = (table: string) =>
    (db.prepare(`SELECT count(*) AS n FROM "${table}"`).get() as { n: number }).n;
  const hasPlans =
    db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'day_plans'").get() !==
    undefined;
  return {
    items: count("items"),
    plans: hasPlans ? count("day_plans") : 0,
    schema: (db.prepare("SELECT max(version) AS v FROM schema_migrations").get() as { v: number })
      .v,
    preset: (
      db.prepare("SELECT value FROM app_metadata WHERE key = 'preset_id'").get() as
        { value: string } | undefined
    )?.value,
  };
}

/**
 * Write a consistent single-file snapshot of a store with VACUUM INTO (safe while servers are
 * running in WAL mode), then verify the copy. Never overwrites an existing file and never
 * writes to the source.
 */
export function backupStore(options: BackupOptions): string[] {
  const { source } = options;
  if (options.out === undefined || !isAbsolute(options.out)) {
    throw new WaypointError("config", "backup requires --out with an absolute file path.");
  }
  const out = normalize(options.out);
  if (out === normalize(source)) {
    throw new WaypointError("config", "--out must differ from the store path.");
  }
  if (existsSync(out)) {
    throw new WaypointError("config", `${out} already exists; backups never overwrite files.`);
  }
  if (!existsSync(source) || statSync(source).size === 0) {
    throw new WaypointError("config", `No store at ${source}.`);
  }

  const src = new Database(source, { readonly: true, fileMustExist: true });
  try {
    const marker = src
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
      .get();
    if (marker === undefined) {
      throw new WaypointError("config", `${source} is not a Waypoint store.`);
    }
    mkdirSync(dirname(out), { recursive: true });
    src.prepare("VACUUM INTO ?").run(out);
  } finally {
    src.close();
  }

  const copy = new Database(out, { readonly: true, fileMustExist: true });
  try {
    const check = (copy.prepare("PRAGMA quick_check").get() as { quick_check: string }).quick_check;
    if (check !== "ok") {
      throw new WaypointError("storage", `Backup at ${out} failed its integrity check: ${check}`);
    }
    const c = counts(copy);
    return [
      `Backup written to ${out}`,
      `  integrity: ok`,
      `  schema:    version ${c.schema}`,
      `  preset:    ${c.preset ?? "?"}`,
      `  contents:  ${c.items} items, ${c.plans} day plans`,
    ];
  } finally {
    copy.close();
  }
}
