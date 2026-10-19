# Real-client walkthrough and seven-day trial

| Check                                  | Status                                      |
| -------------------------------------- | ------------------------------------------- |
| Automated process/client smoke tests   | Passing (`tests/mcp/`, clean-install check) |
| Human walkthrough in a real MCP client | **PENDING — Cj to perform**                 |
| Seven-day dogfooding trial             | **PENDING — Cj to perform**                 |

The walkthrough below is mirrored step by step by `tests/mcp/walkthrough.test.ts`, which asserts the
same outputs through the official MCP SDK client. That test is not a substitute for using a real
client.

## 1. Build and create a trial store

Use a dedicated store for the trial, outside any repository. The commands below use Windows paths;
replace them with your own absolute paths.

```powershell
cd C:\Users\CJ\Documents\Development\taskpreset-mcp
npm ci
npm run build
node dist\cli\main.js init --db C:\Users\CJ\AppData\Local\TaskPreset\trial.db --preset avatar-lite
node dist\cli\main.js doctor --db C:\Users\CJ\AppData\Local\TaskPreset\trial.db
```

Expected: `init` prints `Created TaskPreset store at …`, `preset: avatar-lite@1.0.0 (Avatar-lite)`,
`timezone: Europe/London` and `schema: version 2`. `doctor` prints only `[ok]` lines, ending with
`Contents: 0 items, 0 day plans`.

The client launches `node` from its own PATH. If `node --version` in a new terminal is not
24.11+, put the absolute path to Node 24's `node.exe` in place of `node` below.

## 2. Connect a client

### Claude Code

```powershell
claude mcp add taskpreset -- node C:\Users\CJ\Documents\Development\taskpreset-mcp\dist\cli\main.js serve --db C:\Users\CJ\AppData\Local\TaskPreset\trial.db
claude mcp list
```

Expected: `claude mcp list` shows `taskpreset: node …main.js serve --db …trial.db - ✓ Connected`.
Inside a Claude Code session, `/mcp` lists `taskpreset` with 8 tools.

Verified by Claude on 2026-10-18 with Claude Code 2.1.278: the `claude mcp add` syntax (from
`claude mcp add --help`), and that `claude mcp list` recognises a TaskPreset server entry. Claude did
not approve or connect it in your account; the `✓ Connected` result is part of the pending human
check. Remove it later with `claude mcp remove taskpreset`.

### Claude Desktop

Edit `%APPDATA%\Claude\claude_desktop_config.json` (macOS:
`~/Library/Application Support/Claude/claude_desktop_config.json`), then fully restart Claude
Desktop:

```json
{
  "mcpServers": {
    "taskpreset": {
      "command": "node",
      "args": [
        "C:\\Users\\CJ\\Documents\\Development\\taskpreset-mcp\\dist\\cli\\main.js",
        "serve",
        "--db",
        "C:\\Users\\CJ\\AppData\\Local\\TaskPreset\\trial.db"
      ]
    }
  }
}
```

Expected: the tools menu lists TaskPreset's 8 tools. Not yet verified with Claude Desktop.

## 3. Walkthrough (capture → plan → complete → measure)

Ask the client in plain language; it chooses the tool calls. Approve mutating calls when asked.

| #   | Say to the client                                                                                                                                                                              | Expected tool call(s)                     | Expected visible result                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | "What productivity system is TaskPreset configured with?"                                                                                                                                      | `get_system`                              | Avatar-lite; types project/goal/task ("Task (Quest)"); statuses not_started, in_progress, done, cancelled; tags = Element; Europe/London.                  |
| 2   | "Create a project 'TaskPreset trial' with three tasks: 'Write the trial notes' (priority 1, Element Fire), 'Review yesterday's plan' (priority 2), 'Tidy the inbox' (priority 3, due 31 Dec)." | `capture_item` ×4                         | Four items; tasks are `not_started` under the project.                                                                                                     |
| 3   | Quit and restart the client, then: "List my open tasks in TaskPreset trial."                                                                                                                   | `query_items`                             | The same three tasks, same IDs, oldest first.                                                                                                              |
| 4   | "Suggest a plan for today with up to 3 items." then "Save that plan in that order."                                                                                                            | `plan_day` (preview), `plan_day` (commit) | Preview lists the three tasks in priority order and says nothing was saved; the commit returns revision 1.                                                 |
| 5   | "Mark 'Write the trial notes' done." then "Mark it done again."                                                                                                                                | `complete_item` ×2                        | First: done with a completion time. Second: `already_completed: true` with the **same** completion time.                                                   |
| 6   | "Show today's plan and my metrics for today."                                                                                                                                                  | `get_day_plan`, `get_metrics`             | Plan revision 1: position 1 done, 2 and 3 not_started. Metrics: completed 1, open 2, planned 3, completed planned 1, ratio ≈ 0.33, Europe/London interval. |
| 7   | "Plan yesterday." (negative check)                                                                                                                                                             | `plan_day`                                | A validation error saying past-day plans cannot be changed.                                                                                                |

Record what you saw against each row, and note anything confusing in the tool descriptions.

## 4. Seven-day trial checklist

Use the trial store for real work for seven consecutive days. Tick each box only when you have
done it.

| Day | Capture new work | Preview + commit a plan | Complete planned work | Check `get_metrics` | Notes (friction, wrong numbers, missing features) |
| --- | ---------------- | ----------------------- | --------------------- | ------------------- | ------------------------------------------------- |
| 1   | [ ]              | [ ]                     | [ ]                   | [ ]                 |                                                   |
| 2   | [ ]              | [ ]                     | [ ]                   | [ ]                 |                                                   |
| 3   | [ ]              | [ ]                     | [ ]                   | [ ]                 |                                                   |
| 4   | [ ]              | [ ]                     | [ ]                   | [ ]                 |                                                   |
| 5   | [ ]              | [ ]                     | [ ]                   | [ ]                 |                                                   |
| 6   | [ ]              | [ ]                     | [ ]                   | [ ]                 |                                                   |
| 7   | [ ]              | [ ]                     | [ ]                   | [ ]                 |                                                   |

During the week, also try each of these at least once:

- [ ] Re-plan mid-day (needs `expected_revision`) and confirm finished items can stay in the plan.
- [ ] Cancel a planned task and confirm `planned_count` does not drop.
- [ ] Run `backup` while the client is connected, then restore it to a new path and run `doctor`
      (see [backup-restore.md](backup-restore.md)).
- [ ] Use two clients (e.g. Claude Code and Claude Desktop) on the same store.
- [ ] Check that stderr logs (the client's MCP log) contain no task titles.

### End-of-trial review

- Did the metrics match your own count each day? Note any mismatch with the date and the
  `start_utc`/`end_utc` that `get_metrics` reported.
- Which tool descriptions led the client to the wrong call?
- What would make you keep using it: GTD-lite, fuller Avatar hierarchy, reviews?
