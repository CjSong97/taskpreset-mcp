import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import {
  defaultDataDir,
  legacyDataDir,
  resolveDbPath,
  startupEnv,
} from "../../src/config/paths.js";
import { TaskPresetError } from "../../src/domain/errors.js";
import { mapSqliteError } from "../../src/storage/database.js";
import type { Migration } from "../../src/storage/migrate.js";
import { MIGRATIONS } from "../../src/storage/migrations/index.js";
import { openStore, type Store } from "../../src/storage/store.js";
import { tempDbPath, tempDir } from "../support/tmp.js";

const NOW = () => new Date("2026-10-18T09:00:00.000Z");

function insertItem(store: Store, id: string): void {
  store.db
    .prepare(
      `INSERT INTO items (id, type, title, status, priority, created_at, updated_at)
       VALUES (?, 'task', 'Synthetic', 'not_started', 3, ?, ?)`,
    )
    .run(id, NOW().toISOString(), NOW().toISOString());
}

function itemCount(store: Store): number {
  return (store.db.prepare("SELECT count(*) AS n FROM items").get() as { n: number }).n;
}

function versions(db: Database.Database): number[] {
  return (db.prepare("SELECT version FROM schema_migrations").all() as { version: number }[]).map(
    (r) => r.version,
  );
}

describe("SQLite store", () => {
  it("creates a fresh store with foreign keys, WAL and a bounded busy timeout", () => {
    const path = tempDbPath();
    const store = openStore({ path, now: NOW });
    try {
      expect(store.created).toBe(true);
      expect(existsSync(path)).toBe(true);
      expect(store.db.pragma("foreign_keys", { simple: true })).toBe(1);
      expect(store.db.pragma("journal_mode", { simple: true })).toBe("wal");
      expect(store.db.pragma("busy_timeout", { simple: true })).toBe(5000);
      expect(store.schemaVersion).toBe(MIGRATIONS.length);
      expect(store.preset.id).toBe("avatar-lite");
      expect(store.timezone).toBe("Europe/London");
    } finally {
      store.close();
    }
  });

  it("reruns migrations safely and preserves data across reopen", () => {
    const path = tempDbPath();
    const first = openStore({ path, now: NOW });
    insertItem(first, "a");
    first.close();

    const second = openStore({ path, now: NOW });
    try {
      expect(second.created).toBe(false);
      expect(versions(second.db)).toEqual(MIGRATIONS.map((m) => m.version));
      expect(itemCount(second)).toBe(1);
    } finally {
      second.close();
    }
  });

  it("rolls back a failing migration without resetting the store", () => {
    const path = tempDbPath();
    const store = openStore({ path, now: NOW });
    insertItem(store, "keep-me");
    store.close();

    const broken: Migration = {
      version: 99,
      name: "broken",
      sql: "CREATE TABLE half_done (x INTEGER); INSERT INTO no_such_table VALUES (1);",
    };
    expect(() => openStore({ path, now: NOW, migrations: [...MIGRATIONS, broken] })).toThrow(
      /Migration 99 \(broken\) failed and was rolled back/,
    );

    const db = new Database(path);
    try {
      expect(versions(db)).toEqual(MIGRATIONS.map((m) => m.version));
      const table = db.prepare("SELECT name FROM sqlite_master WHERE name = 'half_done'").get();
      expect(table).toBeUndefined();
      expect(db.prepare("SELECT id FROM items").all()).toEqual([{ id: "keep-me" }]);
    } finally {
      db.close();
    }
  });

  it("leaves no partial writes when a transaction fails", () => {
    const store = openStore({ path: tempDbPath(), now: NOW });
    try {
      expect(() =>
        store.write(() => {
          insertItem(store, "first");
          insertItem(store, "second");
          throw new TaskPresetError("validation", "boom");
        }),
      ).toThrow("boom");
      expect(itemCount(store)).toBe(0);
    } finally {
      store.close();
    }
  });

  it("refuses a store written by a newer schema", () => {
    const path = tempDbPath();
    openStore({ path, now: NOW }).close();
    const db = new Database(path);
    db.prepare("INSERT INTO schema_migrations VALUES (500, 'future', 'x')").run();
    db.close();
    expect(() => openStore({ path, now: NOW })).toThrow(/does not know/);
  });

  it("refuses an existing SQLite file that is not a TaskPreset store and leaves it untouched", () => {
    const path = tempDbPath();
    const foreign = new Database(path);
    foreign.exec("CREATE TABLE notes (body TEXT)");
    foreign.close();

    expect(() => openStore({ path, now: NOW })).toThrow(/not a TaskPreset store/);
    const db = new Database(path);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
    db.close();
    expect(tables).toEqual([{ name: "notes" }]);
  });

  it("refuses a non-SQLite file", () => {
    const path = tempDbPath();
    writeFileSync(path, "this is not a database, just text that is long enough".repeat(10));
    expect(() => openStore({ path, now: NOW })).toThrow(TaskPresetError);
  });

  describe("preset binding", () => {
    it("rejects a configured preset that differs from the stored snapshot", () => {
      const path = tempDbPath();
      openStore({ path, preset: "avatar-lite", now: NOW }).close();

      const presetFile = join(tempDir(), "custom.json");
      const avatar = JSON.parse(
        readFileSync(new URL("../../presets/avatar-lite.json", import.meta.url), "utf8"),
      ) as { itemTypes: { task: { label: string } } };
      avatar.itemTypes.task.label = "Renamed";
      writeFileSync(presetFile, JSON.stringify(avatar));

      expect(() => openStore({ path, preset: presetFile, now: NOW })).toThrow(
        /bound to preset avatar-lite@1\.0\.0/,
      );
    });

    it("accepts the same preset or no preset on reopen", () => {
      const path = tempDbPath();
      openStore({ path, preset: "avatar-lite", now: NOW }).close();
      openStore({ path, preset: "avatar-lite", now: NOW }).close();
      const store = openStore({ path, now: NOW });
      expect(store.preset.id).toBe("avatar-lite");
      store.close();
    });

    it("rejects a different timezone on reopen and invalid timezones up front", () => {
      const path = tempDbPath();
      openStore({ path, timezone: "Europe/London", now: NOW }).close();
      expect(() => openStore({ path, timezone: "America/New_York", now: NOW })).toThrow(
        /timezone Europe\/London/,
      );

      const fresh = tempDbPath();
      expect(() => openStore({ path: fresh, timezone: "Mars/Olympus", now: NOW })).toThrow(
        /Unknown IANA timezone/,
      );
      expect(existsSync(fresh)).toBe(false);
    });
  });

  describe("paths", () => {
    it("requires explicit database paths to be absolute", () => {
      expect(() => resolveDbPath("relative/store.db")).toThrow(/must be absolute/);
      const absolute = join(tempDir(), "x.db");
      expect(resolveDbPath(absolute)).toBe(absolute);
    });

    it("defaults to the OS user-data directory", () => {
      expect(
        defaultDataDir("win32", { LOCALAPPDATA: "C:\\Users\\u\\AppData\\Local" }, "C:\\Users\\u"),
      ).toBe(join("C:\\Users\\u\\AppData\\Local", "TaskPreset"));
      expect(defaultDataDir("darwin", {}, "/Users/u")).toBe(
        join("/Users/u", "Library", "Application Support", "TaskPreset"),
      );
      expect(defaultDataDir("linux", {}, "/home/u")).toBe(
        join("/home/u", ".local", "share", "taskpreset"),
      );
      expect(defaultDataDir("linux", { XDG_DATA_HOME: "/data" }, "/home/u")).toBe(
        join("/data", "taskpreset"),
      );
    });

    it("keeps using a store created under the pre-rename name", () => {
      const current = join(defaultDataDir(), "taskpreset.db");
      const legacy = join(legacyDataDir(), "waypoint.db");
      expect(resolveDbPath(undefined, (p) => p === legacy)).toBe(legacy);
      expect(resolveDbPath(undefined, (p) => p === legacy || p === current)).toBe(current);
      expect(resolveDbPath(undefined, () => false)).toBe(current);
    });

    it("reads TASKPRESET_* settings, falling back to the pre-rename WAYPOINT_* names", () => {
      expect(startupEnv("DB", { WAYPOINT_DB: "/old" })).toBe("/old");
      expect(startupEnv("DB", { TASKPRESET_DB: "/new", WAYPOINT_DB: "/old" })).toBe("/new");
      expect(startupEnv("PRESET", {})).toBeUndefined();
    });
  });

  it("maps SQLITE_BUSY to an actionable busy error", () => {
    const error = mapSqliteError(Object.assign(new Error("locked"), { code: "SQLITE_BUSY" }), "x");
    expect(error).toBeInstanceOf(TaskPresetError);
    expect((error as TaskPresetError).code).toBe("busy");
  });
});
