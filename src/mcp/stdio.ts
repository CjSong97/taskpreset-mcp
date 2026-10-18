import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { log } from "./log.js";

/**
 * Serve over stdio until the client disconnects (stdin ends) or a termination signal arrives,
 * then close the transport and run `cleanup` exactly once.
 */
export async function runStdio(server: McpServer, cleanup: () => void): Promise<void> {
  const transport = new StdioServerTransport();
  let closed = false;

  const shutdown = (reason: string): void => {
    if (closed) return;
    closed = true;
    log("info", "server_stopping", { reason });
    server
      .close()
      .catch((error: unknown) => {
        log("error", "transport_close_failed", {
          message: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        try {
          cleanup();
        } finally {
          log("info", "server_stopped");
          process.exitCode ??= 0;
        }
      });
  };

  process.stdin.on("end", () => {
    shutdown("stdin_closed");
  });
  process.stdin.on("close", () => {
    shutdown("stdin_closed");
  });
  process.on("SIGINT", () => {
    shutdown("SIGINT");
  });
  process.on("SIGTERM", () => {
    shutdown("SIGTERM");
  });
  transport.onclose = () => {
    shutdown("transport_closed");
  };

  await server.connect(transport);
  log("info", "server_started");
}
