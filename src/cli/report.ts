import { existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, normalize } from "node:path";
import { pathToFileURL } from "node:url";
import { WaypointError } from "../domain/errors.js";
import { isValidDateOnly, systemClock, type Clock } from "../domain/time.js";
import { MetricsService } from "../services/metrics.js";
import { buildReport, endOfLocalDay } from "../services/report.js";
import { SqliteItemRepository } from "../storage/items.js";
import { SqlitePlanRepository } from "../storage/plans.js";
import { openReadonlyStore, SqliteReportReader } from "../storage/report.js";
import { renderReport } from "./report-html.js";

export interface ReportCommandOptions {
  source: string;
  out: string | undefined;
  /** Pin "today" to this local date (YYYY-MM-DD) for reproducible output. */
  asOf: string | undefined;
  includeTitles: boolean;
}

/**
 * Write a self-contained HTML report (kanban board, heatmap, charts) of a store. Opens the store
 * read-only, never overwrites a file and prints counts only — never item content.
 */
export function writeReport(options: ReportCommandOptions): string[] {
  const { source } = options;
  if (options.out === undefined || !isAbsolute(options.out)) {
    throw new WaypointError("config", "report requires --out with an absolute file path.");
  }
  const out = normalize(options.out);
  if (!out.toLowerCase().endsWith(".html")) {
    throw new WaypointError("config", "--out must be an .html file.");
  }
  if (existsSync(out)) {
    throw new WaypointError("config", `${out} already exists; reports never overwrite files.`);
  }
  if (options.asOf !== undefined && !isValidDateOnly(options.asOf)) {
    throw new WaypointError("config", "--as-of must be a real calendar date as YYYY-MM-DD.");
  }
  if (!existsSync(source) || statSync(source).size === 0) {
    throw new WaypointError("config", `No store at ${source}.`);
  }

  const store = openReadonlyStore(source);
  try {
    const clock: Clock =
      options.asOf === undefined
        ? systemClock
        : { now: () => endOfLocalDay(options.asOf as string, store.timezone) };
    const items = new SqliteItemRepository(store.db);
    const plans = new SqlitePlanRepository(store.db);
    const model = buildReport(
      {
        preset: store.preset,
        timezone: store.timezone,
        reader: new SqliteReportReader(store.db),
        metrics: new MetricsService({
          preset: store.preset,
          timezone: store.timezone,
          items,
          plans,
          tx: store,
          clock,
        }),
        tx: store,
        clock,
      },
      { includeTitles: options.includeTitles },
    );
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, renderReport(model), { flag: "wx" });
    return [
      `Report written to ${out}`,
      `  open:      ${pathToFileURL(out).href}`,
      `  as of:     ${model.today} (${model.timezone})`,
      `  contents:  ${model.totals.items} items, ${model.totals.completed30} completed in the last 30 days`,
      `  titles:    ${model.titlesShown ? "included — the file is personal data" : "hidden"}`,
    ];
  } finally {
    store.close();
  }
}
