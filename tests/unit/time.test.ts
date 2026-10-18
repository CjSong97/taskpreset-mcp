import { describe, expect, it } from "vitest";
import { addDays, daysBetween, localDate, startOfLocalDay } from "../../src/domain/time.js";

const LONDON = "Europe/London";

describe("startOfLocalDay", () => {
  it.each([
    ["2026-01-15", "2026-01-15T00:00:00.000Z"], // GMT
    ["2026-07-15", "2026-07-14T23:00:00.000Z"], // BST
    ["2026-03-29", "2026-03-29T00:00:00.000Z"], // spring-forward day starts in GMT
    ["2026-03-30", "2026-03-29T23:00:00.000Z"],
    ["2026-10-25", "2026-10-24T23:00:00.000Z"], // fall-back day starts in BST
    ["2026-10-26", "2026-10-26T00:00:00.000Z"],
  ])("London %s starts at %s", (date, expected) => {
    expect(startOfLocalDay(date, LONDON).toISOString()).toBe(expected);
  });

  it("gives 23- and 25-hour London days at the DST transitions", () => {
    const hours = (date: string) =>
      (startOfLocalDay(addDays(date, 1), LONDON).getTime() -
        startOfLocalDay(date, LONDON).getTime()) /
      3_600_000;
    expect(hours("2026-03-29")).toBe(23);
    expect(hours("2026-10-25")).toBe(25);
    expect(hours("2026-06-01")).toBe(24);
  });

  it("handles other zones, including a midnight DST gap", () => {
    expect(startOfLocalDay("2026-10-18", "America/New_York").toISOString()).toBe(
      "2026-10-18T04:00:00.000Z",
    );
    expect(startOfLocalDay("2026-10-18", "Asia/Kolkata").toISOString()).toBe(
      "2026-10-17T18:30:00.000Z",
    );
    // Santiago springs forward at local midnight; 2026-09-06 begins at 01:00 local (-03).
    const santiago = startOfLocalDay("2026-09-06", "America/Santiago");
    expect(localDate(santiago, "America/Santiago")).toBe("2026-09-06");
    expect(localDate(new Date(santiago.getTime() - 1), "America/Santiago")).toBe("2026-09-05");
  });
});

describe("calendar arithmetic", () => {
  it("adds days across month and year ends", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-01-01", "2026-12-31")).toBe(364);
    expect(daysBetween("2026-10-25", "2026-10-26")).toBe(1);
  });
});
