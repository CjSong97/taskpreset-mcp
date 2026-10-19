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
- **cli** — `serve`, `init`, read-only `doctor` and `backup` (`VACUUM INTO`) commands.

## Preset format

Presets are declarative JSON in `presets/` (or an absolute path given at startup). They are
parsed, never executed.

| Field                             | Meaning                                                            |
| --------------------------------- | ------------------------------------------------------------------ |
| `id`, `version`                   | kebab-case ID and semver; together they identify the preset.       |
| `name`, `description`, `tagLabel` | Human labels. `tagLabel` says what tags mean (Element, Context).   |
| `itemTypes`                       | `{ label, executable, parents[], rootAllowed }` per type key.      |
| `statuses`                        | `{ label, category }` with category `open`, `done` or `cancelled`. |
| `initialStatuses`                 | Open statuses an item may be created in; the first is the default. |
| `transitions`                     | `from → [to]` moves allowed through `update_item`.                 |

Validation (`src/config/presets.ts` for structure, `presetProblems` in `src/domain/preset.ts`
for cross-references) rejects, reporting every problem at once:

- unknown keys or keys that are not lower_snake_case;
- parent types that do not exist, and item types that can never be created;
- presets without an executable type;
- presets without exactly one `done` status or without an open status;
- initial statuses that are unknown or not open;
- transitions from or to unknown statuses, out of `done`, into `done` (only `complete_item` reaches
  done), or to the same status.

Executable types are the work that can be planned, completed into metrics and counted as open
work. Non-executable types (projects, goals) are containers; they can still be completed, which
never completes their children.

## Store binding

The first time a store is opened it records the validated preset snapshot in `app_metadata`. Later
opens compare the configured preset with that snapshot and refuse to start if they differ
incompatibly. Use a new store to switch presets.

## Error model

Services throw `TaskPresetError` with a stable `code` (`validation`, `not_found`, `conflict`,
`invalid_transition`, `busy`, ...). MCP handlers convert them into `isError` tool results with the
code and a safe message. Unexpected errors are logged to stderr without item content.
