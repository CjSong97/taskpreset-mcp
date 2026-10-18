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
