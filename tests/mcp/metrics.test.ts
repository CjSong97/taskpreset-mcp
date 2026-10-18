import { describe, expect, it } from "vitest";
import { tempDbPath } from "../support/tmp.js";
import { callOk, connect } from "./helpers.js";

describe("get_metrics over MCP", () => {
  it("returns metrics with interval, timezone and definitions", async () => {
    const session = await connect(["--db", tempDbPath()]);
    try {
      const a = (await callOk(session, "capture_item", { type: "task", title: "A" })).item as {
        id: string;
      };
      await callOk(session, "capture_item", { type: "task", title: "B" });
      await callOk(session, "plan_day", { commit: true, item_ids: [a.id] });
      await callOk(session, "complete_item", { id: a.id });
      await callOk(session, "complete_item", { id: a.id });

      const metrics = await callOk(session, "get_metrics");
      expect(metrics).toMatchObject({
        timezone: "Europe/London",
        completed_count: 1,
        current_open_count: 1,
      });
      expect(metrics.daily_plans).toEqual([
        expect.objectContaining({
          revision: 1,
          planned_count: 1,
          completed_planned_count: 1,
          plan_completion_ratio: 1,
        }),
      ]);
      expect(Object.keys(metrics.definitions as object)).toContain("current_open_count");

      const { tools } = await session.client.listTools();
      expect(tools.find((t) => t.name === "get_metrics")?.annotations?.readOnlyHint).toBe(true);
    } finally {
      await session.close();
    }
  });
});
