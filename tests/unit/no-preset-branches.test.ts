import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BUNDLED_PRESET_IDS } from "../../src/config/presets.js";

const SRC = fileURLToPath(new URL("../../src/", import.meta.url));
// Only src/config (bundled preset list and default) and src/cli may name presets.
const ENGINE_DIRS = ["domain", "services", "storage", "mcp"];

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? files(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}

describe("engine is preset-agnostic", () => {
  it("never mentions a preset ID in domain, services, storage or MCP code", () => {
    const offenders = ENGINE_DIRS.flatMap((d) => files(join(SRC, d))).filter((file) => {
      const text = readFileSync(file, "utf8");
      return BUNDLED_PRESET_IDS.some((id) => text.includes(id));
    });
    expect(offenders).toEqual([]);
  });
});
