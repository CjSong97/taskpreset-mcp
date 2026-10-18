# Metrics

`get_metrics` returns deterministic counts computed from stored timestamps and committed plans.
No XP, streaks, velocity, scores or estimates are produced or implied.

## Time conventions

- Every store has one IANA timezone (default `Europe/London`).
- A request names an inclusive range of **local calendar dates** `from`…`to` (both default to
  today in the store timezone; at most 366 days).
- The range becomes a half-open UTC interval `[start_utc, end_utc)`: `start_utc` is local midnight
  at the start of `from` and `end_utc` is local midnight at the start of the day after `to`. The
  lower bound is inclusive and the upper bound exclusive.
- Local days are **not** assumed to be 24 hours. In Europe/London the spring-forward day is 23
  hours and the autumn day is 25 hours.
- The response echoes `timezone`, `from`, `to`, `start_utc`, `end_utc` and `as_of` (the instant
  the current-state metric was read). Tests inject a clock.

## Definitions

| Metric                    | Definition                                                                                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `completed_count`         | Executable items whose `completed_at` falls within `[start_utc, end_utc)`. Containers (non-executable types such as projects and goals) are excluded. |
| `current_open_count`      | Executable items whose status is in the `open` category **at `as_of`**. This is a current snapshot, **not** a historical backlog for the range.       |
| `planned_count`           | Number of members in the committed revision of the plan for a local date D (the latest saved revision; `revision` is returned).                       |
| `completed_planned_count` | Members of that plan whose `completed_at` falls within local day D: `[start(D), start(D+1))`. Completions before or after day D do not count.         |
| `plan_completion_ratio`   | `completed_planned_count / planned_count`; `null` when `planned_count` is 0.                                                                          |

Consequences:

- Completing an item again never adds credit: `completed_at` is set once and never changes.
- A cancelled plan member stays in `planned_count`; cancelling planned work does **not** shrink the
  denominator. It simply never becomes completed.
- Work completed late (after the plan's local day) counts in `completed_count` for the day it was
  finished, but not as completed planned work.
- `daily_plans` lists only dates in the range that have a committed plan, in date order. A date
  without a plan contributes no entry (rather than a 0/0 row).

## Hand-calculated fixtures

These fixtures live in `tests/fixtures/metrics.ts` and are asserted exactly.

### Basic day — Tuesday 20 October 2026 (BST, UTC+1)

Local day = `[2026-10-19T23:00Z, 2026-10-20T23:00Z)`.

| Time (UTC)  | Event                                           |
| ----------- | ----------------------------------------------- |
| 10-20 07:00 | Capture tasks t1–t5 and project p1              |
| 07:05       | Plan 10-20 = [t1, t2, t3] (revision 1)          |
| 07:10       | Replace plan with [t1, t2, t3, t4] (revision 2) |
| 09:00       | Complete t1                                     |
| 10:00       | Cancel t2                                       |
| 12:00       | Complete p1 (container)                         |
| 13:00       | Complete t1 again (no effect)                   |
| 22:30       | Complete t3 (23:30 local, same day)             |
| 23:30       | Complete t4 (00:30 local on 21 Oct, late)       |

Queried at 2026-10-21T08:00Z for 10-20: `completed_count` = 2 (t1, t3); `current_open_count` = 1
(t5); plan revision 2, `planned_count` 4, `completed_planned_count` 2, ratio 0.5. For 10-20…10-21:
`completed_count` = 3 (t1, t3, t4); the same single plan entry.

### Spring forward — Sunday 29 March 2026 (23-hour day)

Local day = `[2026-03-29T00:00Z, 2026-03-29T23:00Z)`. Tasks a–d captured and planned for 29 March
on the 28th, then completed at:

- a — `2026-03-29T00:00:00.000Z` (local midnight; inclusive → counts)
- b — `2026-03-28T23:59:59.999Z` (previous local day)
- c — `2026-03-29T22:59:59.999Z` (23:59:59.999 BST → counts)
- d — `2026-03-29T23:00:00.000Z` (00:00 BST on the 30th; exclusive → excluded)

For 29 March: `completed_count` 2, `planned_count` 4, `completed_planned_count` 2, ratio 0.5. A
24-hour day would wrongly include d. For 28 March: `completed_count` 1 (b), no plan entry.

### Fall back — Sunday 25 October 2026 (25-hour day)

Local day = `[2026-10-24T23:00Z, 2026-10-26T00:00Z)`. Tasks a–d captured on the 24th; a, b and c
planned for 25 October. Completed at:

- a — `2026-10-24T23:00:00.000Z` (local midnight, BST; inclusive → counts)
- d — `2026-10-25T01:30:00.000Z` (01:30 GMT, after the repeated hour; unplanned → counts in
  `completed_count` only)
- b — `2026-10-25T23:30:00.000Z` (23:30 GMT → counts; a 24-hour day would exclude it)
- c — `2026-10-26T00:00:00.000Z` (local midnight on the 26th; exclusive → excluded)

For 25 October: `completed_count` 3 (a, b, d), `planned_count` 3, `completed_planned_count` 2,
ratio 2/3.

### Empty cases

- Empty store: `completed_count` 0, `current_open_count` 0, `daily_plans` [].
- Empty committed plan: `planned_count` 0, `completed_planned_count` 0, ratio `null`.
