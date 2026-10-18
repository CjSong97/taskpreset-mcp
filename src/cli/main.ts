#!/usr/bin/env node
import { parseArgs } from "node:util";
import { loadPreset } from "../config/presets.js";
import { isWaypointError, WaypointError } from "../domain/errors.js";
import { DEFAULT_TIMEZONE, isValidTimezone } from "../domain/time.js";
import { log } from "../mcp/log.js";
import { createServer } from "../mcp/server.js";
import { runStdio } from "../mcp/stdio.js";
import { describeSystem } from "../services/system.js";

async function serve(options: { preset: string; timezone: string }): Promise<void> {
  if (!isValidTimezone(options.timezone)) {
    throw new WaypointError("config", `Unknown IANA timezone "${options.timezone}".`);
  }
  const preset = loadPreset(options.preset);
  const server = createServer({ describeSystem: () => describeSystem(preset, options.timezone) });
  await runStdio(server, () => undefined);
}

async function main(argv: string[]): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      preset: { type: "string", default: process.env.WAYPOINT_PRESET ?? "avatar-lite" },
      timezone: { type: "string", default: process.env.WAYPOINT_TIMEZONE ?? DEFAULT_TIMEZONE },
    },
  });
  const command = positionals[0] ?? "serve";
  if (command === "serve") {
    await serve({ preset: values.preset, timezone: values.timezone });
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
