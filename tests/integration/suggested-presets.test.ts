import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BUNDLED_PRESET_IDS, loadPreset } from "../../src/config/presets.js";
import { statusCategory } from "../../src/domain/item.js";
import { testApp } from "../support/app.js";

const DIR = fileURLToPath(new URL("../../presets/suggested/", import.meta.url));
const FILES = readdirSync(DIR).filter((f) => f.endsWith(".json"));
const README = readFileSync(join(DIR, "README.md"), "utf8");

describe("suggested presets", () => {
  it("ships at least the eight researched templates", () => {
    expect(FILES.length).toBeGreaterThanOrEqual(8);
  });

  it.each(FILES)("%s is valid, documented and not bundled", (file) => {
    const preset = loadPreset(join(DIR, file));
    expect(`${preset.id}.json`).toBe(file);
    expect(README).toContain(`\`${preset.id}\``);
    expect(BUNDLED_PRESET_IDS as readonly string[]).not.toContain(preset.id);
    expect(preset.description.toLowerCase()).toContain("not a complete");
  });

  it.each(FILES)("%s runs capture, transition and completion through the engine", (file) => {
    const path = join(DIR, file);
    const app = testApp({ preset: path });
    const { preset } = app.store;
    const created: Record<string, string> = {};

    // Parents before children: repeat until every creatable type exists.
    const types = Object.entries(preset.itemTypes);
    for (let pass = 0; pass < types.length; pass++) {
      for (const [type, def] of types) {
        if (created[type] !== undefined) continue;
        const parentType = def.parents.find((p) => created[p] !== undefined);
        if (!def.rootAllowed && parentType === undefined) continue;
        created[type] = app.items.capture({
          type,
          title: `${type} sample`,
          ...(def.rootAllowed ? {} : { parentId: created[parentType as string] }),
        }).item.id;
      }
    }
    expect(Object.keys(created).sort()).toEqual(Object.keys(preset.itemTypes).sort());

    const [executable] = types.filter(([, def]) => def.executable).map(([type]) => type);
    const id = created[executable as string] as string;
    const item = app.items.query({ id }).items[0];
    const next = preset.transitions[item?.status ?? ""]?.[0];
    if (next !== undefined) {
      expect(app.items.update({ id, status: next }).status).toBe(next);
    }

    const done = app.items.complete(id);
    expect(statusCategory(preset, done.item.status)).toBe("done");
    expect(app.metrics.get({}).completedCount).toBe(1);
    expect(app.plans.preview({}).totalEligible).toBeGreaterThanOrEqual(0);
  });
});
