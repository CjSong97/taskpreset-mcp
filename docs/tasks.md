# Tasks

Status of the implementation backlog. Source tasks are tracked in Notion; this file reflects what is
actually in the repository.

| #   | Task                                         | Milestone | Status                             |
| --- | -------------------------------------------- | --------- | ---------------------------------- |
| 01  | Scaffold the TypeScript repository           | G1        | Done                               |
| 02  | Add quality checks and CI                    | G1        | Done                               |
| 03  | Connect a stdio MCP server                   | G1        | Done                               |
| 04  | Add safe SQLite storage and migrations       | G2        | Done                               |
| 05  | Implement task capture and querying          | G2        | Done                               |
| 06  | Verify completion, retries and restart       | G2        | Done                               |
| 07  | Validate declarative preset configuration    | G3        | Done                               |
| 08  | Supply Avatar-lite and GTD-lite presets      | G3        | Done                               |
| 09  | Add editing and lifecycle invariants         | G3        | Done                               |
| 10  | Preview a bounded daily plan                 | G4        | Done                               |
| 11  | Save and retrieve explicit day plans         | G4        | Done                               |
| 12  | Guard plan revisions and date boundaries     | G4        | Done                               |
| 13  | Define completion and plan metrics           | G5        | Done                               |
| 14  | Implement deterministic metric queries       | G5        | Done                               |
| 15  | Test metric edge cases and London DST        | G5        | Done                               |
| 16  | Add local setup and diagnostics              | G6        | Done                               |
| 17  | Verify backup and restore safety             | G6        | Done                               |
| 18  | Prepare real-client walkthrough & dogfooding | G6        | In progress — human checks pending |
| 19  | Static HTML report and demo store            | Post-MVP  | Done                               |
| 20  | Suggested preset templates (8 systems)       | Post-MVP  | Done                               |

## Post-MVP decisions (2026-10-19)

- The seven-day trial is **skipped by the owner**: the server works as expected and the section 3
  checks were done by hand. Task 18's walkthrough remains available in
  [dogfooding.md](dogfooding.md) but is no longer a blocker.
- Task 19 adds `report` and `demo` ([decision 0003](decisions/0003-static-report.md)).
- Task 20 adds eight suggested presets under `presets/suggested/` (not bundled).
- The name "Waypoint" collides with several projects, including a same-named MCP task tracker. A
  rename is recommended before any publication; see [docs/reports/naming.md](reports/naming.md).

## Pending human checks

- Real-client walkthrough (Claude Code and/or Claude Desktop) following
  [dogfooding.md](dogfooding.md). The automated twin (`tests/mcp/walkthrough.test.ts`) passes.
- Seven-day dogfooding trial ([dogfooding.md](dogfooding.md#4-seven-day-trial-checklist)).
- First hosted GitHub Actions run (requires a remote repository, which needs approval).
