import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { openApp } from "../../src/app.js";
import { SERVER_ENTRY } from "../mcp/helpers.js";
import { testApp } from "../support/app.js";
import { dumpDatabase } from "../support/dump.js";
import { tempDbPath, tempDir } from "../support/tmp.js";

function cli(...args: string[]) {
  const r = spawnSync(process.execPath, [SERVER_ENTRY, ...args], { encoding: "utf8" });
  return { stdout: r.stdout, stderr: r.stderr, code: r.status };
}

function seededStore() {
  const app = testApp({ preset: "gtd-lite" });
  const project = app.items.capture({ type: "project", title: "P", tags: ["@home"] }).item;
  const a = app.items.capture({ type: "action", title: "A", parentId: project.id }).item;
  const b = app.items.capture({ type: "action", title: "B", dueDate: "2026-10-20" }).item;
  const c = app.items.capture({ type: "action", title: "C", status: "waiting" }).item;
  app.plans.commit({ itemIds: [a.id, b.id] });
  app.plans.commit({ itemIds: [c.id, a.id, b.id], expectedRevision: 1 });
  app.clock.advance(30 * 60_000);
  app.items.complete(a.id);
  app.items.update({ id: b.id, status: "cancelled" });
  app.plans.commit({ date: "2026-10-19", itemIds: [c.id] });
  return app;
}

describe("backup and restore", () => {
  it("snapshots a live WAL store and restores every detail into a separate store", () => {
    const app = seededStore(); // connection stays open: recent writes may live only in the WAL
    expect(existsSync(`${app.path}-wal`)).toBe(true);
    const sourceBefore = dumpDatabase(app.store.db);

    const backup = join(tempDir(), "nested", "taskpreset-backup.db");
    const run = cli("backup", "--db", app.path, "--out", backup);
    expect(run.stderr).toBe("");
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("integrity: ok");
    expect(run.stdout).toContain("contents:  4 items, 2 day plans");

    // Restore = copy the backup to a new path and open it there.
    const restoredPath = join(tempDir(), "restored.db");
    copyFileSync(backup, restoredPath);
    const restored = openApp({ path: restoredPath, clock: app.clock });
    try {
      expect(dumpDatabase(restored.store.db)).toEqual(sourceBefore);
      expect(restored.describeSystem()).toEqual(app.describeSystem());
      expect(restored.items.query({}).items).toEqual(app.items.query({}).items);
      expect(restored.plans.get("2026-10-18")).toEqual(app.plans.get("2026-10-18"));
      expect(restored.plans.get("2026-10-18")?.plan.revision).toBe(2);
      expect(restored.metrics.get({ from: "2026-10-18", to: "2026-10-19" })).toEqual(
        app.metrics.get({ from: "2026-10-18", to: "2026-10-19" }),
      );
    } finally {
      restored.close();
    }

    // The original store was not modified.
    expect(dumpDatabase(app.store.db)).toEqual(sourceBefore);
  });

  it("refuses unsafe destinations and sources without writing anything", () => {
    const app = seededStore();
    const before = dumpDatabase(app.store.db);
    const dir = tempDir();
    const existing = join(dir, "existing.db");
    writeFileSync(existing, "keep me");

    expect(cli("backup", "--db", app.path, "--out", existing).stderr).toContain("never overwrite");
    expect(readFileSync(existing, "utf8")).toBe("keep me");
    expect(cli("backup", "--db", app.path, "--out", "relative.db").stderr).toContain("absolute");
    expect(cli("backup", "--db", app.path).stderr).toContain("--out");
    expect(cli("backup", "--db", app.path, "--out", app.path).stderr).toContain("must differ");
    expect(
      cli("backup", "--db", join(dir, "missing.db"), "--out", join(dir, "o.db")).stderr,
    ).toContain("No store");

    const foreign = tempDbPath();
    const db = new Database(foreign);
    db.exec("CREATE TABLE notes (x TEXT); INSERT INTO notes VALUES ('n')");
    db.close();
    const out = join(dir, "foreign-backup.db");
    expect(cli("backup", "--db", foreign, "--out", out).stderr).toContain("not a TaskPreset store");
    expect(existsSync(out)).toBe(false);

    expect(dumpDatabase(app.store.db)).toEqual(before);
  });
});
