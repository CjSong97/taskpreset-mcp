import { homedir } from "node:os";
import { isAbsolute, join, normalize } from "node:path";
import { WaypointError } from "../domain/errors.js";

export const DEFAULT_DB_FILENAME = "waypoint.db";

/** OS user-data directory for Waypoint, outside any repository. */
export function defaultDataDir(
  platform: NodeJS.Platform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
  home: string = homedir(),
): string {
  if (platform === "win32") {
    return join(env.LOCALAPPDATA ?? join(home, "AppData", "Local"), "Waypoint");
  }
  if (platform === "darwin") {
    return join(home, "Library", "Application Support", "Waypoint");
  }
  return join(env.XDG_DATA_HOME ?? join(home, ".local", "share"), "waypoint");
}

/**
 * Resolve the database path from startup configuration. An explicit path must be absolute so
 * every client that launches the server resolves the same file regardless of working directory.
 */
export function resolveDbPath(explicit: string | undefined): string {
  if (explicit === undefined || explicit === "") {
    return join(defaultDataDir(), DEFAULT_DB_FILENAME);
  }
  if (!isAbsolute(explicit)) {
    throw new WaypointError(
      "config",
      `Database path must be absolute (got "${explicit}"). Relative paths resolve differently per client.`,
    );
  }
  return normalize(explicit);
}
