# Naming and prior-art check

Date: 2026-10-19. Sources: npm registry, PyPI, GitHub (API and search), the official MCP registry
and web search. PulseMCP, Glama, mcp.so and Smithery could not be queried directly, so registry
coverage is incomplete. Star counts are from 2026-10-19 and change quickly.

## Verdict: the name "Waypoint" is crowded — rename before publishing

- npm `waypoint-mcp` is **free** (404), but PyPI `waypoint-mcp` is **taken** (v0.3.0).
- **STiFLeR7/waypoint-mcp** (created 2026-10-15): a local MCP server and CLI that tracks projects
  across Claude Code, Codex, Gemini CLI, Copilot CLI and ChatGPT. Same name, overlapping pitch.
- Other Waypoint MCP or agent projects: 100615056/waypoint-mcp (guided tools for building with
  AI), zafrem/Waypoint (goal hierarchy over MCP), logbookfordevs/logbook-waypoint (extension plus
  MCP), `@copoint-ai/waypoint-cli`, ysznai/dji-waypoint-mcp (drone routes), several
  special-education hiring-challenge repos. All have 0 to 7 stars.
- HashiCorp Waypoint (4.7k stars; HashiCorp is part of IBM) dominates search results for
  "waypoint". Trademarks were **not** checked in any registry.

## Prior art (similar open-source projects)

| Project                                           | Stars | Relation to this project                                                                            |
| ------------------------------------------------- | ----- | --------------------------------------------------------------------------------------------------- |
| sznicolas/taskmajor                               | 3     | Closest: local MCP on TaskWarrior with profiles (GTD, project mgmt). Profiles gate tools, not data. |
| bsmi021/mcp-task-manager-server                   | 25    | SQLite task manager for agent work; no methodology layer.                                           |
| Chevalicious/things3-mcp-gtd                      | 15    | GTD over Things 3; macOS only.                                                                      |
| Kunkun1234-1/lifeos                               | 12    | PARA+GTD+OKR hosted app with OAuth MCP; not a local stdio server.                                   |
| omniwaifu/taskwarrior-mcp                         | 9     | TaskWarrior/GTD bridge.                                                                             |
| joseamijares/daybook                              | 4     | Agent-friendly daily planner; closest on day plans.                                                 |
| jensru/todocore, maciejkepa/gtd-mcp-server, other | 0–2   | Generic or hard-coded GTD SQLite servers.                                                           |

**Is the niche free?** Mostly. Local SQLite task MCP servers and GTD servers exist and are
individually commoditised. No project was found that combines declarative methodology presets
bound to a store snapshot, versioned day plans and documented deterministic metrics. Lead the
pitch with that combination. The search is not exhaustive.

## Candidate names (checked 2026-10-19)

| Name                                 | npm `-mcp` | PyPI `-mcp` | Collisions                                                                                                                                                |
| ------------------------------------ | ---------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Plotline**                         | free       | free        | No MCP or GitHub hits for "plotline mcp". Generic hits: novel-writing tools. A product-analytics SaaS named Plotline likely exists (trademark unchecked). |
| **Waymark**                          | free       | free        | One empty 0-star `waymark-network/waymark-mcp`. Close to "Waypoint", so keeps the story; Waymark.com is a video-ad firm (unverified).                     |
| Lodestar                             | free       | free        | Three 0-star `lodestar-mcp` repos; an Ethereum client uses the name.                                                                                      |
| Tideline                             | free       | free        | Finance MCP registry entry; a 38-star AI-memory project.                                                                                                  |
| Regimen                              | free       | free        | A trading-strategy MCP registry entry.                                                                                                                    |
| Trailhead / Stepstone / Bearing      | free       | —           | Salesforce, a German job board, and crowded agent tooling. Avoid.                                                                                         |
| Milepost, Cairn, Wayfinder, Pathmark | taken      | —           | Already used by MCP or agent tools.                                                                                                                       |

## Recommendation (round 1, superseded by round 2 below)

1. **Plotline** (`plotline-mcp`): cleanest on MCP and GitHub, and it matches the Avatar-inspired
   story structure (seasons, books, chapters) that motivated the project.
2. **Waymark** (`waymark-mcp`): least disruptive rename, but near enough to Waypoint that it
   inherits some confusion.
3. **Lodestar**: good meaning, noisier.

Before adopting any name: run a trademark search (UKIPO/USPTO), re-check the npm and GitHub names,
and update `package.json`, the MCP `serverInfo` name, docs, the Notion project and CLI help in one
sweep. The rename is mechanical and has not been done.

## Round 2 (2026-10-19): descriptive names around "productivity preset system"

Plotline was rejected by the owner as unrelated to the goal. The brief became: simple, clear, short,
usable as `<name>-mcp`. Twenty candidates were checked on npm, PyPI, GitHub, the official MCP
registry and RDAP (domains, indicative only). Gaps: some domain lookups were rate-limited, the MCP
registry was reached through a fetch tool only, and no trademark search was done.

| Name                                 | npm `-mcp` and bare | PyPI `-mcp` | GitHub / registry                                     | Clarity and risks                                                                 |
| ------------------------------------ | ------------------- | ----------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| **presetkit**                        | free, free          | free        | two 0-star unrelated repos; no registry match         | Only candidate with "preset". Search skews to photo/video presets. `.com` taken.  |
| **methodset**                        | free, free          | free        | `nestjs-methodset` (17 stars, unrelated); no registry | Fits GTD/Kanban/PARA as "methods"; does not say "preset"; Go "method set" jargon. |
| **taskpreset**                       | free, free          | free        | two 0-1 star repos; no registry match                 | Clearest literal meaning; `.com` also unregistered. "Task" understates OKR/Scrum. |
| workmethod                           | free, free          | free        | student repos only                                    | Clean, never says "preset".                                                       |
| methodkit                            | free, free          | free        | 4 repos                                               | MethodKit is an established card-deck brand. Avoid.                               |
| flowset, flowpack, workmode, taskkit | free, **taken**     | free        | task-workflow companies or existing MCP servers       | Existing products in the same space. Avoid.                                       |
| playbook, switchboard                | taken               | taken       | 5+ and 10 registry entries                            | Crowded MCP namespace. Avoid.                                                     |

**Recommended: `presetkit`** with a descriptor ("presetkit: productivity-system presets for AI
assistants"), npm package `presetkit-mcp`, CLI `presetkit`. Fallbacks: `methodset`, `taskpreset`.
Because "preset" and "method" are common words, discoverability depends on the descriptor and on
keywords (GTD, Kanban, local-first, SQLite, productivity), not on the name alone.

Not done, and needs the owner: claiming the names on npm (an outward-facing action), a
UKIPO/USPTO trademark search, a final domain check for the chosen name, and the mechanical rename
(package.json, MCP `serverInfo` name, CLI help, docs, Notion).
