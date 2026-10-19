import { statusesIn } from "../domain/item.js";
import type { Preset, StatusCategory } from "../domain/preset.js";
import { addDays, localDate, startOfLocalDay, type Clock } from "../domain/time.js";
import type { Metrics } from "./metrics.js";
import type { ReportReader, UnitOfWork } from "./ports.js";

export const REPORT_DEFAULTS = {
  days: 30,
  weeks: 26,
  cardsPerColumn: 30,
  closedCards: 8,
  topTags: 8,
} as const;

export interface ReportCard {
  /** null when titles are withheld (--no-titles); tags are still shown. */
  title: string | null;
  typeLabel: string;
  priority: number;
  dueDate: string | null;
  overdue: boolean;
  tags: string[];
}

export interface ReportColumn {
  status: string;
  label: string;
  category: StatusCategory;
  count: number;
  cards: ReportCard[];
  /** Items in the column beyond the cards shown. */
  hidden: number;
}

export interface HeatCell {
  date: string;
  count: number;
  /** 0 = no completions, 1-4 = quartile of the busiest day in the window. */
  level: 0 | 1 | 2 | 3 | 4;
  /** Column (week) index, 0 = oldest; weeks start on Monday. */
  week: number;
  /** Row, 0 = Monday. */
  weekday: number;
}

export interface PlanPoint {
  date: string;
  planned: number;
  completed: number;
  ratio: number | null;
}

export interface ReportModel {
  presetName: string;
  /** Labels of the item types shown on the board (executable work). */
  boardTypes: string[];
  tagLabel: string;
  timezone: string;
  /** The local date the report is "as of". */
  today: string;
  generatedAt: string;
  titlesShown: boolean;
  totals: { items: number; openWork: number; completed7: number; completed30: number };
  todayPlan: PlanPoint | null;
  columns: ReportColumn[];
  daily: { date: string; count: number }[];
  heatmap: { cells: HeatCell[]; weeks: number; peak: number; total: number };
  tags: { tag: string; count: number }[];
  plans: PlanPoint[];
}

export interface ReportDeps {
  preset: Preset;
  timezone: string;
  reader: ReportReader;
  metrics: { get(input: { from?: string; to?: string }): Metrics };
  tx: UnitOfWork;
  clock: Clock;
}

export interface ReportOptions {
  includeTitles: boolean;
  days?: number;
  weeks?: number;
  cardsPerColumn?: number;
}

/**
 * Board column order. A stored preset snapshot is key-sorted, so declaration order is gone:
 * open statuses start with the initial statuses (in their listed order), then the remaining open
 * ones alphabetically, followed by done and cancelled.
 */
export function boardStatuses(preset: Preset): string[] {
  const open = statusesIn(preset, "open");
  const initial = preset.initialStatuses.filter((s) => open.includes(s));
  const rest = open.filter((s) => !initial.includes(s)).sort();
  return [...initial, ...rest, ...statusesIn(preset, "done"), ...statusesIn(preset, "cancelled")];
}

/** 0 = Monday. */
function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
}

function level(count: number, peak: number): HeatCell["level"] {
  if (count === 0 || peak === 0) return 0;
  return Math.min(4, Math.max(1, Math.ceil((count / peak) * 4))) as HeatCell["level"];
}

/**
 * Assemble everything the static report shows from read-only queries. Pure data: no HTML, no
 * I/O beyond the injected reader, and "today" comes from the injected clock.
 */
export function buildReport(deps: ReportDeps, options: ReportOptions): ReportModel {
  const { preset, timezone, reader, metrics, tx, clock } = deps;
  const days = options.days ?? REPORT_DEFAULTS.days;
  const weeks = options.weeks ?? REPORT_DEFAULTS.weeks;
  const perColumn = options.cardsPerColumn ?? REPORT_DEFAULTS.cardsPerColumn;
  const now = clock.now();
  const today = localDate(now, timezone);

  const thisMonday = addDays(today, -weekday(today));
  const heatStart = addDays(thisMonday, -7 * (weeks - 1));
  const executable = Object.entries(preset.itemTypes)
    .filter(([, t]) => t.executable)
    .map(([id]) => id);
  const open = statusesIn(preset, "open");

  return tx.read(() => {
    const range = metrics.get({ from: heatStart, to: today });
    const counts = reader.statusCounts(executable);

    const byDay = new Map<string, number>();
    for (const iso of reader.completedAt(executable, range.startUtc, range.endUtc)) {
      const day = localDate(new Date(iso), timezone);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    const countOn = (date: string) => byDay.get(date) ?? 0;

    const cells: HeatCell[] = [];
    let peak = 0;
    let total = 0;
    for (let date = heatStart; date <= today; date = addDays(date, 1)) {
      const count = countOn(date);
      peak = Math.max(peak, count);
      total += count;
      cells.push({ date, count, level: 0, week: 0, weekday: weekday(date) });
    }
    cells.forEach((cell, index) => {
      cell.level = level(cell.count, peak);
      cell.week = Math.floor((index + weekday(heatStart)) / 7);
    });

    const daily = Array.from({ length: days }, (_, i) => {
      const date = addDays(today, i - (days - 1));
      return { date, count: countOn(date) };
    });
    const sum = (n: number) => daily.slice(-n).reduce((acc, d) => acc + d.count, 0);

    const toPoint = (p: Metrics["dailyPlans"][number]): PlanPoint => ({
      date: p.date,
      planned: p.plannedCount,
      completed: p.completedPlannedCount,
      ratio: p.planCompletionRatio,
    });
    const windowStart = daily[0]?.date ?? today;
    const plans = range.dailyPlans.filter((p) => p.date >= windowStart).map(toPoint);
    const todayPlan = range.dailyPlans.find((p) => p.date === today);

    const columns: ReportColumn[] = boardStatuses(preset).map((status) => {
      const def = preset.statuses[status] as Preset["statuses"][string];
      const count = counts[status] ?? 0;
      const items = reader.cards(
        status,
        executable,
        def.category === "open" ? "work" : "recent",
        def.category === "open" ? perColumn : Math.min(perColumn, REPORT_DEFAULTS.closedCards),
      );
      return {
        status,
        label: def.label,
        category: def.category,
        count,
        hidden: Math.max(0, count - items.length),
        cards: items.map((item) => ({
          title: options.includeTitles ? item.title : null,
          typeLabel: preset.itemTypes[item.type]?.label ?? item.type,
          priority: item.priority,
          dueDate: item.dueDate,
          overdue: def.category === "open" && item.dueDate !== null && item.dueDate < today,
          tags: item.tags,
        })),
      };
    });

    return {
      presetName: preset.name,
      boardTypes: executable.map((id) => preset.itemTypes[id]?.label ?? id),
      tagLabel: preset.tagLabel,
      timezone,
      today,
      generatedAt: now.toISOString(),
      titlesShown: options.includeTitles,
      totals: {
        items: Object.values(counts).reduce((a, b) => a + b, 0),
        openWork: range.currentOpenCount,
        completed7: sum(7),
        completed30: sum(30),
      },
      todayPlan: todayPlan ? toPoint(todayPlan) : null,
      columns,
      daily,
      heatmap: { cells, weeks, peak, total },
      tags: reader.tagCounts(open, executable).slice(0, REPORT_DEFAULTS.topTags),
      plans,
    };
  });
}

/** The instant just before local midnight ends `date`; used to pin a deterministic "as of". */
export function endOfLocalDay(date: string, timezone: string): Date {
  return new Date(startOfLocalDay(addDays(date, 1), timezone).getTime() - 1);
}
