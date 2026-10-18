# 0001 — Runtime and dependency versions

Date: 2026-10-18 · Status: accepted

## Decision

- Node.js **24 LTS**, pinned to 24.11.0 in `.nvmrc`; `engines.node` is `^24.11.0`.
- `@modelcontextprotocol/sdk` **1.32.1** — the current `latest` dist-tag. Server code uses
  `McpServer.registerTool` (the non-deprecated API) and `StdioServerTransport`.
- `zod` **4.6.7** — within the SDK's `^3.25 || ^4.0` range.
- `better-sqlite3` **13.0.3** (requires Node ≥ 22). It installed from a prebuilt binary on Windows
  x64 / Node 24; no compiler toolchain was needed. Bundled SQLite is 3.53.4.
- TypeScript **6.0.3**, not 7.x: `typescript-eslint` 8.71 supports `typescript >=4.8.4 <6.1.0`.

All versions are pinned exactly; `package-lock.json` is the source of truth.

## Consequences

Moving to TypeScript 7 waits for typescript-eslint support. Upgrading better-sqlite3 or Node
requires re-checking the prebuilt binary availability.
