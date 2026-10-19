# Suggested presets

Eight starter templates for common productivity systems. They are **not bundled**: they are not in
`BUNDLED_PRESET_IDS`, so Waypoint never loads them unless you point at one by absolute path.

Each file is a **limited interpretation**, not an implementation, of the named system. A Waypoint
preset can only define item types (label, executable, allowed parents, root allowed), statuses
(open, done or cancelled), initial statuses and permitted transitions. It has no concept of
work-in-progress limits, estimates, recurrence, cycle dates, scoring, notes or files. Where a
system depends on those, the template says so in its `description` and the table below.

Item-level fields that exist outside the preset (`priority` 1-4, `due_date`, `tags`) can fill some
gaps, for example a priority per Eisenhower or MoSCoW item, but no template relies on them.

## Presets

| ID                | System            | Item types (executable in bold)     | Statuses (done / cancelled marked)                                                      | Left out                                                                                                | Primary source                                                                                                                                                                                                  |
| ----------------- | ----------------- | ----------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kanban-lite`     | Personal Kanban   | **card**                            | backlog, ready, doing, done (done), cancelled (cancelled)                               | WIP limits, pull signals, blocked markers, classes of service, per-column policies                      | [Official Kanban Guide](https://resources.kanban.university/wp-content/uploads/2021/06/The-Official-Kanban-Guide_US.pdf), [Personal Kanban overview](https://www.planet-lean.com/articles/personal-kanban-work) |
| `scrum-lite`      | Scrum             | product_goal, **pbi**               | product_backlog, refined, sprint_backlog, in_progress, done (done), removed (cancelled) | Sprints with dates, Sprint Goals, events, roles, estimates, velocity                                    | [Scrum Guide](https://scrumguides.org/scrum-guide.html)                                                                                                                                                         |
| `para-lite`       | PARA              | area, project, resource, **task**   | active, on_hold, done (done), archived (cancelled)                                      | Notes and files (a resource is only a titled pointer), just-in-time organising                          | [Forte Labs: PARA](https://fortelabs.com/blog/para/)                                                                                                                                                            |
| `okr-lite`        | OKR               | objective, **key_result**, **task** | draft, active, at_risk, done (done), dropped (cancelled)                                | Numeric targets, 0.0-1.0 or red/yellow/green scoring, committed vs aspirational, cycle dates, check-ins | [WhatMatters.com (Doerr): OKR definition](https://www.whatmatters.com/faqs/okr-meaning-definition-example)                                                                                                      |
| `eisenhower-lite` | Eisenhower matrix | **task**                            | unsorted, do, decide, delegate, done (done), deleted (cancelled)                        | Urgency and importance as data, automatic re-sorting as deadlines near                                  | [Training Industry: Eisenhower Matrix](https://trainingindustry.com/articles/strategy-alignment-and-planning/what-is-the-eisenhower-matrix-and-how-can-it-help-with-time-management/)                           |
| `bujo-lite`       | Bullet Journal    | **task**, event, note               | open, migrated, scheduled, done (done), irrelevant (cancelled)                          | Daily, monthly and future logs, index, pages, re-writing migrated entries                               | [bulletjournal.com: Migration](https://bulletjournal.com/blogs/faq/migration)                                                                                                                                   |
| `shape-up-lite`   | Shape Up          | pitch, **scope**                    | raw_idea, shaped, bet, uphill, downhill, done (done), dropped (cancelled)               | Appetite, six-week cycle dates, betting table, cool-down, hill-chart positions                          | [Shape Up (Basecamp)](https://basecamp.com/shapeup)                                                                                                                                                             |
| `moscow-lite`     | MoSCoW (DSDM)     | timebox, **requirement**            | proposed, must, should, could, done (done), wont (cancelled)                            | Effort budget (e.g. the 60-20-20 guideline), timebox dates                                              | [Agile Business Consortium (DSDM)](https://www.agilebusiness.org/) , summary: [MoSCoW prioritization](https://umbrex.com/resources/frameworks/organization-frameworks/moscow-prioritization/)                   |

## Mapping compromises

- **Statuses are global.** One status list serves every item type, and transitions are not
  per-type. Containers (goals, areas, pitches, timeboxes) therefore carry statuses that really
  describe their children (for example `must` on a MoSCoW timebox). Ignore the ones that do not fit.
- **Done is binary and shared.** `complete_item` is the only way to reach the done status. Cancelled
  statuses are used for "deliberately out", including cases that are not really cancellation:
  `archived` (PARA, kept for reference) and `wont` (MoSCoW, may return next time). Both can be
  moved back out, but a cancelled item cannot be completed until it is.
- **Scrum.** The Scrum Guide defines no item workflow states, only the Product Backlog, Sprint
  Backlog and Increment (items meeting the Definition of Done). `refined` and `in_progress` are
  common board conventions, not part of the guide. Items failing the Definition of Done return to
  the Product Backlog, which the transitions allow.
- **PARA** organises information, not work. `task` is an addition so that something is plannable.
- **OKR.** `at_risk` and `task` are additions (tool conventions, not Doerr's definition).
  Key results are binary achieved or not (Grove's yes/no scoring), not scored.
- **Bullet Journal.** A migrated task stays the same item (status `migrated`) rather than being
  re-written on a new page. Events and notes share the task statuses and are not executable, so
  they never appear in plans.
- **Shape Up.** Pitches and scopes share one status list. New items default to the first initial
  status (`raw_idea`); pass `status: "uphill"` when capturing a scope.
- **Eisenhower.** The matrix is a sorting aid, not a workflow. Quadrants are statuses, which are
  moved by hand.

## Not a preset

| System                                                                                          | Why not                                                                                                                    |
| ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Eat the Frog, Ivy Lee method, 1-3-5 rule, Rule of 3 (Getting Results the Agile Way, J.D. Meier) | Plan-size habits: they limit how many items go in a day's plan, not how items move through states. Use plans, not presets. |
| Zen to Done (Leo Babauta)                                                                       | Ten habits; its core (collect, process, plan, do) has the same shape as `gtd-lite`.                                        |
| Time blocking                                                                                   | Scheduling technique, not a state machine. Waypoint has no time-of-day model.                                              |
| Pomodoro                                                                                        | A timer technique; no item states.                                                                                         |
| Zettelkasten                                                                                    | A note-linking system; Waypoint stores no notes or links between items.                                                    |
| Habit trackers ("don't break the chain")                                                        | Need recurrence, which presets cannot express.                                                                             |

## Usage

Presets outside the bundled list must be passed as an **absolute** path to a `.json` file.

```sh
node dist/cli/main.js init --db <absolute path to new .db> --preset <absolute path to the json>
node dist/cli/main.js doctor --db <same db path> --preset <same json path>
```

For the MCP server, set `WAYPOINT_DB` and `WAYPOINT_PRESET` to the same absolute paths.

**A store is bound to its preset forever.** The first open records the preset snapshot, and later
opens with an incompatible preset are refused. Use a new `--db` for each system. To check a file
without creating a store, run `doctor` with a `--db` path that does not exist yet.
