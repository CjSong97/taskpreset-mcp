import { describe, expect, it } from "vitest";
import { tempDbPath } from "../support/tmp.js";
import { callError, callOk, connect } from "./helpers.js";

interface PlanDto {
  revision: number;
  items: { position: number; item: { id: string; status: string } }[];
}

async function captureTasks(session: Awaited<ReturnType<typeof connect>>, n: number) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = await callOk(session, "capture_item", { type: "task", title: `T${i}` });
    ids.push((r.item as { id: string }).id);
  }
  return ids;
}

describe("plan_day and get_day_plan over MCP", () => {
  it("previews without saving, commits explicitly and survives a restart", async () => {
    const db = tempDbPath();
    const first = await connect(["--db", db]);
    let ids: string[];
    try {
      ids = await captureTasks(first, 3);

      const preview = await callOk(first, "plan_day", { max_items: 2 });
      expect(preview.mode).toBe("preview");
      expect((preview.candidates as unknown[]).length).toBe(2);
      expect(preview.existing_plan).toBeNull();
      expect((await callOk(first, "get_day_plan")).plan).toBeNull();

      const notCommitted = await callError(first, "plan_day", { item_ids: ids });
      expect(notCommitted.code).toBe("validation");
      expect((await callOk(first, "get_day_plan")).plan).toBeNull();

      const saved = await callOk(first, "plan_day", {
        commit: true,
        item_ids: [ids[2], ids[0]],
      });
      expect(saved.mode).toBe("committed");
      expect((saved.plan as PlanDto).revision).toBe(1);
    } finally {
      await first.close();
    }

    const second = await connect(["--db", db]);
    try {
      const read = await callOk(second, "get_day_plan");
      const plan = read.plan as PlanDto;
      expect(plan.revision).toBe(1);
      expect(plan.items.map((m) => [m.position, m.item.id])).toEqual([
        [1, ids[2]],
        [2, ids[0]],
      ]);
      expect(plan.items.every((m) => m.item.status === "not_started")).toBe(true);

      const preview = await callOk(second, "plan_day", {});
      expect(preview.existing_plan).toEqual({ revision: 1, item_ids: [ids[2], ids[0]] });
    } finally {
      await second.close();
    }
  });
});
