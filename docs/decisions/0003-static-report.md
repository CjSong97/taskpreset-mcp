# 0003 — Static HTML report and demo store

Date: 2026-10-19 · Status: accepted

## Context

The MVP has no way to look at your work except through an AI client. Showing the data (a board,
completion charts) helps day-to-day use, makes the project demonstrable and does not need a
model. `docs/product.md` listed "no frontend" and "no network listener" as non-goals.

## Decision

- Add `report`: writes **one self-contained, read-only HTML file** (inline CSS and SVG). It is a
  generated artefact, not an application: no server, no listener, no script, no external
  resource. A CSP (`default-src 'none'`, one hashed `<style>`) is embedded and a test asserts the
  output has no `<script>`, URL or inline `style=` attribute.
- The "no frontend" non-goal is narrowed to "no interactive frontend". `report` is allowed;
  anything that serves pages, accepts input or writes to the store is still out of scope.
- **Read-only.** `openReadonlyStore` opens with `readonly: true, fileMustExist: true`, never
  creates, migrates or changes the journal mode, and refuses stores whose schema is not the
  build's. It works while a server holds the store open. A test asserts the file hash is
  unchanged.
- **Layering.** `src/storage/report.ts` (queries) → `src/services/report.ts` (pure model builder,
  injected `Clock`, no MCP, no HTML) → `src/cli/report-html.ts` (renderer) → `src/cli/report.ts`
  (command). The engine stays preset-agnostic: columns come from the stored preset's statuses.
- **Board shows executable work only** (tasks/actions); containers such as projects are not cards.
  Columns follow the workflow: initial statuses in listed order, other open statuses
  alphabetically, then done, then cancelled (stored presets are key-sorted, so declaration order is
  unavailable).
- **Metrics integrity.** Completions are bucketed by the store's local day (`localDate`), never
  by UTC or 24-hour assumptions. The heatmap total is checked against `MetricsService`.
- **No gamification.** Counts only: no XP, streaks or scores (`docs/metrics.md`).
- **Privacy.** Titles are user data in a file the user asked for, not logs. The command prints
  paths and counts only. `--no-titles` hides titles for screenshots. Reports are gitignored by
  name. Every interpolated string is HTML-escaped; CSS classes come from fixed vocabularies.
- Add `demo`: creates a **new** store at an explicit `--out` path (never the default store) and
  fills it with deterministic synthetic history (seeded PRNG, fake clock driven through the normal
  services, 2026-08-31 to 2026-10-12) so the report can be shown and screenshotted
  reproducibly. `report --as-of 2026-10-12` pins "today".

## Alternatives rejected

- Local web server / `--watch`: breaks the no-listener rule and needs lifecycle handling.
- Charting library or CDN assets: dependency and offline/CSP cost for charts that are a few SVG
  elements.
- Terminal board: a good later addition; HTML gives far more demo value per minute.
- Per-status history (cumulative flow, cycle time): the store has no status-change log, and
  adding one is a separate, migration-bearing decision.

## Limits

- No history of status changes or cancellations (cancelled time is not recorded).
- Only the latest plan revision exists, so plan trend shows the final revision per day.
- A report is a snapshot; re-run it to refresh.
