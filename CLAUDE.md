# Waypoint MCP

Local-first productivity MCP server. An AI client calls Waypoint's tools to capture work, plan a day,
complete tasks and read deterministic metrics. Waypoint stores data in one local SQLite file per
productivity system (preset). It embeds no LLM and needs no API keys or network access.

Detailed specs live in `docs/` (product.md, architecture.md, metrics.md, tasks.md, decisions/).

## Commands

```sh
npm ci                # install from lockfile (Node 24 LTS, see .nvmrc)
npm run build         # compile src/ -> dist/
npm run typecheck     # strict tsc over src + tests
npm run lint          # eslint
npm run format:check  # prettier --check
npm test              # vitest (unit, integration, MCP process tests; mcp tests need a build first)
npm run verify        # typecheck + lint + format:check + build + test
```

## Architecture boundaries

- `src/domain/` — types, invariants, transition rules. Pure; no I/O, no MCP.
- `src/config/` — preset validation/loading, data-path resolution.
- `src/storage/` — better-sqlite3 repositories and numbered migrations.
- `src/services/` — use cases. Depend on domain + a storage interface. **Never import MCP.**
- `src/mcp/` — tool schemas, handlers, stdio entry point. Thin adapters over services.
- `src/cli/` — init / diagnostic commands.

No ORM, framework, DI container, plugin system or monorepo.

## Safety rules

- Stdout is MCP protocol only. Diagnostics go to stderr and never include item titles/descriptions.
- Parameterised SQL only. Multi-row writes run in a transaction. Never reset or delete an existing
  store to recover from a migration error.
- MCP inputs never accept SQL, shell commands or filesystem paths.
- Timestamps are UTC ISO instants; calendar dates are validated `YYYY-MM-DD`; day boundaries use
  the store's timezone (default Europe/London) via an injectable clock. Never assume 24-hour days.
- A store is bound to the preset snapshot it was created with; incompatible preset changes are
  rejected, never reinterpreted.
- Never commit databases, WAL/SHM files, backups, logs, `.env` or personal config.
- `package.json` stays `private: true`. No remote push, publish or licence choice without approval.

## Definition of done

Acceptance tests for the task pass; `npm run verify` passes; README and `docs/tasks.md` match the
real implementation; decisions recorded in `docs/decisions/`; no placeholder presented as working.
