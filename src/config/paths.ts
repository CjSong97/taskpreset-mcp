import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, normalize } from "node:path";
import { TaskPresetError } from "../domain/errors.js";

export const DEFAULT_DB_FILENAME = "taskpreset.db";

/** Directory and file name used before the project was renamed from "Waypoint". */
export const LEGACY_DB_FILENAME = "waypoint.db";

function dataDir(
  names: { windowsMac: string; linux: string },
  platform: NodeJS.Platform,
  env: NodeJS.ProcessEnv,
  home: string,
): string {
  if (platform === "win32") {
    return join(env.LOCALAPPDATA ?? join(home, "AppData", "Local"), names.windowsMac);
  }
  if (platform === "darwin") {
    return join(home, "Library", "Application Support", names.windowsMac);
  }
  return join(env.XDG_DATA_HOME ?? join(home, ".local", "share"), names.linux);
}

/** OS user-data directory for TaskPreset, outside any repository. */
export function defaultDataDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): string {
  return dataDir({ windowsMac: "TaskPreset", linux: "taskpreset" }, platform, env, home);
}

/** The pre-rename data directory, still used if a store already lives there. */
export function legacyDataDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): string {
  return dataDir({ windowsMac: "Waypoint", linux: "waypoint" }, platform, env, home);
}

/**
 * A startup setting from TASKPRESET_<name>, falling back to the pre-rename WAYPOINT_<name> so
 * existing client configurations keep working.
 */
export function startupEnv(
  name: "DB" | "PRESET" | "TIMEZONE",
  env: NodeJS.ProcessEnv = process.env,
): string | undefined {
  return env[`TASKPRESET_${name}`] ?? env[`WAYPOINT_${name}`];
}

/**
 * Resolve the database path from startup configuration. An explicit path must be absolute so
 * every client that launches the server resolves the same file regardless of working directory.
 */
export function resolveDbPath(
  explicit: string | undefined,
  exists: (path: string) => boolean = existsSync,
): string {
  if (explicit === undefined || explicit === "") {
    const current = join(defaultDataDir(), DEFAULT_DB_FILENAME);
    const legacy = join(legacyDataDir(), LEGACY_DB_FILENAME);
    // Never orphan a store created before the rename.
    return !exists(current) && exists(legacy) ? legacy : current;
  }
  if (!isAbsolute(explicit)) {
    throw new TaskPresetError(
      "config",
      `Database path must be absolute (got "${explicit}"). Relative paths resolve differently per client.`,
    );
  }
  return normalize(explicit);
}
