import { createHash } from "node:crypto";
import type {
  HeatCell,
  PlanPoint,
  ReportCard,
  ReportColumn,
  ReportModel,
} from "../services/report.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Escape text for HTML text nodes, attribute values and SVG <title>/<text>. */
export function esc(value: string | number): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "2026-10-12" -> "12 Oct". Input is a validated calendar date. */
function short(date: string): string {
  const [, m, d] = date.split("-").map(Number) as [number, number, number];
  return `${d} ${MONTHS[m - 1] ?? "?"}`;
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const STYLE = `
:root{color-scheme:light dark;--bg:#f6f7f9;--panel:#fff;--ink:#1c2128;--muted:#5b6573;--line:#dde1e7;
--accent:#3b6fd4;--done:#2f8f4e;--cancel:#8b94a1;--warn:#c4551d;--chip:#eef1f5;
--h0:#e8ebef;--h1:#b7e1c1;--h2:#74c58a;--h3:#37a35e;--h4:#1b7a41;--p1:#d13b3b;--p2:#e08a2c;--p3:#8b94a1;--p4:#c6ccd5}
@media (prefers-color-scheme:dark){:root{--bg:#12161c;--panel:#1a2029;--ink:#e6eaf0;--muted:#97a1b0;--line:#2c3440;
--accent:#6e9bf0;--done:#4cc27a;--cancel:#7d8794;--warn:#f0894f;--chip:#262e3a;
--h0:#242b35;--h1:#1e4d31;--h2:#2a7a47;--h3:#3aa564;--h4:#5fd68a;--p1:#ef6a6a;--p2:#f0a24f;--p3:#7d8794;--p4:#4a5361}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.5 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
main{max-width:1100px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:1.5rem;margin:0}
h2{font-size:1rem;margin:0 0 12px;letter-spacing:.02em}
.sub{color:var(--muted);margin:2px 0 20px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px}
.tile,.panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.panel{margin-bottom:20px}
.tile b{display:block;font-size:1.8rem;line-height:1.1}
.tile span{color:var(--muted);font-size:.85rem}
.board{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(230px,1fr);gap:12px;overflow-x:auto;padding-bottom:6px}
.col{background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px;min-width:0}
.col h3{display:flex;justify-content:space-between;gap:8px;font-size:.9rem;margin:0 0 8px}
.col.open h3{color:var(--accent)}.col.done h3{color:var(--done)}.col.cancelled h3{color:var(--cancel)}
.n{background:var(--chip);color:var(--muted);border-radius:99px;padding:0 8px;font-weight:600}
.card{background:var(--panel);border:1px solid var(--line);border-left:4px solid var(--p3);border-radius:8px;padding:8px 10px;margin-bottom:8px;overflow-wrap:anywhere}
.card.p1{border-left-color:var(--p1)}.card.p2{border-left-color:var(--p2)}.card.p3{border-left-color:var(--p3)}.card.p4{border-left-color:var(--p4)}
.card.done{opacity:.8}.card.cancelled{opacity:.6;text-decoration:line-through}
.hidden-title{color:var(--muted);letter-spacing:.2em}
.meta{display:flex;flex-wrap:wrap;gap:4px;margin-top:6px;font-size:.75rem;color:var(--muted)}
.chip{background:var(--chip);border-radius:6px;padding:0 6px}
.chip.late{color:var(--warn);font-weight:600}
.more,.empty{color:var(--muted);font-size:.85rem;margin:4px 2px}
svg{display:block;max-width:100%;height:auto}
svg text{fill:var(--muted);font-size:10px;font-family:inherit}
.l0{fill:var(--h0)}.l1{fill:var(--h1)}.l2{fill:var(--h2)}.l3{fill:var(--h3)}.l4{fill:var(--h4)}
.bar{fill:var(--accent)}.tagbar{fill:var(--accent)}.line{fill:none;stroke:var(--done);stroke-width:2}.dot{fill:var(--done)}
.grid{stroke:var(--line);stroke-width:1}
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:20px}
.two{margin-bottom:20px}.two .panel{margin-bottom:0}svg.heat{width:100%;max-width:760px}svg.tags{width:100%;max-width:420px}
footer{color:var(--muted);font-size:.8rem;margin-top:24px}
.caught-up{color:var(--done);font-weight:600;margin:0 0 12px}
`;

function glyph(category: ReportColumn["category"]): string {
  return category === "done" ? "✔" : category === "cancelled" ? "✕" : "○";
}

function card(c: ReportCard, category: ReportColumn["category"]): string {
  const priority = Math.min(4, Math.max(1, Math.trunc(c.priority)));
  const title =
    c.title === null
      ? `<span class="hidden-title" aria-label="title hidden">••••••</span>`
      : esc(c.title);
  const meta = [
    `<span class="chip">${esc(c.typeLabel)}</span>`,
    priority <= 2 ? `<span class="chip">P${priority}</span>` : "",
    c.dueDate === null
      ? ""
      : `<span class="chip${c.overdue ? " late" : ""}">${c.overdue ? "overdue " : "due "}${esc(short(c.dueDate))}</span>`,
    ...c.tags.map((t) => `<span class="chip">#${esc(t)}</span>`),
  ].join("");
  return `<div class="card p${priority} ${category}">${title}<div class="meta">${meta}</div></div>`;
}

function column(col: ReportColumn): string {
  const cards = col.cards.map((c) => card(c, col.category)).join("");
  const more = col.hidden > 0 ? `<p class="more">+ ${col.hidden} more</p>` : "";
  const empty = col.count === 0 ? `<p class="empty">Nothing here.</p>` : "";
  return `<section class="col ${col.category}" aria-label="${esc(col.label)}"><h3><span>${glyph(col.category)} ${esc(col.label)}</span><span class="n">${col.count}</span></h3>${cards}${more}${empty}</section>`;
}

function heatmap(cells: HeatCell[], weeks: number): string {
  const step = 15;
  const left = 30;
  const top = 16;
  const width = left + weeks * step;
  const height = top + 7 * step;
  const labels = [
    [0, "Mon"],
    [2, "Wed"],
    [4, "Fri"],
  ] as const;
  let lastMonth = -1;
  const months = cells
    .filter((c) => c.weekday === 0 || c === cells[0])
    .flatMap((c) => {
      const month = Number(c.date.slice(5, 7));
      if (month === lastMonth) return [];
      lastMonth = month;
      return [`<text x="${left + c.week * step}" y="10">${MONTHS[month - 1] ?? ""}</text>`];
    });
  const rects = cells.map(
    (c) =>
      `<rect class="l${c.level}" x="${left + c.week * step}" y="${top + c.weekday * step}" width="12" height="12" rx="2"><title>${esc(plural(c.count, "completion"))} on ${esc(short(c.date))}</title></rect>`,
  );
  return `<svg class="heat" viewBox="0 0 ${width} ${height}" role="img" aria-label="Completions per day, last ${weeks} weeks">${months.join("")}${labels
    .map(([row, label]) => `<text x="0" y="${top + row * step + 10}">${label}</text>`)
    .join("")}${rects.join("")}</svg>`;
}

function dailyBars(daily: { date: string; count: number }[]): string {
  const step = 20;
  const width = daily.length * step;
  const chartTop = 14;
  const chartHeight = 100;
  const max = Math.max(1, ...daily.map((d) => d.count));
  const bars = daily.map((d, i) => {
    const h = Math.round((d.count / max) * chartHeight);
    const x = i * step + 3;
    const label =
      d.count > 0
        ? `<text x="${x + 7}" y="${chartTop + chartHeight - h - 3}" text-anchor="middle">${d.count}</text>`
        : "";
    return `<rect class="bar" x="${x}" y="${chartTop + chartHeight - h}" width="14" height="${h}" rx="2"><title>${esc(plural(d.count, "completion"))} on ${esc(short(d.date))}</title></rect>${label}`;
  });
  const first = daily[0];
  const last = daily[daily.length - 1];
  const axis =
    first && last
      ? `<text x="0" y="${chartTop + chartHeight + 14}">${esc(short(first.date))}</text><text x="${width}" y="${chartTop + chartHeight + 14}" text-anchor="end">${esc(short(last.date))}</text>`
      : "";
  return `<svg viewBox="0 0 ${width} ${chartTop + chartHeight + 20}" role="img" aria-label="Completions per day, last ${daily.length} days"><line class="grid" x1="0" x2="${width}" y1="${chartTop + chartHeight}" y2="${chartTop + chartHeight}"/>${bars.join("")}${axis}</svg>`;
}

function tagBars(tags: { tag: string; count: number }[], label: string): string {
  if (tags.length === 0)
    return `<p class="empty">No open work has ${esc(label.toLowerCase())} tags.</p>`;
  const max = Math.max(...tags.map((t) => t.count));
  const labelWidth = 110;
  const barMax = 180;
  const rows = tags.map((t, i) => {
    const y = i * 22;
    const w = Math.max(3, Math.round((t.count / max) * barMax));
    const name = t.tag.length > 16 ? `${t.tag.slice(0, 15)}…` : t.tag;
    return `<text x="${labelWidth - 6}" y="${y + 13}" text-anchor="end">${esc(name)}</text><rect class="tagbar" x="${labelWidth}" y="${y + 3}" width="${w}" height="14" rx="2"><title>${esc(t.tag)}: ${esc(plural(t.count, "open item"))}</title></rect><text x="${labelWidth + w + 5}" y="${y + 13}">${t.count}</text>`;
  });
  return `<svg class="tags" viewBox="0 0 ${labelWidth + barMax + 30} ${tags.length * 22}" role="img" aria-label="Open work by ${esc(label)}">${rows.join("")}</svg>`;
}

function planTrend(plans: PlanPoint[], daily: { date: string }[]): string {
  if (plans.length === 0) return `<p class="empty">No day plans saved in this window yet.</p>`;
  const step = 20;
  const width = daily.length * step;
  const top = 10;
  const height = 90;
  const x = (date: string) => daily.findIndex((d) => d.date === date) * step + 10;
  const y = (ratio: number) => top + height - Math.round(ratio * height);
  const points = plans.filter((p) => p.ratio !== null && x(p.date) >= 0);
  const path = points.map((p) => `${x(p.date)},${y(p.ratio ?? 0)}`).join(" ");
  const dots = points.map(
    (p) =>
      `<circle class="dot" cx="${x(p.date)}" cy="${y(p.ratio ?? 0)}" r="4"><title>${esc(short(p.date))}: ${p.completed} of ${p.planned} planned items completed</title></circle>`,
  );
  const first = daily[0];
  const last = daily[daily.length - 1];
  return `<svg viewBox="0 0 ${width} ${top + height + 20}" role="img" aria-label="Share of each day's plan completed"><line class="grid" x1="0" x2="${width}" y1="${top}" y2="${top}"/><line class="grid" x1="0" x2="${width}" y1="${top + height}" y2="${top + height}"/><text x="0" y="${top - 1}">100%</text>${points.length > 1 ? `<polyline class="line" points="${path}"/>` : ""}${dots.join("")}${first && last ? `<text x="0" y="${top + height + 14}">${esc(short(first.date))}</text><text x="${width}" y="${top + height + 14}" text-anchor="end">${esc(short(last.date))}</text>` : ""}</svg>`;
}

function tile(value: string, label: string): string {
  return `<div class="tile"><b>${esc(value)}</b><span>${esc(label)}</span></div>`;
}

/**
 * Render the report as one self-contained HTML document: inline CSS and SVG only, no script, no
 * external resources, and a CSP that forbids everything except the one hashed style block. Every
 * interpolated string is escaped; classes are chosen from fixed vocabularies, never from data.
 */
export function renderReport(model: ReportModel): string {
  const { totals, todayPlan } = model;
  const planTile =
    todayPlan === null
      ? tile("—", "no plan saved for today")
      : tile(`${todayPlan.completed}/${todayPlan.planned}`, "of today's plan done");
  const caughtUp =
    totals.openWork === 0 && totals.items > 0
      ? `<p class="caught-up">✨ All caught up — no open work.</p>`
      : "";
  const body = `<main>
<h1>${esc(model.presetName)} report</h1>
<p class="sub">As of ${esc(model.today)} (${esc(model.timezone)})</p>
<div class="tiles">${tile(String(totals.completed7), "completed, last 7 days")}${tile(String(totals.completed30), "completed, last 30 days")}${tile(String(totals.openWork), "open work now")}${planTile}</div>
${caughtUp}<div class="panel"><h2>Board <span class="n">${esc(model.boardTypes.join(", "))}</span></h2><div class="board">${model.columns.map(column).join("")}</div></div>
<div class="panel"><h2>Completions, last ${model.heatmap.weeks} weeks · ${esc(plural(model.heatmap.total, "completion"))}</h2>${heatmap(model.heatmap.cells, model.heatmap.weeks)}</div>
<div class="two"><div class="panel"><h2>Completions per day</h2>${dailyBars(model.daily)}</div><div class="panel"><h2>Plan completion per day</h2>${planTrend(model.plans, model.daily)}</div></div>
<div class="panel"><h2>Open work by ${esc(model.tagLabel.toLowerCase())}</h2>${tagBars(model.tags, model.tagLabel)}</div>
<footer>Generated by Waypoint from a local store, offline.${model.titlesShown ? " This file contains your item titles — treat it as personal data." : " Item titles are hidden."}</footer>
</main>`;
  const hash = createHash("sha256").update(STYLE).digest("base64");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'sha256-${hash}'">
<title>${esc(model.presetName)} report</title>
<style>${STYLE}</style></head><body>${body}</body></html>
`;
}
