import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { describe, expect, it } from "vitest";
import { tempDbPath } from "../support/tmp.js";
import { callOk, connect, type Session } from "./helpers.js";

function commit(session: Session, args: Record<string, unknown>) {
  return session.client.callTool({
    name: "plan_day",
    arguments: { commit: true, ...args },
  }) as Promise<CallToolResult>;
}

function errorCode(result: CallToolResult): string | undefined {
  if (!result.isError) return undefined;
  const first = result.content[0];
  return first?.type === "text"
    ? (JSON.parse(first.text) as { error: { code: string } }).error.code
    : undefined;
}

describe("two clients sharing one store", () => {
  it("lets exactly one of two concurrent same-revision updates win", async () => {
    const db = tempDbPath();
    const alice = await connect(["--db", db]);
    const bob = await connect(["--db", db]);
    try {
      const ids: string[] = [];
      for (const title of ["A", "B", "C"]) {
        const r = await callOk(alice, "capture_item", { type: "task", title });
        ids.push((r.item as { id: string }).id);
      }

      // Both try to create the first plan at once.
      const created = await Promise.all([
        commit(alice, { item_ids: [ids[0]] }),
        commit(bob, { item_ids: [ids[1]] }),
      ]);
      expect(created.filter((r) => !r.isError)).toHaveLength(1);
      expect(created.map(errorCode).filter(Boolean)).toEqual(["conflict"]);

      // Both read revision 1 and try to replace it at once.
      const read = await callOk(bob, "get_day_plan");
      expect((read.plan as { revision: number }).revision).toBe(1);
      const updates = await Promise.all([
        commit(alice, { item_ids: [ids[2]], expected_revision: 1 }),
        commit(bob, { item_ids: [ids[0], ids[1]], expected_revision: 1 }),
      ]);
      expect(updates.filter((r) => !r.isError)).toHaveLength(1);
      expect(updates.map(errorCode).filter(Boolean)).toEqual(["conflict"]);

      const winner = updates.find((r) => !r.isError)?.structuredContent as {
        plan: { items: { item: { id: string } }[] };
      };
      const final = (await callOk(alice, "get_day_plan")).plan as {
        revision: number;
        items: { item: { id: string } }[];
      };
      expect(final.revision).toBe(2);
      expect(final.items.map((m) => m.item.id)).toEqual(winner.plan.items.map((m) => m.item.id));
    } finally {
      await alice.close();
      await bob.close();
    }
  });
});
