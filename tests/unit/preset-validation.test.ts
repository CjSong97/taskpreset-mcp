import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUNDLED_PRESET_IDS, loadPreset, parsePreset } from "../../src/config/presets.js";
import { WaypointError } from "../../src/domain/errors.js";

type Json = Record<string, unknown>;

function avatar(): Json {
  return JSON.parse(
    readFileSync(new URL("../../presets/avatar-lite.json", import.meta.url), "utf8"),
  ) as Json;
}

function problemsFor(mutate: (preset: Json) => void): string[] {
  const preset = avatar();
  mutate(preset);
  try {
    parsePreset(preset, "test");
  } catch (error) {
    if (error instanceof WaypointError && error.code === "config") {
      return error.details?.problems as string[];
    }
    throw error;
  }
  return [];
}

const types = (p: Json) => p.itemTypes as Record<string, Json>;
const statuses = (p: Json) => p.statuses as Record<string, Json>;
const transitions = (p: Json) => p.transitions as Record<string, string[]>;

describe("preset validation", () => {
  it.each(BUNDLED_PRESET_IDS)("accepts bundled preset %s", (id) => {
    expect(loadPreset(id).id).toBe(id);
  });

  it("accepts an unmodified preset", () => {
    expect(problemsFor(() => undefined)).toEqual([]);
  });

  it.each<[string, (p: Json) => void, RegExp]>([
    ["unknown top-level key", (p) => (p.extra = 1), /Unrecognized key/],
    ["bad id", (p) => (p.id = "Avatar Lite"), /^id:/],
    ["bad version", (p) => (p.version = "1"), /^version:/],
    ["bad status category", (p) => (statuses(p).done = { label: "D", category: "x" }), /category/],
    ["bad key format", (p) => (types(p)["Bad-Key"] = { ...types(p).task }), /lower_snake_case/],
    [
      "unknown parent type",
      (p) => ((types(p).task as Json).parents = ["epic"]),
      /unknown item type "epic"/,
    ],
    [
      "uncreatable type",
      (p) => {
        Object.assign(types(p).goal as Json, { rootAllowed: false, parents: ["goal"] });
      },
      /goal: can never be created/,
    ],
    [
      "no executable type",
      (p) => {
        (types(p).task as Json).executable = false;
      },
      /at least one type must be executable/,
    ],
    [
      "two done statuses",
      (p) => (statuses(p).finished = { label: "F", category: "done" }),
      /exactly one done status \(found 2\)/,
    ],
    ["no done status", (p) => delete statuses(p).done, /exactly one done status \(found 0\)/],
    ["unknown initial status", (p) => (p.initialStatuses = ["nope"]), /unknown status "nope"/],
    ["done as initial status", (p) => (p.initialStatuses = ["done"]), /must be an open status/],
    ["empty initial statuses", (p) => (p.initialStatuses = []), /initialStatuses/],
    [
      "transition from unknown",
      (p) => (transitions(p).nope = ["in_progress"]),
      /transitions.nope: unknown status/,
    ],
    [
      "transition to unknown",
      (p) => (transitions(p).not_started = ["nope"]),
      /unknown target status "nope"/,
    ],
    ["transition to done", (p) => (transitions(p).not_started = ["done"]), /use complete_item/],
    ["transition from done", (p) => (transitions(p).done = ["not_started"]), /cannot be reopened/],
    ["self transition", (p) => (transitions(p).not_started = ["not_started"]), /to itself/],
  ])("rejects %s", (_name, mutate, expected) => {
    const problems = problemsFor(mutate);
    expect(
      problems.some((p) => expected.test(p)),
      problems.join("\n"),
    ).toBe(true);
  });

  it("reports every problem at once", () => {
    const problems = problemsFor((p) => {
      p.initialStatuses = ["done"];
      transitions(p).not_started = ["nope"];
    });
    expect(problems.length).toBeGreaterThanOrEqual(2);
  });

  it("gives actionable errors for unknown references", () => {
    expect(() => loadPreset("missing-preset")).toThrow(/Use one of/);
    expect(() => loadPreset("relative/path.json")).toThrow(/absolute path/);
  });
});
