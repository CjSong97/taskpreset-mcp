import type Database from "better-sqlite3";
import { canonicalJson } from "../config/canonical.js";
import { DEFAULT_PRESET, loadPreset, parsePreset } from "../config/presets.js";
import { WaypointError } from "../domain/errors.js";
import type { Preset } from "../domain/preset.js";
import { DEFAULT_TIMEZONE, isValidTimezone } from "../domain/time.js";
import { mapSqliteError, openDatabase } from "./database.js";
import { runMigrations, type Migration } from "./migrate.js";
import { MIGRATIONS } from "./migrations/index.js";

const CONFIG_VERSION = "1";

export interface StoreOptions {
  path: string;
  /** Preset reference from startup config. Optional for an existing store. */
  preset?: string | undefined;
  /** IANA timezone from startup config. Optional for an existing store. */
  timezone?: string | undefined;
  now?: () => Date;
  migrations?: readonly Migration[];
}

export interface Store {
  readonly db: Database.Database;
  readonly path: string;
  readonly preset: Preset;
  readonly timezone: string;
  readonly schemaVersion: number;
  readonly created: boolean;
  /** Run `fn` in a BEGIN IMMEDIATE transaction; any throw rolls back every write. */
  write<T>(fn: () => T): T;
  /** Run `fn` in a read transaction for a consistent snapshot. */
  read<T>(fn: () => T): T;
  close(): void;
}

type Metadata = Record<string, string>;

function readMetadata(db: Database.Database): Metadata {
  const rows = db
    .prepare<[], { key: string; value: string }>("SELECT key, value FROM app_metadata")
    .all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

/**
 * Open (creating if necessary) a store and bind it to its preset. A new store records the
 * validated preset snapshot and timezone; an existing store refuses any configured preset or
 * timezone that differs from what it was created with.
 */
export function openStore(options: StoreOptions): Store {
  const now = options.now ?? (() => new Date());
  // Validate startup configuration before touching the filesystem.
  const configured = options.preset === undefined ? undefined : loadPreset(options.preset);
  if (options.timezone !== undefined && !isValidTimezone(options.timezone)) {
    throw new WaypointError("config", `Unknown IANA timezone "${options.timezone}".`);
  }
  const { db, created } = openDatabase(options.path);

  try {
    const schemaVersion = runMigrations(db, options.migrations ?? MIGRATIONS, now);
    let metadata = readMetadata(db);

    if (metadata.preset_snapshot === undefined) {
      const preset = configured ?? loadPreset(DEFAULT_PRESET);
      const timezone = options.timezone ?? DEFAULT_TIMEZONE;
      const insert = db.prepare("INSERT INTO app_metadata (key, value) VALUES (?, ?)");
      db.transaction(() => {
        insert.run("config_version", CONFIG_VERSION);
        insert.run("preset_id", preset.id);
        insert.run("preset_version", preset.version);
        insert.run("preset_snapshot", canonicalJson(preset));
        insert.run("timezone", timezone);
        insert.run("created_at", now().toISOString());
      }).immediate();
      metadata = readMetadata(db);
    }

    const snapshot = metadata.preset_snapshot ?? "";
    const preset = parsePreset(JSON.parse(snapshot), "stored snapshot");
    const timezone = metadata.timezone ?? "";

    if (configured !== undefined) {
      if (canonicalJson(configured) !== snapshot) {
        throw new WaypointError(
          "config",
          `This store is bound to preset ${preset.id}@${preset.version}, but the configured preset ${configured.id}@${configured.version} differs. Existing data is never reinterpreted: omit --preset to use the stored preset, or use a new --db path for a different preset.`,
        );
      }
    }
    if (options.timezone !== undefined && options.timezone !== timezone) {
      throw new WaypointError(
        "config",
        `This store uses timezone ${timezone}; the configured timezone ${options.timezone} differs. Omit --timezone or use a new store.`,
      );
    }

    return {
      db,
      path: options.path,
      preset,
      timezone,
      schemaVersion,
      created,
      write<T>(fn: () => T): T {
        try {
          return db.transaction(fn).immediate();
        } catch (error) {
          throw mapSqliteError(error, "Write failed");
        }
      },
      read<T>(fn: () => T): T {
        try {
          return db.transaction(fn).deferred();
        } catch (error) {
          throw mapSqliteError(error, "Read failed");
        }
      },
      close() {
        if (db.open) db.close();
      },
    };
  } catch (error) {
    db.close();
    throw mapSqliteError(error, "Could not open store");
  }
}
