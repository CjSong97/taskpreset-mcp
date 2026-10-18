export const DEFAULT_TIMEZONE = "Europe/London";

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
