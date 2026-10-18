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
node dist/cli/main.js serve --preset avatar-lite
```

The server speaks MCP over stdio. It writes protocol messages to stdout and JSON-line diagnostics
to stderr.

## Tools

| Tool         | Kind      | Purpose                                                         |
| ------------ | --------- | --------------------------------------------------------------- |
| `get_system` | read-only | Preset identity, item types, statuses, transitions, tz, limits. |

## Development

```sh
npm run verify   # typecheck, lint, format check, build, tests
```

See [CLAUDE.md](CLAUDE.md) for architecture boundaries and safety rules.
