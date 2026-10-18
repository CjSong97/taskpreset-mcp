import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { tempDbPath, tempDir } from "../support/tmp.js";
import { callError, callOk, connect, runRaw } from "./helpers.js";

interface ItemDto {
  id: string;
  title: string;
  status: string;
  completed_at: string | null;
}

const TITLE = "Private synthetic task title 7f3a";

describe("G2 — durable task capture over a restarted server process", () => {
  it("capture → restart → retrieve → complete twice → restart keeps one stable completion", async () => {
    const db = tempDbPath();
    const capturePayload = { type: "task", title: TITLE, tags: ["fire"], request_id: "cap-1" };

    // Process 1: capture.
    const first = await connect(["--db", db, "--preset", "avatar-lite"]);
    let captured: ItemDto;
    let firstStderr: string;
    try {
      captured = (await callOk(first, "capture_item", capturePayload)).item as ItemDto;
    } finally {
      await first.close();
      firstStderr = first.stderr();
    }

    // Process 2: same path; retrieve, retry capture, complete twice.
    const second = await connect(["--db", db]);
    let completedAt: string | null;
    let secondStderr: string;
    try {
      const fetched = (await callOk(second, "query_items", { id: captured.id })).items as ItemDto[];
      expect(fetched).toEqual([captured]);

      const retried = await callOk(second, "capture_item", capturePayload);
      expect(retried.replayed).toBe(true);
      expect((retried.item as ItemDto).id).toBe(captured.id);

      const done1 = await callOk(second, "complete_item", { id: captured.id });
      expect(done1.already_completed).toBe(false);
      completedAt = (done1.item as ItemDto).completed_at;
      expect(completedAt).not.toBeNull();

      const done2 = await callOk(second, "complete_item", { id: captured.id });
      expect(done2.already_completed).toBe(true);
      expect((done2.item as ItemDto).completed_at).toBe(completedAt);

      const invalid = await callError(second, "capture_item", { type: "task", title: "" });
      expect(invalid.message).toMatch(/title/i);
      expect(second.protocolErrors).toEqual([]);
    } finally {
      await second.close();
      secondStderr = second.stderr();
    }

    // Process 3: the completion and item identity survived another restart.
    const third = await connect(["--db", db]);
    try {
      const all = (await callOk(third, "query_items", {})).items as ItemDto[];
      expect(all).toHaveLength(1);
      expect(all[0]).toMatchObject({ id: captured.id, status: "done", completed_at: completedAt });

      const done3 = await callOk(third, "complete_item", { id: captured.id });
      expect(done3.already_completed).toBe(true);
      expect((done3.item as ItemDto).completed_at).toBe(completedAt);
    } finally {
      await third.close();
    }

    // Diagnostics never echo personal item content.
    expect(firstStderr).not.toContain(TITLE);
    expect(secondStderr).not.toContain(TITLE);
    expect(secondStderr).toContain('"event":"store_opened"');
  });

  it("refuses to reopen a store with a different preset", async () => {
    const db = tempDbPath();
    const first = await connect(["--db", db]);
    await first.close();

    const changed = JSON.parse(
      readFileSync(new URL("../../presets/avatar-lite.json", import.meta.url), "utf8"),
    ) as { version: string };
    changed.version = "2.0.0";
    const presetFile = join(tempDir(), "changed.json");
    writeFileSync(presetFile, JSON.stringify(changed));

    const run = await runRaw([], ["--db", db, "--preset", presetFile]);
    expect(run.exitCode).toBe(1);
    expect(run.stdoutLines).toEqual([]);
    expect(run.stderr).toContain("bound to preset avatar-lite@1.0.0");
  });
});
