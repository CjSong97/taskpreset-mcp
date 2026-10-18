/**
 * Reusable workflow fixtures: each describes how to exercise one preset through the same
 * engine. Tests iterate over these rather than branching on preset IDs.
 */
export interface WorkflowFixture {
  preset: string;
  /** Non-executable container type. */
  container: string;
  /** Executable work type that may sit under the container. */
  work: string;
  /** A type that may not be placed under `work`. */
  invalidChildOfWork: string;
  defaultStatus: string;
  /** A permitted open → open transition. */
  move: { from: string; to: string };
  cancelled: string;
  done: string;
  tag: string;
}

export const WORKFLOWS: readonly WorkflowFixture[] = [
  {
    preset: "avatar-lite",
    container: "project",
    work: "task",
    invalidChildOfWork: "goal",
    defaultStatus: "not_started",
    move: { from: "not_started", to: "in_progress" },
    cancelled: "cancelled",
    done: "done",
    tag: "Fire",
  },
  {
    preset: "gtd-lite",
    container: "project",
    work: "action",
    invalidChildOfWork: "project",
    defaultStatus: "inbox",
    move: { from: "inbox", to: "next" },
    cancelled: "cancelled",
    done: "done",
    tag: "@computer",
  },
];
