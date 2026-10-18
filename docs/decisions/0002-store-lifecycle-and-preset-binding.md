# 0002 — Store lifecycle and preset binding

Date: 2026-10-18 · Status: accepted

## Decision

- **Location.** `--db <absolute path>` (or `WAYPOINT_DB`). Relative paths are rejected because MCP
  clients launch servers from different working directories. Default:
  `%LOCALAPPDATA%\Waypoint\waypoint.db` (Windows), `~/Library/Application Support/Waypoint/` (macOS),
  `$XDG_DATA_HOME/waypoint/` or `~/.local/share/waypoint/` (Linux).
- **Creation.** `serve` creates the store on first use with the configured preset (default
  `avatar-lite`) and timezone (default `Europe/London`). Preset and timezone are validated before any
  file is created.
- **Binding.** The store records the canonical JSON of the validated preset plus the timezone in
  `app_metadata`. On later opens, `--preset`/`--timezone` are optional; if given they must match
  exactly, otherwise startup fails with an explanation. Any change — even a label — counts as
  incompatible in the MVP. Use a new `--db` path for a different preset.
- **Foreign files.** A non-empty file without `schema_migrations` is refused untouched. Files that
  are not SQLite are refused.
- **Migrations.** Numbered TypeScript modules (`src/storage/migrations/NNN-*.ts`) so they ship in
  `dist/` without copying assets. Each runs in its own `BEGIN IMMEDIATE` transaction together with
  its `schema_migrations` row. A failure rolls back and is reported; the store is never reset. A
  store with versions unknown to the running build is refused.
- **Connections.** `foreign_keys=ON`, `journal_mode=WAL`, `synchronous=NORMAL`,
  `busy_timeout=5000`. Writes use `BEGIN IMMEDIATE` to avoid deferred lock-upgrade deadlocks;
  `SQLITE_BUSY`/`SQLITE_LOCKED` surface as a `busy` error asking the client to retry.
- **Retry-safe capture** is stored on `items` (`request_id` UNIQUE + `request_fingerprint`) rather
  than a separate table.
- Tables are `STRICT`.

## Consequences

Changing a preset requires creating a new store; there is no preset migration path in the MVP.
