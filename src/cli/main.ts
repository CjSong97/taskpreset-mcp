#!/usr/bin/env node
import { parseArgs } from "node:util";
import { resolveDbPath } from "../config/paths.js";
import { isWaypointError, WaypointError } from "../domain/errors.js";
import { log } from "../mcp/log.js";
import { openApp } from "../app.js";
import { createServer } from "../mcp/server.js";
import { runStdio } from "../mcp/stdio.js";

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

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      db: { type: "string", default: process.env.WAYPOINT_DB },
      preset: { type: "string", default: process.env.WAYPOINT_PRESET },
      timezone: { type: "string", default: process.env.WAYPOINT_TIMEZONE },
    },
  });
  const options: StartupOptions = {
    db: values.db,
    preset: values.preset,
    timezone: values.timezone,
  };
  const command = positionals[0] ?? "serve";
  if (command === "serve") {
    await serve(options);
    return;
  }
  throw new WaypointError("config", `Unknown command "${command}". Available: serve.`);
}

main(process.argv.slice(2)).catch((error: unknown) => {
  if (isWaypointError(error)) {
    log("error", "startup_failed", { code: error.code, message: error.message });
  } else {
    log("error", "startup_failed", {
      message: error instanceof Error ? error.message : String(error),
    });
  }
  process.exitCode = 1;
});
