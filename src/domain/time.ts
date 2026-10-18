export const DEFAULT_TIMEZONE = "Europe/London";

/** Injectable source of the current instant. */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The calendar date (YYYY-MM-DD) of `instant` in `timezone`. */
export function localDate(instant: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** True for a real calendar date in strict YYYY-MM-DD form (e.g. rejects 2026-02-30). */
export function isValidDateOnly(value: string): boolean {
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
