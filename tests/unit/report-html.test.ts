import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { esc, renderReport } from "../../src/cli/report-html.js";
import type { HeatCell, ReportModel } from "../../src/services/report.js";

const HOSTILE = `<img src=x onerror=alert(1)>"><script>alert('x')</script>&`;

function model(overrides: Partial<ReportModel> = {}): ReportModel {
  const cells: HeatCell[] = Array.from({ length: 10 }, (_, i): HeatCell => ({
    date: `2026-10-${String(i + 1).padStart(2, "0")}`,
    count: i % 3,
    level: i % 3 === 0 ? 0 : 2,
    week: Math.floor(i / 7),
    weekday: i % 7,
  }));
  return {
    presetName: HOSTILE,
    boardTypes: [HOSTILE],
    tagLabel: HOSTILE,
    timezone: "Europe/London",
    today: "2026-10-10",
    generatedAt: "2026-10-10T12:00:00.000Z",
    titlesShown: true,
    totals: { items: 3, openWork: 2, completed7: 1, completed30: 2 },
    todayPlan: { date: "2026-10-10", planned: 2, completed: 1, ratio: 0.5 },
    columns: [
      {
        status: "open",
        label: HOSTILE,
        category: "open",
        count: 1,
        hidden: 0,
        cards: [
          {
            title: HOSTILE,
            typeLabel: HOSTILE,
            priority: 1,
            dueDate: "2026-10-01",
            overdue: true,
            tags: [HOSTILE],
          },
        ],
      },
      { status: "done", label: "Done", category: "done", count: 0, hidden: 0, cards: [] },
    ],
    daily: cells.map((c) => ({ date: c.date, count: c.count })),
    heatmap: { cells, weeks: 2, peak: 2, total: 5 },
    tags: [{ tag: HOSTILE, count: 2 }],
    plans: [{ date: "2026-10-09", planned: 2, completed: 1, ratio: 0.5 }],
    ...overrides,
  };
}

describe("renderReport", () => {
  it("escapes every user-controlled string", () => {
    expect(esc(HOSTILE)).toBe(
      "&lt;img src=x onerror=alert(1)&gt;&quot;&gt;&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;&amp;",
    );
    const html = renderReport(model());
    expect(html).not.toContain("<img");
    expect(html).not.toContain("<script");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });

  it("is self-contained: no scripts, no external resources, no inline style attributes", () => {
    const html = renderReport(model({ presetName: "Plain" }));
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toMatch(/https?:\/\//);
    expect(html).not.toMatch(/\sstyle=/i);
    expect(html).not.toMatch(/<(link|img|iframe|object)\b/i);
  });

  it("pins a CSP that allows only the one hashed style block", () => {
    const html = renderReport(model());
    const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
    const hash = createHash("sha256").update(style).digest("base64");
    expect(html).toContain(`content="default-src 'none'; style-src 'sha256-${hash}'"`);
  });

  it("renders one column per status and one heatmap cell per day", () => {
    const html = renderReport(model());
    expect(html.match(/<section class="col /g)).toHaveLength(2);
    expect(html.match(/<rect class="l\d"/g)).toHaveLength(10);
  });

  it("hides titles but keeps structure when titles are withheld", () => {
    const html = renderReport(
      model({
        presetName: "Plain",
        titlesShown: false,
        boardTypes: ["Task"],
        tagLabel: "Tag",
        tags: [],
        columns: [
          {
            status: "open",
            label: "Open",
            category: "open",
            count: 1,
            hidden: 0,
            cards: [
              {
                title: null,
                typeLabel: "Task",
                priority: 3,
                dueDate: null,
                overdue: false,
                tags: [],
              },
            ],
          },
        ],
      }),
    );
    expect(html).toContain("title hidden");
    expect(html).toContain("Item titles are hidden.");
  });

  it("shows an all-caught-up state when no work is open", () => {
    const html = renderReport(
      model({
        presetName: "Plain",
        totals: { items: 4, openWork: 0, completed7: 0, completed30: 0 },
      }),
    );
    expect(html).toContain("All caught up");
  });

  it("renders gracefully with no plans and no tags", () => {
    const html = renderReport(model({ presetName: "Plain", plans: [], tags: [], todayPlan: null }));
    expect(html).toContain("No day plans saved");
    expect(html).toContain("no plan saved for today");
  });
});
