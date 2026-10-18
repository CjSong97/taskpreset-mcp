import { z } from "zod";
import { LIMITS } from "../domain/limits.js";

const statusCategory = z.enum(["open", "done", "cancelled"]);
const key = z.string().min(1).max(32);
const itemId = z.uuid().describe("Item UUID");
const dateOnly = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("Calendar date, YYYY-MM-DD");

export const itemOutput = z.object({
  id: z.string(),
  type: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  parent_id: z.string().nullable(),
  tags: z.array(z.string()),
  priority: z.number().int(),
  due_date: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable(),
});

export const systemOutput = {
  preset: z.object({
    id: z.string(),
    version: z.string(),
    name: z.string(),
    description: z.string(),
  }),
  tagLabel: z.string(),
  itemTypes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      executable: z.boolean(),
      parents: z.array(z.string()),
      rootAllowed: z.boolean(),
    }),
  ),
  statuses: z.array(z.object({ id: z.string(), label: z.string(), category: statusCategory })),
  initialStatuses: z.array(z.string()),
  defaultStatus: z.string(),
  transitions: z.array(z.object({ from: z.string(), to: z.array(z.string()) })),
  timezone: z.string(),
  limits: z.record(z.string(), z.unknown()),
};

export const captureInput = z.strictObject({
  type: key.describe("Item type ID from get_system"),
  title: z.string().min(1).max(LIMITS.titleMaxLength),
  description: z.string().max(LIMITS.descriptionMaxLength).optional(),
  status: key.optional().describe("Initial status; defaults to the preset default"),
  parent_id: itemId.optional(),
  tags: z.array(z.string().max(LIMITS.tagMaxLength)).max(LIMITS.tagsMax).optional(),
  priority: z
    .number()
    .int()
    .min(LIMITS.priority.highest)
    .max(LIMITS.priority.lowest)
    .optional()
    .describe("1 = highest, 4 = lowest; default 3"),
  due_date: dateOnly.optional(),
  request_id: z
    .string()
    .min(1)
    .max(LIMITS.requestIdMaxLength)
    .optional()
    .describe(
      "Client-chosen idempotency key. Retrying with the same key and payload returns the original item instead of creating a duplicate.",
    ),
});

export const captureOutput = { item: itemOutput, replayed: z.boolean() };

export const queryInput = z.strictObject({
  id: itemId.optional().describe("Return just this item; unknown IDs are a not_found error"),
  type: key.optional(),
  status: z.array(key).min(1).max(20).optional().describe("Match any of these statuses"),
  status_category: statusCategory.optional(),
  parent_id: itemId.optional(),
  root_only: z.boolean().optional().describe("Only items without a parent"),
  tag: z.string().max(LIMITS.tagMaxLength).optional(),
  due_from: dateOnly.optional().describe("Due on or after this date"),
  due_to: dateOnly.optional().describe("Due on or before this date"),
  limit: z.number().int().min(1).max(LIMITS.queryPageSizeMax).optional(),
  cursor: z.string().max(500).optional().describe("next_cursor from the previous page"),
});

export const queryOutput = { items: z.array(itemOutput), next_cursor: z.string().nullable() };

export const completeInput = z.strictObject({ id: itemId });

export const completeOutput = { item: itemOutput, already_completed: z.boolean() };

export const updateInput = z.strictObject({
  id: itemId,
  title: z.string().min(1).max(LIMITS.titleMaxLength).optional(),
  description: z
    .string()
    .max(LIMITS.descriptionMaxLength)
    .nullable()
    .optional()
    .describe("null clears the description"),
  status: key
    .optional()
    .describe("Target status; must be a permitted transition. Use complete_item for done."),
  parent_id: itemId.nullable().optional().describe("null moves the item to the root"),
  tags: z
    .array(z.string().max(LIMITS.tagMaxLength))
    .max(LIMITS.tagsMax)
    .optional()
    .describe("Replaces all tags"),
  priority: z.number().int().min(LIMITS.priority.highest).max(LIMITS.priority.lowest).optional(),
  due_date: dateOnly.nullable().optional().describe("null clears the due date"),
});

export const updateOutput = { item: itemOutput };
