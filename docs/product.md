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

## Non-goals

No frontend, network listener, accounts, payments, hosted infrastructure, Notion integration,
executable plugins, XP, recurring habits, streaks, review engine or preset gallery. No reopening of
completed work. No time scheduling or effort estimation in day plans.
