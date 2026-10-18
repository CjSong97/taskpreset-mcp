# MVP implementation report (G1–G6)

Date: 2026-10-18 · Runtime: Node 24.11.0, Windows 11 · Local repository only (no remote)

## What exists

A local stdio MCP server with eight tools: `get_system`, `capture_item`, `query_items`,
`update_item`, `complete_item`, `plan_day`, `get_day_plan` and `get_metrics`. It also has
`init`, `doctor` and `backup` CLI commands. One SQLite store holds one preset (Avatar-lite or
GTD-lite) and one timezone. The architecture is domain → services (no MCP imports) → SQLite
repositories → MCP adapters.

## Gates

| Gate | Result                                     | Evidence                                                                                            |
| ---- | ------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| G1   | Pass                                       | `tests/mcp/connection.test.ts`: compiled process, list tools, get_system, stdout is JSON-RPC only   |
| G2   | Pass                                       | `tests/mcp/persistence.test.ts`: three processes, one store, stable completion; `storage.test.ts`   |
| G3   | Pass                                       | `integration/workflows.test.ts` (both presets), `update.test.ts`, `unit/no-preset-branches.test.ts` |
| G4   | Pass                                       | `plan-preview`, `plans`, `plan-revisions` tests; `mcp/plan-conflicts.test.ts` (two processes)       |
| G5   | Pass                                       | `metrics.test.ts`, `metrics-edge.test.ts`: hand fixtures incl. both 2026 DST days; mutation check   |
| G6   | Automated parts pass; human checks pending | `cli.test.ts`, `backup.test.ts`, `mcp/walkthrough.test.ts`, `npm run check:clean-install`           |

## Commands run (final)

- `npm run verify`: typecheck, lint, Prettier check, build and 146 tests. **Pass.**
- `npm run check:clean-install`: clone HEAD, `npm ci`, build, init, doctor, MCP flow. **Pass.**
- `npm ci` reported 0 vulnerabilities.

## Pending manual checks

- Human walkthrough in a real MCP client (`docs/dogfooding.md`). Claude Code recognised the server
  config, but connecting it needs your interactive approval.
- Seven-day dogfooding trial.
- Hosted GitHub Actions run. The workflow exists, but there is no remote repository.

## Known limitations

- A store is bound to its exact preset snapshot. Any preset edit requires a new store; there are
  no preset migrations.
- No reopening of completed work, no deletion of items, no recurring work, reviews, XP or streaks.
- Only the latest plan revision is stored, so metrics use the latest committed membership.
- `doctor` may leave SQLite `-wal`/`-shm` sidecar files after reading a store.
- Hosted CI and publication (package name, licence) still need approval.

## Next smallest step

Run the walkthrough in Claude Code (section 3 of `docs/dogfooding.md`) and note any tool
descriptions that led the client to the wrong call.
