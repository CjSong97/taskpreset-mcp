import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { App } from "../app.js";
import { WaypointError } from "../domain/errors.js";
import { itemDto, planDto } from "./dto.js";
import { handler } from "./results.js";
import {
  captureInput,
  captureOutput,
  completeInput,
  completeOutput,
  getDayPlanInput,
  getDayPlanOutput,
  planDayInput,
  planDayOutput,
  queryInput,
  queryOutput,
  systemOutput,
  updateInput,
  updateOutput,
} from "./schemas.js";
import { SERVER_NAME, SERVER_VERSION } from "./server-info.js";

const READ_ONLY = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

export function createServer(app: Pick<App, "describeSystem" | "items" | "plans">): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "get_system",
    {
      title: "Get productivity system",
      description:
        "Describe the configured productivity system: preset identity, item types, statuses, " +
        "permitted transitions, tag meaning, timezone and input limits. Call this first.",
      outputSchema: systemOutput,
      annotations: READ_ONLY,
    },
    handler("get_system", () => ({ ...app.describeSystem() })),
  );

  server.registerTool(
    "capture_item",
    {
      title: "Capture item",
      description:
        "Create a project, goal, task or other item type defined by the preset. Provide a " +
        "request_id so a retried call cannot create a duplicate.",
      inputSchema: captureInput,
      outputSchema: captureOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    handler("capture_item", (args) => {
      const result = app.items.capture({
        type: args.type,
        title: args.title,
        description: args.description,
        status: args.status,
        parentId: args.parent_id,
        tags: args.tags,
        priority: args.priority,
        dueDate: args.due_date,
        requestId: args.request_id,
      });
      return { item: itemDto(result.item), replayed: result.replayed };
    }),
  );

  server.registerTool(
    "query_items",
    {
      title: "Query items",
      description:
        "List items filtered by id, type, status or status category, parent, tag or due-date " +
        "range. Results are ordered by creation time and paginated; pass next_cursor to continue.",
      inputSchema: queryInput,
      outputSchema: queryOutput,
      annotations: READ_ONLY,
    },
    handler("query_items", (args) => {
      const result = app.items.query({
        id: args.id,
        type: args.type,
        statuses: args.status,
        statusCategory: args.status_category,
        parentId: args.parent_id,
        rootOnly: args.root_only,
        tag: args.tag,
        dueFrom: args.due_from,
        dueTo: args.due_to,
        limit: args.limit,
        cursor: args.cursor,
      });
      return { items: result.items.map(itemDto), next_cursor: result.nextCursor };
    }),
  );

  server.registerTool(
    "update_item",
    {
      title: "Update item",
      description:
        "Edit an item's title, description, tags, priority, due date or parent, or move it to a " +
        "status permitted by the preset's transitions (including cancelling). It cannot mark " +
        "work done (use complete_item), reopen completed work or set completion times.",
      inputSchema: updateInput,
      outputSchema: updateOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handler("update_item", (args) => {
      const item = app.items.update({
        id: args.id,
        title: args.title,
        description: args.description,
        status: args.status,
        parentId: args.parent_id,
        tags: args.tags,
        priority: args.priority,
        dueDate: args.due_date,
      });
      return { item: itemDto(item) };
    }),
  );

  server.registerTool(
    "complete_item",
    {
      title: "Complete item",
      description:
        "Mark an open item done and record its completion time. Calling it again on a done item " +
        "returns the original completion without counting it twice. Children are not completed. " +
        "Cancelled items cannot be completed.",
      inputSchema: completeInput,
      outputSchema: completeOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handler("complete_item", (args) => {
      const result = app.items.complete(args.id);
      return { item: itemDto(result.item), already_completed: result.alreadyCompleted };
    }),
  );

  server.registerTool(
    "plan_day",
    {
      title: "Plan a day",
      description:
        "By default, preview open executable work for a day (today unless date is given), " +
        "ordered by priority, due date, then creation time and capped at max_items. The " +
        "preview is read-only and does not schedule times or estimate effort. To save a plan, " +
        "call again with commit=true and the chosen item_ids in order; replacing an existing " +
        "plan needs its expected_revision. Saving never changes item status or due dates.",
      inputSchema: planDayInput,
      outputSchema: planDayOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    handler("plan_day", (args) => {
      if (args.commit === true) {
        if (args.item_ids === undefined) {
          throw new WaypointError("validation", "commit=true requires item_ids in plan order.");
        }
        const saved = app.plans.commit({
          date: args.date,
          itemIds: args.item_ids,
          expectedRevision: args.expected_revision,
        });
        return {
          mode: "committed",
          date: saved.plan.date,
          timezone: app.plans.timezone,
          note: `Saved revision ${saved.plan.revision}.`,
          plan: planDto(saved),
        };
      }
      if (args.item_ids !== undefined || args.expected_revision !== undefined) {
        throw new WaypointError(
          "validation",
          "item_ids and expected_revision are only used with commit=true; nothing was saved.",
        );
      }
      const preview = app.plans.preview({ date: args.date, maxItems: args.max_items });
      const existing = app.plans.get(preview.date);
      return {
        mode: "preview",
        date: preview.date,
        timezone: preview.timezone,
        note: "Preview only; nothing was saved. To save, call plan_day with commit=true and item_ids.",
        max_items: preview.maxItems,
        candidates: preview.candidates.map(itemDto),
        total_eligible: preview.totalEligible,
        existing_plan: existing
          ? { revision: existing.plan.revision, item_ids: existing.plan.itemIds }
          : null,
      };
    }),
  );

  server.registerTool(
    "get_day_plan",
    {
      title: "Get day plan",
      description:
        "Return the committed plan for a date (today by default) in order, with its revision " +
        "and each item's current state, or null if no plan was saved.",
      inputSchema: getDayPlanInput,
      outputSchema: getDayPlanOutput,
      annotations: READ_ONLY,
    },
    handler("get_day_plan", (args) => {
      const date = args.date ?? app.plans.today();
      const plan = app.plans.get(date);
      return { date, timezone: app.plans.timezone, plan: plan ? planDto(plan) : null };
    }),
  );

  return server;
}
