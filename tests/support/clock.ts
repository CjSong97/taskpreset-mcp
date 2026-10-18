import type { Clock } from "../../src/domain/time.js";

export interface TestClock extends Clock {
  set(iso: string): void;
  advance(ms: number): void;
}

/** A controllable clock for deterministic tests. */
export function testClock(start = "2026-10-18T09:00:00.000Z"): TestClock {
  let current = new Date(start).getTime();
  return {
    now: () => new Date(current),
    set: (iso) => {
      current = new Date(iso).getTime();
    },
    advance: (ms) => {
      current += ms;
    },
  };
}
