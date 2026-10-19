import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

/** The compiled server entry point. `npm test` builds before running Vitest. */
export const SERVER_ENTRY = fileURLToPath(new URL("../../dist/cli/main.js", import.meta.url));

export interface Session {
  client: Client;
  stderr: () => string;
  /** Protocol-level errors seen by the client, e.g. unparseable stdout lines. */
  protocolErrors: Error[];
  close: () => Promise<void>;
}

export async function connect(args: string[] = []): Promise<Session> {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER_ENTRY, ...args],
    env: { ...process.env } as Record<string, string>,
    stderr: "pipe",
  });
  let stderr = "";
  transport.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString("utf8");
  });
  const client = new Client({ name: "taskpreset-test-client", version: "0.0.0" });
  const protocolErrors: Error[] = [];
  client.onerror = (error) => {
    protocolErrors.push(error);
  };
  await client.connect(transport);
  return {
    client,
    stderr: () => stderr,
    protocolErrors,
    close: () => client.close(),
  };
}

/** Call a tool and return its structured content, failing loudly on tool errors. */
export async function callOk(
  session: Session,
  name: string,
  args: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const result = (await session.client.callTool({ name, arguments: args })) as CallToolResult;
  if (result.isError) {
    throw new Error(`${name} failed: ${JSON.stringify(result.content)}`);
  }
  if (!result.structuredContent) throw new Error(`${name} returned no structured content`);
  return result.structuredContent;
}

/** Call a tool expected to fail and return the parsed error body. */
export async function callError(
  session: Session,
  name: string,
  args: Record<string, unknown> = {},
): Promise<{ code: string; message: string; [k: string]: unknown }> {
  const result = (await session.client.callTool({ name, arguments: args })) as CallToolResult;
  if (!result.isError) throw new Error(`${name} unexpectedly succeeded`);
  const first = result.content[0];
  const text = first?.type === "text" ? first.text : "";
  try {
    const body = JSON.parse(text) as { error: { code: string; message: string } };
    return body.error;
  } catch {
    // SDK-level input validation errors are plain text.
    return { code: "input_validation", message: text };
  }
}

export interface RawRun {
  stdoutLines: string[];
  stderr: string;
  exitCode: number | null;
}

/** Run the server with raw JSON-RPC lines on stdin, close stdin, and capture everything. */
export function runRaw(messages: unknown[], args: string[] = []): Promise<RawRun> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [SERVER_ENTRY, ...args], { stdio: "pipe" });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (c: Buffer) => (stdout += c.toString("utf8")));
    child.stderr.on("data", (c: Buffer) => (stderr += c.toString("utf8")));
    child.on("error", reject);
    child.on("exit", (exitCode) => {
      resolve({ stdoutLines: stdout.split("\n").filter((l) => l.length > 0), stderr, exitCode });
    });
    for (const message of messages) child.stdin.write(`${JSON.stringify(message)}\n`);
    // Give the server time to answer before signalling disconnect.
    setTimeout(() => child.stdin.end(), 500);
  });
}
