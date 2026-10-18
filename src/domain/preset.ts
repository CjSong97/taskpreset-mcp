export type StatusCategory = "open" | "done" | "cancelled";

export interface ItemTypeDefinition {
  label: string;
  /** Executable work can be planned, counted in metrics and completed. */
  executable: boolean;
  /** Item types this type may be nested under. */
  parents: string[];
  /** Whether an item of this type may exist without a parent. */
  rootAllowed: boolean;
}

export interface StatusDefinition {
  label: string;
  category: StatusCategory;
}

export interface Preset {
  id: string;
  version: string;
  name: string;
  description: string;
  /** What tags mean in this system, e.g. "Element" or "Context". */
  tagLabel: string;
  itemTypes: Record<string, ItemTypeDefinition>;
  statuses: Record<string, StatusDefinition>;
  /** Statuses an item may be created in. The first is the default. */
  initialStatuses: string[];
  /** Permitted update_item transitions. Done is reached only via complete_item. */
  transitions: Record<string, string[]>;
}

/**
 * Cross-reference rules a structurally valid preset must also satisfy. Returns every problem
 * found (empty when valid) so preset authors can fix them in one pass.
 */
export function presetProblems(preset: Preset): string[] {
  const problems: string[] = [];
  const statuses = Object.keys(preset.statuses);
  const types = Object.keys(preset.itemTypes);
  const category = (s: string) => preset.statuses[s]?.category;

  if (types.length === 0) problems.push("itemTypes: define at least one item type");
  if (!Object.values(preset.itemTypes).some((t) => t.executable)) {
    problems.push("itemTypes: at least one type must be executable");
  }
  for (const [type, definition] of Object.entries(preset.itemTypes)) {
    for (const parent of definition.parents) {
      if (!(parent in preset.itemTypes)) {
        problems.push(`itemTypes.${type}.parents: unknown item type "${parent}"`);
      }
    }
    if (new Set(definition.parents).size !== definition.parents.length) {
      problems.push(`itemTypes.${type}.parents: duplicate entries`);
    }
  }
  // Every type must be creatable: allowed at the root, or under a type that is creatable.
  const creatable = new Set(types.filter((t) => preset.itemTypes[t]?.rootAllowed));
  let grew = true;
  while (grew) {
    grew = false;
    for (const [type, definition] of Object.entries(preset.itemTypes)) {
      if (!creatable.has(type) && definition.parents.some((p) => creatable.has(p))) {
        creatable.add(type);
        grew = true;
      }
    }
  }
  for (const type of types) {
    if (!creatable.has(type)) {
      problems.push(`itemTypes.${type}: can never be created (no root or reachable parent)`);
    }
  }

  const byCategory = (c: StatusCategory) => statuses.filter((s) => category(s) === c);
  if (byCategory("open").length === 0) problems.push("statuses: define at least one open status");
  if (byCategory("done").length !== 1) {
    problems.push(
      `statuses: define exactly one done status (found ${byCategory("done").length.toString()})`,
    );
  }

  if (new Set(preset.initialStatuses).size !== preset.initialStatuses.length) {
    problems.push("initialStatuses: duplicate entries");
  }
  for (const status of preset.initialStatuses) {
    if (category(status) === undefined) {
      problems.push(`initialStatuses: unknown status "${status}"`);
    } else if (category(status) !== "open") {
      problems.push(`initialStatuses: "${status}" must be an open status`);
    }
  }

  for (const [from, targets] of Object.entries(preset.transitions)) {
    if (category(from) === undefined) {
      problems.push(`transitions.${from}: unknown status`);
      continue;
    }
    if (category(from) === "done") {
      problems.push(`transitions.${from}: completed work cannot be reopened or moved`);
    }
    if (new Set(targets).size !== targets.length) {
      problems.push(`transitions.${from}: duplicate targets`);
    }
    for (const to of targets) {
      if (category(to) === undefined) {
        problems.push(`transitions.${from}: unknown target status "${to}"`);
      } else if (category(to) === "done") {
        problems.push(`transitions.${from}: "${to}" is a done status; use complete_item instead`);
      } else if (to === from) {
        problems.push(`transitions.${from}: a status cannot transition to itself`);
      }
    }
  }
  return problems;
}
