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

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

/** Offset of `timezone` from UTC at `instant`, in milliseconds (positive east of Greenwich). */
function offsetMs(instant: number, timezone: string): number {
  let format = offsetFormatters.get(timezone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    offsetFormatters.set(timezone, format);
  }
  const parts = format.formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const wallClockAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return wallClockAsUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * The first instant of local calendar `date` in `timezone`. Local days are not assumed to be 24
 * hours long: each boundary is resolved from the zone's actual offset at that moment.
 */
export function startOfLocalDay(date: string, timezone: string): Date {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  const wallMidnight = Date.UTC(y, m - 1, d);
  let instant = wallMidnight - offsetMs(wallMidnight, timezone);
  instant = wallMidnight - offsetMs(instant, timezone);
  // If local midnight does not exist (a DST gap at 00:00), the day starts at the gap's end.
  while (localDate(new Date(instant), timezone) < date) instant += 15 * 60 * 1000;
  return new Date(instant);
}

/** Calendar arithmetic on YYYY-MM-DD strings, independent of any timezone. */
export function addDays(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number) as [number, number, number];
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}
