/**
 * Diagnostics go to stderr as JSON lines; stdout is reserved for MCP protocol traffic.
 * Callers pass identifiers and counts only — never item titles, descriptions or tags.
 */
export type LogFields = Record<string, string | number | boolean | null | undefined>;

export function log(level: "info" | "warn" | "error", event: string, fields: LogFields = {}): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, event, ...fields });
  process.stderr.write(`${line}\n`);
}
