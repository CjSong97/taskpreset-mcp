import { describe, expect, it } from "vitest";
import { tempDbPath } from "../support/tmp.js";
import { callError, callOk, connect, runRaw } from "./helpers.js";

const INIT = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "raw-test", version: "0.0.0" },
  },
};

describe("G1 — client connection", () => {
  it("initialises, lists tools and calls get_system", async () => {
    const session = await connect(["--db", tempDbPath()]);
    try {
      const { tools } = await session.client.listTools();
      const getSystem = tools.find((t) => t.name === "get_system");
      expect(getSystem).toBeDefined();
      expect(getSystem?.annotations?.readOnlyHint).toBe(true);

      const system = await callOk(session, "get_system");
      expect(system.preset).toMatchObject({ id: "avatar-lite", version: "1.0.0" });
      expect(system.timezone).toBe("Europe/London");
      expect(system.defaultStatus).toBe("not_started");
      expect(session.protocolErrors).toEqual([]);
    } finally {
      await session.close();
    }
  });

  it("writes only JSON-RPC to stdout and exits cleanly when stdin closes", async () => {
    const run = await runRaw(
      [
        INIT,
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: 2, method: "tools/list" },
        { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_system" } },
      ],
      ["--db", tempDbPath()],
    );

    expect(run.stdoutLines.length).toBe(3);
    for (const line of run.stdoutLines) {
      const message = JSON.parse(line) as { jsonrpc: string };
      expect(message.jsonrpc).toBe("2.0");
    }
    expect(run.exitCode).toBe(0);
    expect(run.stderr).toContain('"event":"server_started"');
    expect(run.stderr).toContain('"event":"server_stopped"');
  });

  it("returns a tool error for an unknown tool and stays usable", async () => {
    const session = await connect(["--db", tempDbPath()]);
    try {
      const error = await callError(session, "no_such_tool");
      expect(error.message).toMatch(/not found/i);
      // The server is still usable afterwards.
      await callOk(session, "get_system");
    } finally {
      await session.close();
    }
  });

  it("fails startup with a clear stderr message for an unknown preset", async () => {
    const run = await runRaw([INIT], ["--db", tempDbPath(), "--preset", "not-a-preset"]);
    expect(run.exitCode).toBe(1);
    expect(run.stdoutLines).toEqual([]);
    expect(run.stderr).toContain("Unknown preset");
  });
});
