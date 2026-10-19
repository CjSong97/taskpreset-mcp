import { TaskPresetError } from "./errors.js";
import { LIMITS } from "./limits.js";
import type { Preset, StatusCategory } from "./preset.js";
import { isValidDateOnly } from "./time.js";

export interface Item {
  id: string;
  type: string;
  title: string;
  description: string | null;
  status: string;
  parentId: string | null;
  tags: string[];
  priority: number;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export function statusCategory(preset: Preset, status: string): StatusCategory {
  const definition = preset.statuses[status];
  if (!definition) {
    throw new TaskPresetError("validation", `Unknown status "${status}".`, {
      allowed: Object.keys(preset.statuses),
    });
  }
  return definition.category;
}

export function statusesIn(preset: Preset, category: StatusCategory): string[] {
  return Object.entries(preset.statuses)
    .filter(([, s]) => s.category === category)
    .map(([id]) => id);
}

export function doneStatus(preset: Preset): string {
  const [done] = statusesIn(preset, "done");
  if (done === undefined) throw new TaskPresetError("config", "Preset defines no done status.");
  return done;
}

export function assertItemType(preset: Preset, type: string): void {
  if (!(type in preset.itemTypes)) {
    throw new TaskPresetError("validation", `Unknown item type "${type}".`, {
      allowed: Object.keys(preset.itemTypes),
    });
  }
}

export function isExecutable(preset: Preset, type: string): boolean {
  return preset.itemTypes[type]?.executable ?? false;
}

/** Trim, drop exact duplicates and enforce tag limits. */
export function normalizeTags(tags: readonly string[]): string[] {
  const result: string[] = [];
  for (const raw of tags) {
    const tag = raw.trim();
    if (tag.length === 0) throw new TaskPresetError("validation", "Tags must not be empty.");
    if (tag.length > LIMITS.tagMaxLength) {
      throw new TaskPresetError(
        "validation",
        `Tags must be at most ${LIMITS.tagMaxLength} characters.`,
      );
    }
    if (!result.includes(tag)) result.push(tag);
  }
  if (result.length > LIMITS.tagsMax) {
    throw new TaskPresetError("validation", `At most ${LIMITS.tagsMax} tags are allowed.`);
  }
  return result;
}

export function assertDateOnly(field: string, value: string): void {
  if (!isValidDateOnly(value)) {
    throw new TaskPresetError("validation", `${field} must be a real calendar date as YYYY-MM-DD.`);
  }
}

/**
 * Check that `parent` may contain an item of `type`. `parent` is undefined for a root item.
 * `ancestorsOfParent` (parent's chain up to the root) is used to reject cycles on re-parenting.
 */
export function assertParentAllowed(
  preset: Preset,
  item: { id?: string; type: string },
  parent: Item | undefined,
  ancestorsOfParent: readonly string[] = [],
): void {
  const definition = preset.itemTypes[item.type];
  if (!definition) {
    assertItemType(preset, item.type);
    return;
  }
  if (parent === undefined) {
    if (!definition.rootAllowed) {
      throw new TaskPresetError(
        "validation",
        `A ${item.type} must have a parent of type ${definition.parents.join(" or ")}.`,
      );
    }
    return;
  }
  if (!definition.parents.includes(parent.type)) {
    throw new TaskPresetError(
      "validation",
      `A ${item.type} cannot be placed under a ${parent.type}.`,
      { allowedParentTypes: definition.parents },
    );
  }
  if (item.id !== undefined && (parent.id === item.id || ancestorsOfParent.includes(item.id))) {
    throw new TaskPresetError("validation", "That parent would create a cycle.");
  }
}
