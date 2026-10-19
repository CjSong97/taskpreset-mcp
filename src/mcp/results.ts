import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { isTaskPresetError } from "../domain/errors.js";
import { log } from "./log.js";

export function ok(data: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
    structuredContent: data,
  };
}

export function fail(tool: string, error: unknown): CallToolResult {
  if (isTaskPresetError(error)) {
    const body = {
      error: { code: error.code, message: error.message, ...(error.details ?? {}) },
    };
    return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }], isError: true };
  }
  // Unexpected: log the error class and message only (no arguments, which may hold item content).
  log("error", "tool_failed", {
    tool,
    error: error instanceof Error ? error.name : "unknown",
    message: error instanceof Error ? error.message : undefined,
  });
  const body = { error: { code: "internal", message: "Internal error; see server stderr log." } };
  return { content: [{ type: "text", text: JSON.stringify(body, null, 2) }], isError: true };
}

/** Wrap a handler so domain errors become tool errors instead of protocol errors. */
export function handler<A>(
  tool: string,
  fn: (args: A) => Record<string, unknown>,
): (args: A) => CallToolResult {
  return (args: A) => {
    try {
      return ok(fn(args));
    } catch (error) {
      return fail(tool, error);
    }
  };
}
