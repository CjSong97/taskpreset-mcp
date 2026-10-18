import { openApp, type App } from "../../src/app.js";
import { WaypointError, type WaypointErrorCode } from "../../src/domain/errors.js";
import { testClock, type TestClock } from "./clock.js";
import { tempDbPath } from "./tmp.js";
import { afterEach } from "vitest";

const open: App[] = [];

afterEach(() => {
  for (const app of open.splice(0)) app.close();
});

/** Open a real file-backed app in a temp directory; closed automatically after the test. */
export function testApp(
  options: { path?: string; preset?: string; clock?: TestClock } = {},
): App & { clock: TestClock; path: string } {
  const clock = options.clock ?? testClock();
  const path = options.path ?? tempDbPath();
  const app = openApp({ path, preset: options.preset, clock });
  open.push(app);
  return Object.assign(app, { clock, path });
}

/** Assert that `fn` throws a WaypointError with the given code; returns it. */
export function expectWaypointError(fn: () => unknown, code: WaypointErrorCode): WaypointError {
  try {
    fn();
  } catch (error) {
    if (error instanceof WaypointError && error.code === code) return error;
    throw new Error(
      `Expected WaypointError(${code}) but got ${error instanceof WaypointError ? `WaypointError(${error.code}): ${error.message}` : String(error)}`,
      { cause: error },
    );
  }
  throw new Error(`Expected WaypointError(${code}) but nothing was thrown`);
}

export function countItems(app: App): number {
  return (app.store.db.prepare("SELECT count(*) AS n FROM items").get() as { n: number }).n;
}
