# G1/G2 review report

Date: 2026-10-18. Cj approved continuing to G3–G6 without pausing at this gate, so this report
records the gate evidence and is not a request to stop.

## Demonstrated acceptance criteria

| Gate | Criterion                                                                   | Evidence                                              |
| ---- | --------------------------------------------------------------------------- | ----------------------------------------------------- |
| G1   | Test MCP client initialises the real process, lists tools, calls get_system | `tests/mcp/connection.test.ts`                        |
| G1   | No diagnostic text on stdout; clean exit on disconnect                      | raw JSON-RPC test in `connection.test.ts`             |
| G2   | Capture → stop → restart same path → retrieve same task                     | `tests/mcp/persistence.test.ts`                       |
| G2   | Complete twice → one stable completion timestamp (also after restart)       | `persistence.test.ts`, `integration/complete.test.ts` |
| G2   | Retry-safe capture; conflicting payload rejected                            | `persistence.test.ts`, `integration/items.test.ts`    |
| G2   | Invalid input rejected                                                      | `mcp/items.test.ts`, `integration/items.test.ts`      |
| G2   | Migration rerun safe; failed migration/transaction leaves no partial writes | `integration/storage.test.ts`                         |

## Commands

`npm ci` then `npm run verify` (typecheck, lint, format check, build, 49 tests), all passing
locally on Windows 11 with Node 24.11.0. GitHub Actions is configured but **has not run**: there is
no remote repository.

## Pending manual checks

- Connect a real MCP client (Claude Desktop or Claude Code) to the local build. This is covered by
  task 18.

## Known limitations

- Item editing, cancellation and transition validation through MCP come in G3 (`update_item`).
- Any change to a preset file makes an existing store refuse to start; there is no preset migration.
