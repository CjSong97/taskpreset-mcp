import { readFileSync } from "node:fs";
import { isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { WaypointError } from "../domain/errors.js";
import { presetProblems, type Preset } from "../domain/preset.js";

const KEY = /^[a-z][a-z0-9_]{0,31}$/;
const key = z.string().regex(KEY, "must be lower_snake_case, starting with a letter (max 32)");
const label = z.string().trim().min(1).max(60);

const presetSchema = z.strictObject({
  id: z
    .string()
    .regex(/^[a-z][a-z0-9-]{0,47}$/, "must be lower-kebab-case, starting with a letter (max 48)"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "must be semver MAJOR.MINOR.PATCH"),
  name: label,
  description: z.string().trim().min(1).max(1000),
  tagLabel: label,
  itemTypes: z.record(
    key,
    z.strictObject({
      label,
      executable: z.boolean(),
      parents: z.array(key),
      rootAllowed: z.boolean(),
    }),
  ),
  statuses: z.record(
    key,
    z.strictObject({ label, category: z.enum(["open", "done", "cancelled"]) }),
  ),
  initialStatuses: z.array(key).min(1),
  transitions: z.record(key, z.array(key)),
});

export const BUNDLED_PRESET_IDS = ["avatar-lite", "gtd-lite"] as const;

/** Preset used when a new store is created without --preset. */
export const DEFAULT_PRESET = "avatar-lite";

const BUNDLED_DIR = fileURLToPath(new URL("../../presets/", import.meta.url));

/** Parse and validate preset JSON. Throws WaypointError("config") with every problem found. */
export function parsePreset(raw: unknown, source: string): Preset {
  const result = presetSchema.safeParse(raw);
  const problems = result.success
    ? presetProblems(result.data)
    : result.error.issues.map((i) => {
        const message =
          i.code === "invalid_key"
            ? "invalid key; keys must be lower_snake_case, starting with a letter (max 32)"
            : i.message;
        return `${i.path.join(".") || "(root)"}: ${message}`;
      });
  if (!result.success || problems.length > 0) {
    throw new WaypointError("config", `Invalid preset ${source}: ${problems.join("; ")}`, {
      problems,
    });
  }
  return result.data;
}

/**
 * Resolve a preset reference given at startup: a bundled preset ID (e.g. "avatar-lite") or an
 * absolute path to a JSON file. Never accepted from MCP tool input.
 */
export function loadPreset(reference: string): Preset {
  let path: string;
  if ((BUNDLED_PRESET_IDS as readonly string[]).includes(reference)) {
    path = `${BUNDLED_DIR}${reference}.json`;
  } else if (isAbsolute(reference) && reference.endsWith(".json")) {
    path = reference;
  } else {
    throw new WaypointError(
      "config",
      `Unknown preset "${reference}". Use one of ${BUNDLED_PRESET_IDS.join(", ")} or an absolute path to a .json file.`,
    );
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new WaypointError("config", `Could not read preset ${reference}: ${reason}`);
  }
  return parsePreset(raw, reference);
}
