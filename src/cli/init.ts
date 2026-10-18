import { existsSync, statSync } from "node:fs";
import { WaypointError } from "../domain/errors.js";
import { openStore } from "../storage/store.js";

export interface InitOptions {
  path: string;
  preset: string | undefined;
  timezone: string | undefined;
}

/** Create a new, empty store. Refuses to touch an existing file. */
export function initStore(options: InitOptions): string[] {
  if (existsSync(options.path) && statSync(options.path).size > 0) {
    throw new WaypointError(
      "config",
      `A file already exists at ${options.path}. init never modifies existing stores; run "doctor" to inspect it or choose another --db path.`,
    );
  }
  const store = openStore(options);
  try {
    return [
      `Created Waypoint store at ${store.path}`,
      `  preset:   ${store.preset.id}@${store.preset.version} (${store.preset.name})`,
      `  timezone: ${store.timezone}`,
      `  schema:   version ${store.schemaVersion}`,
    ];
  } finally {
    store.close();
  }
}
