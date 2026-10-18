import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { App } from "../app.js";
import { itemDto } from "./dto.js";
import { handler } from "./results.js";
import {
  captureInput,
  captureOutput,
  completeInput,
  completeOutput,
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
        "Preview open executable work for a day (today by default), ordered by priority, due " +
        "date, then creation time and capped at max_items. The preview is read-only; it does " +
        "not schedule times or estimate effort.",
      inputSchema: planDayInput,
      outputSchema: planDayOutput,
      annotations: READ_ONLY,
    },
    handler("plan_day", (args) => {
      const preview = app.plans.preview({ date: args.date, maxItems: args.max_items });
      return {
        mode: "preview",
        date: preview.date,
        timezone: preview.timezone,
        note: "Preview only; nothing was saved.",
        max_items: preview.maxItems,
        candidates: preview.candidates.map(itemDto),
        total_eligible: preview.totalEligible,
      };
    }),
  );

  return server;
}
