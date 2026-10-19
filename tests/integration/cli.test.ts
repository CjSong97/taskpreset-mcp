import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openApp } from "../../src/app.js";
import { runDoctor } from "../../src/cli/doctor.js";
import { SERVER_ENTRY } from "../mcp/helpers.js";
import { tempDbPath, tempDir } from "../support/tmp.js";

function cli(...args: string[]) {
  const result = spawnSync(process.execPath, [SERVER_ENTRY, ...args], { encoding: "utf8" });
  return { stdout: result.stdout, stderr: result.stderr, code: result.status };
}

describe("taskpreset CLI", () => {
  it("prints help", () => {
    const run = cli("--help");
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("Commands:");
    expect(run.stdout).toContain("doctor");
  });

  it("initialises an empty store once and refuses to touch it again", () => {
    const db = tempDbPath();
    const first = cli("init", "--db", db, "--preset", "gtd-lite");
    expect(first.code).toBe(0);
    expect(first.stdout).toContain("preset:   gtd-lite@1.0.0");

    const again = cli("init", "--db", db);
    expect(again.code).toBe(1);
    expect(again.stderr).toContain("init never modifies existing stores");

    const app = openApp({ path: db });
    expect(app.items.query({}).items).toEqual([]);
    expect(app.store.preset.id).toBe("gtd-lite");
    app.close();
  });

  it("rejects relative paths and unknown commands with actionable errors", () => {
    expect(cli("init", "--db", "relative.db").stderr).toContain("must be absolute");
    expect(cli("frobnicate").stderr).toContain("Available: serve, init, doctor, backup");
  });
});

describe("doctor", () => {
  it("reports a missing store without creating it", () => {
    const db = tempDbPath();
    const run = cli("doctor", "--db", db);
    expect(run.code).toBe(1);
    expect(run.stdout).toContain("[ok]   Node.js");
    expect(run.stdout).toContain("[ok]   better-sqlite3");
    expect(run.stdout).toMatch(/\[FAIL\] Store: no store at .* Run "init"/);
    expect(existsSync(db)).toBe(false);
  });

  it("passes on a healthy store and shows counts but never item content", () => {
    const db = tempDbPath();
    const app = openApp({ path: db });
    const secret = "Confidential synthetic title 9d2c";
    const item = app.items.capture({
      type: "task",
      title: secret,
      description: secret,
      tags: ["secret-tag"],
    }).item;
    app.plans.commit({ itemIds: [item.id] });
    app.close();

    const run = cli("doctor", "--db", db);
    expect(run.code).toBe(0);
    expect(run.stdout).toContain("Schema: version 2 (current)");
    expect(run.stdout).toContain("Bound preset: avatar-lite@1.0.0, timezone Europe/London");
    expect(run.stdout).toContain("Contents: 1 items, 1 day plans");
    expect(run.stdout + run.stderr).not.toContain(secret);
    expect(run.stdout + run.stderr).not.toContain("secret-tag");
  });

  it("flags preset mismatches, invalid presets and foreign files", () => {
    const db = tempDbPath();
    openApp({ path: db }).close();
    expect(cli("doctor", "--db", db, "--preset", "gtd-lite").stdout).toContain(
      "[FAIL] Preset compatibility",
    );
    expect(cli("doctor", "--db", db, "--preset", "nope").stdout).toContain(
      "[FAIL] Configured preset",
    );
  });

  it("flags an unsupported Node version", () => {
    const checks = runDoctor({ path: tempDbPath(), preset: undefined, nodeVersion: "v22.1.0" });
    expect(checks[0]).toMatchObject({ ok: false, label: "Node.js" });
  });
});

describe("report and demo", () => {
  it("seeds a demo store and renders a report end to end", () => {
    const dir = tempDir();
    const db = join(dir, "demo.db");
    const html = join(dir, "report.html");

    const demo = cli("demo", "--out", db, "--preset", "gtd-lite");
    expect(demo.code).toBe(0);
    expect(demo.stdout).toContain("gtd-lite");

    const report = cli("report", "--db", db, "--out", html, "--as-of", "2026-10-12", "--no-titles");
    expect(report.code).toBe(0);
    expect(report.stdout).toContain("titles:    hidden");
    const text = readFileSync(html, "utf8");
    expect(text).toContain("GTD-lite report");
    expect(text).toContain("Waiting for");
    expect(text).not.toMatch(/<script/i);

    const again = cli("report", "--db", db, "--out", html);
    expect(again.code).toBe(1);
    expect(again.stderr).toContain("never overwrite");
  });
});
