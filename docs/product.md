# Product

## Problem

AI clients can reason about work, but they need a reliable place to keep it. Waypoint gives an MCP
client validated operations over persistent, user-owned data, configured to a chosen productivity
system.

## First user

Cj, testing a lightweight Avatar-inspired workflow in a separate local store. Wider demand is an
unverified hypothesis.

## Core flow

capture task → restart server → retrieve task → preview day plan → explicitly save plan →
complete task → retrieve accurate metrics.

## Scope (MVP)

- One user and one preset per SQLite database, stored outside the repository.
- Presets are declarative JSON (types, parents, statuses, transitions, executable types).
- MCP tools: `get_system`, `capture_item`, `query_items`, `update_item`, `complete_item`, `plan_day`,
  `get_day_plan`, `get_metrics`.
- CLI: `serve`, `init`, `doctor`, `backup`, plus `report` (static HTML board and charts) and `demo`
  (synthetic store) that work without an AI client.

## Non-goals

No interactive frontend (a static, read-only HTML `report` file is allowed, see
[decision 0003](decisions/0003-static-report.md)), network listener, accounts, payments, hosted infrastructure, Notion integration,
executable plugins, XP, recurring habits, streaks, review engine or preset gallery. No reopening of
completed work. No time scheduling or effort estimation in day plans.

## Bundled presets

Both presets run on the same engine; the engine never checks a preset ID. Use a separate store
(`--db`) per preset.

### Avatar-lite (`avatar-lite`, default)

- Types: **project** (container, root), **goal** (container, under a project or root), **task**
  (executable, under a project or goal, or root). Tasks are labelled "Task (Quest)" so a client
  may present them as quests.
- Statuses: `not_started`, `in_progress` (open), `done`, `cancelled`.
- Tags are labelled **Element**; Waypoint stores them as plain tags and attaches no Element
  semantics.
- Limits: no Seasons/Books/Chapters/Episodes hierarchy, XP, levels or reviews. It does not
  reproduce the full Avatar methodology.

### GTD-lite (`gtd-lite`)

- Types: **project** (container, root) and **action** (executable, under a project or root).
- Statuses: `inbox`, `next`, `waiting` (open), `done`, `cancelled`. New items default to
  `inbox`.
- Tags are labelled **Context** (e.g. `@computer`) as a convention only.
- Limits: statuses apply to projects and actions alike; there is no weekly review,
  someday/maybe list, reference filing or tickler. It is not a complete GTD implementation.
