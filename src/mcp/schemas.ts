import { z } from "zod";

const statusCategory = z.enum(["open", "done", "cancelled"]);

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
