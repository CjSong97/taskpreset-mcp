import { describe, expect, it } from "vitest";
import { WORKFLOWS } from "../fixtures/workflows.js";
import { expectTaskPresetError, testApp } from "../support/app.js";

describe.each(WORKFLOWS)("workflow: $preset", (w) => {
  it("binds a separate store to the preset", () => {
    const app = testApp({ preset: w.preset });
    const system = app.describeSystem();
    expect(system.preset.id).toBe(w.preset);
    expect(system.defaultStatus).toBe(w.defaultStatus);
  });

  it("captures nested work, queries it and completes it", () => {
    const app = testApp({ preset: w.preset });
    const container = app.items.capture({ type: w.container, title: "Container" }).item;
    const work = app.items.capture({
      type: w.work,
      title: "Work",
      parentId: container.id,
      tags: [w.tag],
    }).item;
    expect(work.status).toBe(w.defaultStatus);

    expect(app.items.query({ tag: w.tag }).items.map((i) => i.id)).toEqual([work.id]);
    expect(app.items.query({ parentId: container.id }).items.map((i) => i.id)).toEqual([work.id]);

    const done = app.items.complete(work.id).item;
    expect(done.status).toBe(w.done);
    expect(app.items.query({ statusCategory: "done" }).items.map((i) => i.id)).toEqual([work.id]);
    expect(app.items.query({ statusCategory: "open" }).items.map((i) => i.id)).toEqual([
      container.id,
    ]);
  });

  it("rejects types, statuses and parents the preset does not define", () => {
    const app = testApp({ preset: w.preset });
    const work = app.items.capture({ type: w.work, title: "Work" }).item;
    expectTaskPresetError(
      () => app.items.capture({ type: "nonexistent", title: "X" }),
      "validation",
    );
    expectTaskPresetError(
      () => app.items.capture({ type: w.work, title: "X", status: w.done }),
      "validation",
    );
    expectTaskPresetError(
      () => app.items.capture({ type: w.invalidChildOfWork, title: "X", parentId: work.id }),
      "validation",
    );
  });
});

describe.each(WORKFLOWS)("workflow transitions: $preset", (w) => {
  it("moves work through permitted statuses, cancels it and never uncancels it", () => {
    const app = testApp({ preset: w.preset });
    const work = app.items.capture({ type: w.work, title: "Work", status: w.move.from }).item;
    expect(app.items.update({ id: work.id, status: w.move.to }).status).toBe(w.move.to);
    expect(app.items.update({ id: work.id, status: w.cancelled }).status).toBe(w.cancelled);
    expectTaskPresetError(
      () => app.items.update({ id: work.id, status: w.defaultStatus }),
      "invalid_transition",
    );
    expectTaskPresetError(() => app.items.complete(work.id), "invalid_transition");
  });

  it("routes done only through complete_item", () => {
    const app = testApp({ preset: w.preset });
    const work = app.items.capture({ type: w.work, title: "Work" }).item;
    expectTaskPresetError(
      () => app.items.update({ id: work.id, status: w.done }),
      "invalid_transition",
    );
    app.items.complete(work.id);
    expectTaskPresetError(
      () => app.items.update({ id: work.id, status: w.defaultStatus }),
      "invalid_transition",
    );
  });
});

describe("preset isolation", () => {
  it("keeps each preset's statuses to its own store", () => {
    const [avatar, gtd] = WORKFLOWS;
    if (!avatar || !gtd) throw new Error("fixtures missing");
    const a = testApp({ preset: avatar.preset });
    const g = testApp({ preset: gtd.preset });
    expectTaskPresetError(
      () => a.items.capture({ type: avatar.work, title: "X", status: gtd.defaultStatus }),
      "validation",
    );
    expectTaskPresetError(
      () => g.items.capture({ type: gtd.work, title: "X", status: avatar.defaultStatus }),
      "validation",
    );
  });
});
