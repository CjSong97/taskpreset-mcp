import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";

const dirs: string[] = [];

/** A fresh temporary directory, removed after the current test. */
export function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), "taskpreset-test-"));
  dirs.push(dir);
  return dir;
}

/** A path for a not-yet-created store inside a fresh temporary directory. */
export function tempDbPath(): string {
  return join(tempDir(), "store.db");
}

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
});
