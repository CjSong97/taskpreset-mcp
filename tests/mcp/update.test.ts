import { describe, expect, it } from "vitest";
import { tempDbPath } from "../support/tmp.js";
import { callError, callOk, connect } from "./helpers.js";

describe("update_item over MCP", () => {
  it("edits items and refuses to bypass complete_item", async () => {
    const session = await connect(["--db", tempDbPath()]);
    try {
      const { item } = (await callOk(session, "capture_item", { type: "task", title: "T" })) as {
        item: { id: string };
      };

      const updated = await callOk(session, "update_item", {
        id: item.id,
        status: "in_progress",
        due_date: "2026-11-01",
      });
      expect(updated.item).toMatchObject({ status: "in_progress", due_date: "2026-11-01" });

      const toDone = await callError(session, "update_item", { id: item.id, status: "done" });
      expect(toDone.code).toBe("invalid_transition");

      const stamp = await callError(session, "update_item", {
        id: item.id,
        completed_at: "2026-10-18T00:00:00.000Z",
      });
      expect(stamp.message).toMatch(/completed_at|Unrecognized/);

      const typeChange = await callError(session, "update_item", { id: item.id, type: "goal" });
      expect(typeChange.message).toMatch(/Unrecognized/);

      const unknownCaptureField = await callError(session, "capture_item", {
        type: "task",
        title: "X",
        completed_at: "2026-10-18T00:00:00.000Z",
      });
      expect(unknownCaptureField.message).toMatch(/Unrecognized/);

      const after = await callOk(session, "query_items", { id: item.id });
      expect((after.items as { completed_at: string | null }[])[0]?.completed_at).toBeNull();
    } finally {
      await session.close();
    }
  });
});
