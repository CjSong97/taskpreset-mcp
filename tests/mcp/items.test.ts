import { describe, expect, it } from "vitest";
import { tempDbPath } from "../support/tmp.js";
import { callError, callOk, connect } from "./helpers.js";

describe("capture_item and query_items over MCP", () => {
  it("captures and queries items", async () => {
    const session = await connect(["--db", tempDbPath()]);
    try {
      const { tools } = await session.client.listTools();
      const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
      expect(byName.capture_item?.annotations?.readOnlyHint).toBe(false);
      expect(byName.query_items?.annotations?.readOnlyHint).toBe(true);

      const captured = await callOk(session, "capture_item", {
        type: "task",
        title: "Draft plan",
        tags: ["fire"],
        due_date: "2026-10-20",
        request_id: "r1",
      });
      const item = captured.item as { id: string; status: string };
      expect(captured.replayed).toBe(false);
      expect(item.status).toBe("not_started");

      const replay = await callOk(session, "capture_item", {
        type: "task",
        title: "Draft plan",
        tags: ["fire"],
        due_date: "2026-10-20",
        request_id: "r1",
      });
      expect(replay.replayed).toBe(true);
      expect((replay.item as { id: string }).id).toBe(item.id);

      const conflict = await callError(session, "capture_item", {
        type: "task",
        title: "Something else",
        request_id: "r1",
      });
      expect(conflict.code).toBe("conflict");

      const listed = await callOk(session, "query_items", { tag: "fire" });
      expect((listed.items as { id: string }[]).map((i) => i.id)).toEqual([item.id]);
      expect(listed.next_cursor).toBeNull();
      expect(session.protocolErrors).toEqual([]);
    } finally {
      await session.close();
    }
  });

  it("rejects invalid input and unknown ids with clear errors", async () => {
    const session = await connect(["--db", tempDbPath()]);
    try {
      const missingTitle = await callError(session, "capture_item", { type: "task" });
      expect(missingTitle.message).toMatch(/title/);

      const badType = await callError(session, "capture_item", { type: "epic", title: "X" });
      expect(badType.code).toBe("validation");

      const badPriority = await callError(session, "capture_item", {
        type: "task",
        title: "X",
        priority: 9,
      });
      expect(badPriority.message).toMatch(/priority/);

      const unknown = await callError(session, "query_items", {
        id: "00000000-0000-4000-8000-000000000000",
      });
      expect(unknown.code).toBe("not_found");

      const listed = await callOk(session, "query_items", {});
      expect(listed.items).toEqual([]);
    } finally {
      await session.close();
    }
  });
});
