# Market validity check

Date: 2026-10-19. Method: a research subagent queried GitHub, the official MCP registry, PulseMCP,
Glama, Hacker News (Algolia) and Obsidian plugin stats. Reddit was unreachable, so Reddit
sentiment is **not verified**. Methodology-adoption rankings are mostly inference. Treat every
number as a snapshot.

## Verdict

**Moderate-low as a standalone product; reasonable as a publishable niche project.** The need is
real (people assemble GTD or PARA workflows around Claude by hand), and no project found offers a
local, multi-methodology, metrics-backed engine. Demand for a _named-methodology MCP server_ is
unproven, and the main competitor is "a markdown file". Do not claim "market-validated".

## Findings

| Question                    | Verdict            | Evidence (verified unless marked inference)                                                                                                                                                                                                                                                                 |
| --------------------------- | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Demand for named methods    | Weak to moderate   | Lots of DIY setups (e.g. sean-esk/second-brain-gtd 52 stars, adagradschool/cc-gtd 36). Named-GTD MCP repos are tiny (1, 2, 15 stars). Official registry lists one "gtd" server (commercial). Obsidian: Kanban plugin 2.76M downloads, Tasks 4.45M, largest GTD plugin about 8.6k, PARA about 7.6k, OKR 726. |
| MCP productivity market     | Moderate           | PulseMCP 21,678 servers; Glama 105,220 (Project Management 3,962). Upper bounds: Notion official MCP 4,671 stars, Todoist official 560. claude-task-master 28k stars but aimed at coding agents. Obsidian MCP servers top out at about 830 stars.                                                           |
| Competitors and substitutes | Moderate (crowded) | Closest concept: Kunkun1234-1/lifeos (PARA+GTD+OKR, 12 stars, hosted OAuth). Others: kanban-mcp 84 stars, moo-tasks 45, taskwarrior-mcp 22, daybook 4, mcp-task-manager-server 25 (stale). Substitutes: Obsidian, Notion, Todoist, Things, Linear.                                                          |
| Positioning words           | Moderate           | "preset" is not a search term. People say "GTD MCP", "kanban MCP", "task manager", "local-first", "second brain", "daily planner". Inference: lead with local-first, then "pick your system", then deterministic metrics and the offline report.                                                            |
| Which methods to build      | Moderate           | Inference ranking: Kanban, GTD, Scrum, Eisenhower, PARA, OKR, Bullet Journal. State-machine fit is best for Kanban, Scrum, GTD, Eisenhower, OKR; poor for PARA, Zettelkasten, Pomodoro.                                                                                                                     |
| Risks                       | High               | Dozens of near-identical task MCPs (mostly 0 to 30 stars); "just use a markdown file" objection (a Show HN for a similar tool got 7 points and 3 comments, news.ycombinator.com/item?id=50039633); skills and CLI displacing MCP for some workflows.                                                        |

Realistic best case for a solo project (inference from comparable repos): about 10 to 100 stars and
tens of weekly users from registry listings. Several hundred stars would need a hit.

## Defensible differentiators

Enforced state transitions, versioned day plans, deterministic documented metrics, local data with
no account, and the offline HTML report that needs no AI client.

## Cheap next actions

1. List on the official MCP registry, PulseMCP and Glama, and open a PR to
   punkpeye/awesome-mcp-servers (Workplace & Productivity). Use the keywords GTD, Kanban,
   local-first, SQLite, productivity.
2. Lead the README with a 30-second demo (the report screenshot and one plan-my-day transcript) and
   a short "why not a markdown file" section.
3. Treat one Show HN or r/ClaudeAI post as the real demand test: build the presets people ask for,
   otherwise keep it a personal tool.

## Could not verify

Reddit threads and subreddit sizes, Notion template duplicate counts, search-volume or Google
Trends data, GTD book sales, Smithery and mcp.so installs, per-server registry installs, the 18th
State of Agile figures, whether PulseMCP submissions are paused, the snapshot date of the Obsidian
stats file.
