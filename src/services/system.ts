import { LIMITS } from "../domain/limits.js";
import type { Preset, StatusCategory } from "../domain/preset.js";

export interface SystemDescription {
  preset: { id: string; version: string; name: string; description: string };
  tagLabel: string;
  itemTypes: {
    id: string;
    label: string;
    executable: boolean;
    parents: string[];
    rootAllowed: boolean;
  }[];
  statuses: { id: string; label: string; category: StatusCategory }[];
  initialStatuses: string[];
  defaultStatus: string;
  transitions: { from: string; to: string[] }[];
  timezone: string;
  limits: typeof LIMITS;
}

export function describeSystem(preset: Preset, timezone: string): SystemDescription {
  return {
    preset: {
      id: preset.id,
      version: preset.version,
      name: preset.name,
      description: preset.description,
    },
    tagLabel: preset.tagLabel,
    itemTypes: Object.entries(preset.itemTypes).map(([id, t]) => ({ id, ...t })),
    statuses: Object.entries(preset.statuses).map(([id, s]) => ({ id, ...s })),
    initialStatuses: preset.initialStatuses,
    defaultStatus: preset.initialStatuses[0] ?? "",
    transitions: Object.entries(preset.transitions).map(([from, to]) => ({ from, to })),
    timezone,
    limits: LIMITS,
  };
}
