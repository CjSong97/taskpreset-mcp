import { existsSync, statSync } from "node:fs";
import Database from "better-sqlite3";
import { canonicalJson } from "../config/canonical.js";
import { loadPreset } from "../config/presets.js";
import { isTaskPresetError } from "../domain/errors.js";
import { MIGRATIONS } from "../storage/migrations/index.js";

export interface Check {
  ok: boolean;
  label: string;
  detail: string;
}

export interface DoctorOptions {
  path: string;
  preset: string | undefined;
  nodeVersion?: string;
}

const REQUIRED_NODE_MAJOR = 24;
const REQUIRED_NODE_MINOR = 11;

function nodeCheck(version: string): Check {
  const [major = 0, minor = 0] = version.replace(/^v/, "").split(".").map(Number);
  const ok = major === REQUIRED_NODE_MAJOR && minor >= REQUIRED_NODE_MINOR;
  return {
    ok,
    label: "Node.js",
    detail: ok
      ? version
      : `${version}; TaskPreset requires Node ${REQUIRED_NODE_MAJOR}.${REQUIRED_NODE_MINOR}+ (see .nvmrc)`,
  };
}

function message(error: unknown): string {
  return isTaskPresetError(error) || error instanceof Error ? error.message : String(error);
}

/**
 * Read-only diagnostics. Never creates, migrates or writes the store, and reports counts only —
 * never item titles, descriptions or tags.
 */
export function runDoctor(options: DoctorOptions): Check[] {
  const checks: Check[] = [nodeCheck(options.nodeVersion ?? process.version)];

  let sqliteVersion: string;
  try {
    const memory = new Database(":memory:");
    sqliteVersion = (memory.prepare("SELECT sqlite_version() AS v").get() as { v: string }).v;
    memory.close();
    checks.push({ ok: true, label: "better-sqlite3", detail: `loaded (SQLite ${sqliteVersion})` });
  } catch (error) {
    checks.push({
      ok: false,
      label: "better-sqlite3",
      detail: `native module failed to load: ${message(error)}. Run "npm ci" with Node 24.`,
    });
    return checks;
  }

  let configured: ReturnType<typeof loadPreset> | undefined;
  if (options.preset !== undefined) {
    try {
      configured = loadPreset(options.preset);
      checks.push({
        ok: true,
        label: "Configured preset",
        detail: `${configured.id}@${configured.version} is valid`,
      });
    } catch (error) {
      checks.push({ ok: false, label: "Configured preset", detail: message(error) });
    }
  }

  if (!existsSync(options.path) || statSync(options.path).size === 0) {
    checks.push({
      ok: false,
      label: "Store",
      detail: `no store at ${options.path}. Run "init" (or start "serve", which creates it).`,
    });
    return checks;
  }
  checks.push({ ok: true, label: "Store path", detail: options.path });

  let db: Database.Database | undefined;
  try {
    db = new Database(options.path, { readonly: true, fileMustExist: true });
    const has = (table: string) =>
      db?.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table) !==
      undefined;
    if (!has("schema_migrations") || !has("app_metadata")) {
      checks.push({ ok: false, label: "Store", detail: "file is not a TaskPreset store" });
      return checks;
    }

    const quick = (db.prepare("PRAGMA quick_check").get() as { quick_check: string }).quick_check;
    checks.push({ ok: quick === "ok", label: "Integrity (quick_check)", detail: quick });
    const journal = db.pragma("journal_mode", { simple: true }) as string;
    checks.push({ ok: journal === "wal", label: "Journal mode", detail: journal });

    const versions = (
      db.prepare("SELECT version FROM schema_migrations ORDER BY version").all() as {
        version: number;
      }[]
    ).map((r) => r.version);
    const latest = MIGRATIONS.at(-1)?.version ?? 0;
    const current = versions.at(-1) ?? 0;
    checks.push({
      ok: current <= latest,
      label: "Schema",
      detail:
        current === latest
          ? `version ${current} (current)`
          : current < latest
            ? `version ${current}; serve will migrate to ${latest}`
            : `version ${current} is newer than this build (${latest}); upgrade TaskPreset`,
    });

    const metadata = Object.fromEntries(
      (
        db.prepare("SELECT key, value FROM app_metadata").all() as { key: string; value: string }[]
      ).map((r) => [r.key, r.value]),
    );
    checks.push({
      ok: metadata.preset_id !== undefined,
      label: "Bound preset",
      detail: `${metadata.preset_id ?? "?"}@${metadata.preset_version ?? "?"}, timezone ${metadata.timezone ?? "?"}`,
    });
    if (configured) {
      const matches = canonicalJson(configured) === metadata.preset_snapshot;
      checks.push({
        ok: matches,
        label: "Preset compatibility",
        detail: matches
          ? "configured preset matches the store"
          : `configured ${configured.id}@${configured.version} differs from the store's preset; serve would refuse to start. Omit --preset or use a new --db.`,
      });
    }

    const count = (sql: string) => (db?.prepare(sql).get() as { n: number }).n;
    const plans = has("day_plans") ? count("SELECT count(*) AS n FROM day_plans") : 0;
    checks.push({
      ok: true,
      label: "Contents",
      detail: `${count("SELECT count(*) AS n FROM items")} items, ${plans} day plans`,
    });
  } catch (error) {
    checks.push({ ok: false, label: "Store", detail: `could not read store: ${message(error)}` });
  } finally {
    db?.close();
  }
  return checks;
}

export function formatChecks(checks: Check[]): string[] {
  return checks.map((c) => `${c.ok ? "[ok]  " : "[FAIL]"} ${c.label}: ${c.detail}`);
}
