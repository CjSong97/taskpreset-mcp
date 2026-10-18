# Backup and restore

A Waypoint store is one SQLite file in WAL mode. Recent writes may sit in the `-wal` sidecar file
until SQLite checkpoints them, so **copying only `waypoint.db` while a server is running can lose
recent changes or produce an inconsistent copy.** Use the `backup` command instead.

## Back up

```sh
node dist/cli/main.js backup --db /absolute/path/to/waypoint.db --out /absolute/path/to/backups/waypoint-2026-10-18.db
```

- Uses SQLite `VACUUM INTO`, which writes a transactionally consistent snapshot that includes WAL
  contents. It is safe while MCP clients are connected.
- Opens the source read-only. It never overwrites an existing `--out` file, and it refuses a
  source that is not a Waypoint store.
- Verifies the new file (`quick_check`) and prints its schema version, preset and counts. It does
  not print item content.
- The backup is a single self-contained file (no `-wal`/`-shm` needed). Keep backups outside any
  Git repository; `.gitignore` already excludes `*.db` and `backups/`.

## Restore

Restore into a **new path** first and inspect it. Never write over a store a server is using.

1. Copy the backup to a new location, e.g. `cp waypoint-2026-10-18.db /absolute/path/restored.db`.
2. Check it: `node dist/cli/main.js doctor --db /absolute/path/restored.db`.
3. Optionally run `serve` against it and use `query_items`, `get_day_plan` and `get_metrics` to
   confirm the contents.
4. To switch over, stop every MCP client that uses the old store, then point their `--db` at the
   restored file. Keep the old store until you are satisfied.

If you must replace a store file manually, stop all servers first, then move the old `.db`,
`.db-wal` and `.db-shm` files aside together. Never delete a `-wal` file belonging to a store you
want to keep: it may hold committed data.

## Verification

`tests/integration/backup.test.ts` runs the procedure:

1. Seed a store (items, completions, cancellation, a plan replaced to revision 2, a second plan)
   and keep its writer connection open, so recent data lives in the WAL.
2. Run `backup` through the CLI.
3. Copy the backup to a separate path and open it.
4. Check that every table row, the preset snapshot, the timezone, the items, the ordered plans,
   their revisions and the metrics equal the source.
5. Check that the source store is byte-for-byte unchanged at the row level.

It also checks that unsafe destinations (an existing file, a relative path, the source itself)
and foreign sources are refused without writing anything.
