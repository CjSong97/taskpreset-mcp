import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SystemDescription } from "../services/system.js";
import { handler } from "./results.js";
import { systemOutput } from "./schemas.js";
import { SERVER_NAME, SERVER_VERSION } from "./server-info.js";

export interface ServerContext {
  describeSystem(): SystemDescription;
}

export function createServer(ctx: ServerContext): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });

  server.registerTool(
    "get_system",
    {
      title: "Get productivity system",
      description:
        "Describe the configured productivity system: preset identity, item types, statuses, " +
        "permitted transitions, tag meaning, timezone and input limits. Call this first.",
      outputSchema: systemOutput,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    handler("get_system", () => ({ ...ctx.describeSystem() })),
  );

  return server;
}
