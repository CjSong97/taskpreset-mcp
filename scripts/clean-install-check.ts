/**
 * Clean-install verification: clone the committed repository into a temporary directory,
 * install from the lockfile, build, initialise an empty store, run doctor, then drive the
 * server through a real MCP client. Usage: npm run check:clean-install [-- --keep]
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repo = fileURLToPath(new URL("..", import.meta.url));
const keep = process.argv.includes("--keep");
const work = mkdtempSync(join(tmpdir(), "taskpreset-clean-install-"));
const clone = join(work, "taskpreset-mcp");
const db = join(work, "data", "taskpreset.db");
// Run npm's own CLI through node: no shell, so arguments are never re-parsed.
const npmCli = process.env.npm_execpath;
if (npmCli === undefined) throw new Error("Run this via `npm run check:clean-install`.");

function step(name: string, fn: () => void | Promise<void>) {
  return async () => {
    process.stdout.write(`- ${name} ... `);
    await fn();
    process.stdout.write("ok\n");
  };
}

function run(cmd: string, args: string[], cwd = clone): string {
  return execFileSync(cmd, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

function npm(args: string[]): string {
  return run(process.execPath, [npmCli as string, ...args]);
}

interface ToolResult {
  isError?: boolean;
  structuredContent?: Record<string, unknown>;
}

const steps = [
  step(`clone ${repo} (HEAD) into ${clone}`, () => {
    run("git", ["clone", "--quiet", "--no-hardlinks", repo, clone], work);
  }),
  step("npm ci (lockfile)", () => {
    npm(["ci", "--no-audit", "--no-fund"]);
  }),
  step("npm run build", () => {
    npm(["run", "build"]);
  }),
  step("init a new empty store", () => {
    const out = run(process.execPath, ["dist/cli/main.js", "init", "--db", db]);
    if (!out.includes("Created TaskPreset store")) throw new Error(out);
  }),
  step("doctor reports healthy", () => {
    const out = run(process.execPath, ["dist/cli/main.js", "doctor", "--db", db]);
    if (out.includes("[FAIL]")) throw new Error(out);
  }),
  step("MCP client: capture -> plan -> complete -> metrics", async () => {
    const sdk = join(clone, "node_modules", "@modelcontextprotocol", "sdk", "dist", "esm");
    const { Client } = (await import(pathToFileURL(join(sdk, "client", "index.js")).href)) as {
      Client: new (info: { name: string; version: string }) => {
        connect(t: unknown): Promise<void>;
        listTools(): Promise<{ tools: { name: string }[] }>;
        callTool(r: { name: string; arguments?: Record<string, unknown> }): Promise<ToolResult>;
        close(): Promise<void>;
      };
    };
    const { StdioClientTransport } = (await import(
      pathToFileURL(join(sdk, "client", "stdio.js")).href
    )) as { StdioClientTransport: new (p: Record<string, unknown>) => unknown };

    const client = new Client({ name: "clean-install-check", version: "0.0.0" });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [join(clone, "dist", "cli", "main.js"), "serve", "--db", db],
        stderr: "ignore",
      }),
    );
    try {
      const call = async (name: string, args: Record<string, unknown> = {}) => {
        const result = await client.callTool({ name, arguments: args });
        if (result.isError || !result.structuredContent) throw new Error(`${name} failed`);
        return result.structuredContent;
      };
      const tools = (await client.listTools()).tools.map((t) => t.name).sort();
      const expected = [
        "capture_item",
        "complete_item",
        "get_day_plan",
        "get_metrics",
        "get_system",
        "plan_day",
        "query_items",
        "update_item",
      ];
      if (JSON.stringify(tools) !== JSON.stringify(expected)) {
        throw new Error(`unexpected tools ${tools.join(", ")}`);
      }
      await call("get_system");
      const item = (await call("capture_item", { type: "task", title: "Clean install check" }))
        .item as { id: string };
      await call("plan_day", { commit: true, item_ids: [item.id] });
      await call("complete_item", { id: item.id });
      const metrics = await call("get_metrics");
      if (metrics.completed_count !== 1) throw new Error("completed_count != 1");
    } finally {
      await client.close();
    }
  }),
];

try {
  for (const s of steps) await s();
  process.stdout.write(`\nClean install check passed (node ${process.version}).\n`);
} catch (error) {
  process.stdout.write("FAILED\n");
  const e = error as { message?: string; stderr?: string };
  process.stderr.write(`${e.stderr ?? ""}${e.message ?? String(error)}\n`);
  process.exitCode = 1;
} finally {
  if (keep) process.stdout.write(`Kept ${work}\n`);
  else rmSync(work, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
