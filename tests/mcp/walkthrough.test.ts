import { describe, expect, it } from "vitest";
import { tempDbPath } from "../support/tmp.js";
import { callOk, connect } from "./helpers.js";

/**
 * Automated twin of the walkthrough in docs/dogfooding.md. It drives the same tool calls and
 * asserts the visible outputs that the document tells a human to expect.
 */
describe("documented walkthrough", () => {
  it("capture → plan → complete → measure, with the documented outputs", async () => {
    const db = tempDbPath();
    const session = await connect(["--db", db, "--preset", "avatar-lite"]);
    try {
      // Step 1 — get_system
      const system = await callOk(session, "get_system");
      expect(system.preset).toMatchObject({ id: "avatar-lite", name: "Avatar-lite" });
      expect(system.timezone).toBe("Europe/London");
      expect(system.tagLabel).toBe("Element");

      // Step 2 — capture a project and three tasks
      const project = (
        (
          await callOk(session, "capture_item", {
            type: "project",
            title: "Waypoint trial",
            request_id: "walkthrough-project",
          })
        ).item as { id: string }
      ).id;
      const task = async (title: string, extra: Record<string, unknown>) =>
        (
          await callOk(session, "capture_item", {
            type: "task",
            title,
            parent_id: project,
            ...extra,
          })
        ).item as { id: string; status: string };
      const write = await task("Write the trial notes", { priority: 1, tags: ["Fire"] });
      const review = await task("Review yesterday's plan", { priority: 2 });
      const tidy = await task("Tidy the inbox", { priority: 3, due_date: "2026-12-31" });
      expect(write.status).toBe("not_started");

      // Step 3 — restart the client/server and retrieve the tasks
      await session.close();
      const again = await connect(["--db", db]);
      try {
        const listed = await callOk(again, "query_items", {
          parent_id: project,
          status_category: "open",
        });
        expect((listed.items as { id: string }[]).map((i) => i.id)).toEqual([
          write.id,
          review.id,
          tidy.id,
        ]);

        // Step 4 — preview, then commit the plan
        const preview = await callOk(again, "plan_day", { max_items: 3 });
        expect(preview.mode).toBe("preview");
        expect((preview.candidates as { id: string }[]).map((i) => i.id)).toEqual([
          write.id,
          review.id,
          tidy.id,
        ]);
        expect(preview.existing_plan).toBeNull();
        const saved = await callOk(again, "plan_day", {
          commit: true,
          item_ids: [write.id, review.id, tidy.id],
        });
        expect((saved.plan as { revision: number }).revision).toBe(1);

        // Step 5 — complete one task (twice, to see idempotency)
        const first = await callOk(again, "complete_item", { id: write.id });
        const second = await callOk(again, "complete_item", { id: write.id });
        expect(first.already_completed).toBe(false);
        expect(second.already_completed).toBe(true);
        expect((second.item as { completed_at: string }).completed_at).toBe(
          (first.item as { completed_at: string }).completed_at,
        );

        // Step 6 — read the plan and metrics
        const plan = (await callOk(again, "get_day_plan")).plan as {
          revision: number;
          items: { position: number; item: { status: string } }[];
        };
        expect(plan.items.map((m) => [m.position, m.item.status])).toEqual([
          [1, "done"],
          [2, "not_started"],
          [3, "not_started"],
        ]);
        const metrics = await callOk(again, "get_metrics");
        expect(metrics).toMatchObject({ completed_count: 1, current_open_count: 2 });
        expect(metrics.daily_plans).toEqual([
          expect.objectContaining({
            planned_count: 3,
            completed_planned_count: 1,
            plan_completion_ratio: 1 / 3,
          }),
        ]);
      } finally {
        await again.close();
      }
    } finally {
      await session.close().catch(() => undefined);
    }
  });
});
