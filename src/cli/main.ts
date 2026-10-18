#!/usr/bin/env node
import { parseArgs } from "node:util";
import { openApp } from "../app.js";
import { resolveDbPath } from "../config/paths.js";
import { isWaypointError, WaypointError } from "../domain/errors.js";
import { log } from "../mcp/log.js";
import { createServer } from "../mcp/server.js";
import { runStdio } from "../mcp/stdio.js";
import { backupStore } from "./backup.js";
import { formatChecks, runDoctor } from "./doctor.js";
import { initStore } from "./init.js";

const HELP = `Waypoint — local productivity MCP server

Usage: node dist/cli/main.js <command> [options]

Commands:
  serve    Run the MCP server over stdio (default). Creates the store on first run.
  init     Create a new empty store. Refuses to modify an existing file.
  doctor   Read-only diagnostics for the runtime, configuration and store.
  backup   Write a verified snapshot of the store to --out (never overwrites).

Options (environment variable in brackets):
  --db <absolute path>   Store file [WAYPOINT_DB]. Default: OS user-data directory.
  --preset <id|path>     avatar-lite, gtd-lite or an absolute .json path [WAYPOINT_PRESET].
                         New stores default to avatar-lite; existing stores keep their preset.
  --timezone <IANA>      Timezone for new stores, default Europe/London [WAYPOINT_TIMEZONE].
  --out <absolute path>  backup only: destination file, which must not exist.
  --help                 Show this help.
`;

interface StartupOptions {
  db: string | undefined;
  preset: string | undefined;
  timezone: string | undefined;
}

async function serve(options: StartupOptions): Promise<void> {
  const app = openApp({
    path: resolveDbPath(options.db),
    preset: options.preset,
    timezone: options.timezone,
  });
  log("info", "store_opened", {
    created: app.store.created,
    preset: app.store.preset.id,
    schemaVersion: app.store.schemaVersion,
  });
  await runStdio(createServer(app), () => {
    app.close();
  });
}

function print(lines: string[]): void {
  process.stdout.write(`${lines.join("\n")}\n`);
}

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      db: { type: "string", default: process.env.WAYPOINT_DB },
      preset: { type: "string", default: process.env.WAYPOINT_PRESET },
      timezone: { type: "string", default: process.env.WAYPOINT_TIMEZONE },
      out: { type: "string" },
      help: { type: "boolean", default: false },
    },
  });
  const options: StartupOptions = {
    db: values.db,
    preset: values.preset,
    timezone: values.timezone,
  };
  const command = positionals[0] ?? "serve";

  if (values.help || command === "help") {
    print([HELP]);
    return;
  }
  switch (command) {
    case "serve":
      await serve(options);
      return;
    case "init":
      print(initStore({ ...options, path: resolveDbPath(options.db) }));
      return;
    case "doctor": {
      const checks = runDoctor({ path: resolveDbPath(options.db), preset: options.preset });
      print(formatChecks(checks));
      if (checks.some((c) => !c.ok)) process.exitCode = 1;
      return;
    }
    case "backup":
      print(backupStore({ source: resolveDbPath(options.db), out: values.out }));
      return;
    default:
      throw new WaypointError(
        "config",
        `Unknown command "${command}". Available: serve, init, doctor, backup (see --help).`,
      );
  }
}

main(process.argv.slice(2)).catch((error: unknown) => {
  if (isWaypointError(error)) {
    log("error", "command_failed", { code: error.code, message: error.message });
  } else {
    log("error", "command_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  process.exitCode = 1;
});
