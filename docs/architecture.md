# Architecture

```
MCP client ──stdio──▶ src/mcp (schemas, handlers)
                         │
                         ▼
                    src/services (use cases, clock)
                         │            │
                         ▼            ▼
                  src/domain     storage interface
                  (rules)              │
                                       ▼
                               src/storage (better-sqlite3, migrations)
                                       │
                                       ▼
                               one SQLite file per store
```

## Layers

- **domain** — item/plan types, preset model, status categories, transition and parent rules,
  date helpers. Pure functions.
- **config** — loads and validates preset JSON; resolves the data path (OS user-data default or an
  explicit absolute path).
- **storage** — opens the database (foreign keys, WAL, bounded busy timeout), runs numbered
  migrations in transactions, and implements repositories with parameterised SQL.
- **services** — orchestrate domain rules and repositories; own transactions that span several
  rows; receive an injectable `Clock`.
- **mcp** — registers tools with explicit Zod schemas, marks read-only vs mutating tools through
  annotations, maps domain errors to tool errors. Stdout carries protocol traffic only.
- **cli** — `init` and `doctor` commands.

## Store binding

The first time a store is opened it records the validated preset snapshot in `app_metadata`. Later
opens compare the configured preset with that snapshot and refuse to start if they differ
incompatibly. Use a new store to switch presets.

## Error model

Services throw `WaypointError` with a stable `code` (`validation`, `not_found`, `conflict`,
`invalid_transition`, `busy`, ...). MCP handlers convert them into `isError` tool results with the
code and a safe message. Unexpected errors are logged to stderr without item content.
