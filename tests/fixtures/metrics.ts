/**
 * Hand-calculated metric fixtures (Avatar-lite, Europe/London). See docs/metrics.md for the
 * reasoning behind each expected value. Steps run in order with the clock set to `at`.
 */
export type Step =
  | { at: string; capture: string; type?: "task" | "project" }
  | { at: string; complete: string }
  | { at: string; cancel: string }
  | { at: string; plan: string; members: string[]; expectedRevision?: number };

export interface DailyPlanExpectation {
  date: string;
  revision: number;
  planned_count: number;
  completed_planned_count: number;
  plan_completion_ratio: number | null;
}

export interface MetricQuery {
  at: string;
  from?: string;
  to?: string;
  expected: {
    start_utc: string;
    end_utc: string;
    completed_count: number;
    current_open_count: number;
    daily_plans: DailyPlanExpectation[];
  };
}

export interface MetricFixture {
  name: string;
  steps: Step[];
  queries: MetricQuery[];
}

export const METRIC_FIXTURES: readonly MetricFixture[] = [
  {
    name: "basic BST day with replan, cancellation, container and late completion",
    steps: [
      { at: "2026-10-20T07:00:00.000Z", capture: "t1" },
      { at: "2026-10-20T07:00:01.000Z", capture: "t2" },
      { at: "2026-10-20T07:00:02.000Z", capture: "t3" },
      { at: "2026-10-20T07:00:03.000Z", capture: "t4" },
      { at: "2026-10-20T07:00:04.000Z", capture: "t5" },
      { at: "2026-10-20T07:00:05.000Z", capture: "p1", type: "project" },
      { at: "2026-10-20T07:05:00.000Z", plan: "2026-10-20", members: ["t1", "t2", "t3"] },
      {
        at: "2026-10-20T07:10:00.000Z",
        plan: "2026-10-20",
        members: ["t1", "t2", "t3", "t4"],
        expectedRevision: 1,
      },
      { at: "2026-10-20T09:00:00.000Z", complete: "t1" },
      { at: "2026-10-20T10:00:00.000Z", cancel: "t2" },
      { at: "2026-10-20T12:00:00.000Z", complete: "p1" },
      { at: "2026-10-20T13:00:00.000Z", complete: "t1" },
      { at: "2026-10-20T22:30:00.000Z", complete: "t3" },
      { at: "2026-10-20T23:30:00.000Z", complete: "t4" },
    ],
    queries: [
      {
        at: "2026-10-21T08:00:00.000Z",
        from: "2026-10-20",
        to: "2026-10-20",
        expected: {
          start_utc: "2026-10-19T23:00:00.000Z",
          end_utc: "2026-10-20T23:00:00.000Z",
          completed_count: 2,
          current_open_count: 1,
          daily_plans: [
            {
              date: "2026-10-20",
              revision: 2,
              planned_count: 4,
              completed_planned_count: 2,
              plan_completion_ratio: 0.5,
            },
          ],
        },
      },
      {
        at: "2026-10-21T08:00:00.000Z",
        from: "2026-10-20",
        to: "2026-10-21",
        expected: {
          start_utc: "2026-10-19T23:00:00.000Z",
          end_utc: "2026-10-21T23:00:00.000Z",
          completed_count: 3,
          current_open_count: 1,
          daily_plans: [
            {
              date: "2026-10-20",
              revision: 2,
              planned_count: 4,
              completed_planned_count: 2,
              plan_completion_ratio: 0.5,
            },
          ],
        },
      },
    ],
  },
  {
    name: "spring-forward 23-hour day (29 March 2026)",
    steps: [
      { at: "2026-03-28T12:00:00.000Z", capture: "a" },
      { at: "2026-03-28T12:00:01.000Z", capture: "b" },
      { at: "2026-03-28T12:00:02.000Z", capture: "c" },
      { at: "2026-03-28T12:00:03.000Z", capture: "d" },
      { at: "2026-03-28T12:05:00.000Z", plan: "2026-03-29", members: ["a", "b", "c", "d"] },
      { at: "2026-03-28T23:59:59.999Z", complete: "b" },
      { at: "2026-03-29T00:00:00.000Z", complete: "a" },
      { at: "2026-03-29T22:59:59.999Z", complete: "c" },
      { at: "2026-03-29T23:00:00.000Z", complete: "d" },
    ],
    queries: [
      {
        at: "2026-03-30T12:00:00.000Z",
        from: "2026-03-29",
        to: "2026-03-29",
        expected: {
          start_utc: "2026-03-29T00:00:00.000Z",
          end_utc: "2026-03-29T23:00:00.000Z",
          completed_count: 2,
          current_open_count: 0,
          daily_plans: [
            {
              date: "2026-03-29",
              revision: 1,
              planned_count: 4,
              completed_planned_count: 2,
              plan_completion_ratio: 0.5,
            },
          ],
        },
      },
      {
        at: "2026-03-30T12:00:00.000Z",
        from: "2026-03-28",
        to: "2026-03-28",
        expected: {
          start_utc: "2026-03-28T00:00:00.000Z",
          end_utc: "2026-03-29T00:00:00.000Z",
          completed_count: 1,
          current_open_count: 0,
          daily_plans: [],
        },
      },
    ],
  },
  {
    name: "fall-back 25-hour day (25 October 2026)",
    steps: [
      { at: "2026-10-24T12:00:00.000Z", capture: "a" },
      { at: "2026-10-24T12:00:01.000Z", capture: "b" },
      { at: "2026-10-24T12:00:02.000Z", capture: "c" },
      { at: "2026-10-24T12:00:03.000Z", capture: "d" },
      { at: "2026-10-24T12:05:00.000Z", plan: "2026-10-25", members: ["a", "b", "c"] },
      { at: "2026-10-24T23:00:00.000Z", complete: "a" },
      { at: "2026-10-25T01:30:00.000Z", complete: "d" },
      { at: "2026-10-25T23:30:00.000Z", complete: "b" },
      { at: "2026-10-26T00:00:00.000Z", complete: "c" },
    ],
    queries: [
      {
        at: "2026-10-27T09:00:00.000Z",
        from: "2026-10-25",
        to: "2026-10-25",
        expected: {
          start_utc: "2026-10-24T23:00:00.000Z",
          end_utc: "2026-10-26T00:00:00.000Z",
          completed_count: 3,
          current_open_count: 0,
          daily_plans: [
            {
              date: "2026-10-25",
              revision: 1,
              planned_count: 3,
              completed_planned_count: 2,
              plan_completion_ratio: 2 / 3,
            },
          ],
        },
      },
    ],
  },
  {
    name: "empty store",
    steps: [],
    queries: [
      {
        at: "2026-10-18T09:00:00.000Z",
        expected: {
          start_utc: "2026-10-17T23:00:00.000Z",
          end_utc: "2026-10-18T23:00:00.000Z",
          completed_count: 0,
          current_open_count: 0,
          daily_plans: [],
        },
      },
    ],
  },
  {
    name: "empty committed plan",
    steps: [
      { at: "2026-10-18T08:00:00.000Z", capture: "x" },
      { at: "2026-10-18T08:01:00.000Z", plan: "2026-10-18", members: [] },
    ],
    queries: [
      {
        at: "2026-10-18T09:00:00.000Z",
        expected: {
          start_utc: "2026-10-17T23:00:00.000Z",
          end_utc: "2026-10-18T23:00:00.000Z",
          completed_count: 0,
          current_open_count: 1,
          daily_plans: [
            {
              date: "2026-10-18",
              revision: 1,
              planned_count: 0,
              completed_planned_count: 0,
              plan_completion_ratio: null,
            },
          ],
        },
      },
    ],
  },
];
