import { describe, expect, it } from "vitest";
import { loadPreset } from "../../src/config/presets.js";
import { TaskPresetError } from "../../src/domain/errors.js";
import { assertParentAllowed, normalizeTags, type Item } from "../../src/domain/item.js";
import { isValidDateOnly } from "../../src/domain/time.js";

const preset = loadPreset("avatar-lite");

function item(id: string, type: string): Item {
  return {
    id,
    type,
    title: "x",
    description: null,
    status: "not_started",
    parentId: null,
    tags: [],
    priority: 3,
    dueDate: null,
    createdAt: "",
    updatedAt: "",
    completedAt: null,
  };
}

describe("isValidDateOnly", () => {
  it.each(["2026-10-18", "2024-02-29", "2026-12-31"])("accepts %s", (value) => {
    expect(isValidDateOnly(value)).toBe(true);
  });
  it.each(["2026-02-29", "2026-13-01", "2026-1-01", "2026-10-18T00:00", "", "18/10/2026"])(
    "rejects %s",
    (value) => {
      expect(isValidDateOnly(value)).toBe(false);
    },
  );
});

describe("normalizeTags", () => {
  it("trims and de-duplicates", () => {
    expect(normalizeTags([" fire ", "fire", "water"])).toEqual(["fire", "water"]);
  });
  it("rejects empty and over-long tags and too many tags", () => {
    expect(() => normalizeTags(["  "])).toThrow(TaskPresetError);
    expect(() => normalizeTags(["x".repeat(41)])).toThrow(TaskPresetError);
    expect(() => normalizeTags(Array.from({ length: 21 }, (_, i) => `t${i}`))).toThrow(
      TaskPresetError,
    );
  });
});

describe("assertParentAllowed", () => {
  it("allows configured parent types and roots", () => {
    expect(() => {
      assertParentAllowed(preset, { type: "task" }, item("g", "goal"));
    }).not.toThrow();
    expect(() => {
      assertParentAllowed(preset, { type: "project" }, undefined);
    }).not.toThrow();
  });
  it("rejects disallowed parent types", () => {
    expect(() => {
      assertParentAllowed(preset, { type: "project" }, item("t", "task"));
    }).toThrow(/cannot be placed under/);
  });
  it("rejects self-parenting and cycles", () => {
    expect(() => {
      assertParentAllowed(preset, { id: "g", type: "goal" }, item("g", "project"));
    }).toThrow(/cycle/);
    expect(() => {
      assertParentAllowed(preset, { id: "g", type: "task" }, item("p", "goal"), ["g"]);
    }).toThrow(/cycle/);
  });
});
