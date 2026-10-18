# Waypoint MCP

A configurable, local-first productivity MCP server. An AI client (Claude Desktop, Claude Code or
another MCP client) uses Waypoint's tools to capture work, organise it, plan a day, complete tasks
and read deterministic metrics. Data lives in a local SQLite file you own. There is no cloud
service, account, embedded LLM or API key.

> Status: early prototype under active development. See [docs/tasks.md](docs/tasks.md).

## Requirements

- Node.js 24 LTS (see `.nvmrc`)
- npm

## Build

```sh
npm ci
npm run build
```

## Run

```sh
node dist/cli/main.js serve --db /absolute/path/to/waypoint.db --preset avatar-lite
```

- `--db` (or `WAYPOINT_DB`) must be absolute. Without it the store lives in the OS user-data
  directory (`%LOCALAPPDATA%\Waypoint\waypoint.db` on Windows).
- The store is created on first run and bound to its preset and timezone (default
  `Europe/London`). Later runs may omit `--preset`; a different preset is refused.

The server speaks MCP over stdio. It writes protocol messages to stdout and JSON-line diagnostics
to stderr (without item content).

## Tools

| Tool           | Kind      | Purpose                                                          |
| -------------- | --------- | ---------------------------------------------------------------- |
| `get_system`   | read-only | Preset identity, item types, statuses, transitions, tz, limits.  |
| `capture_item` | mutating  | Create an item; `request_id` makes retries safe.                 |
| `query_items`  | read-only | Filter by id/type/status/parent/tag/due date; cursor pagination. |

## Development

```sh
npm run verify   # typecheck, lint, format check, build, tests
```

See [CLAUDE.md](CLAUDE.md) for architecture boundaries and safety rules.
