import { describe, expect, it } from "vitest";
import {
  addDays,
  daysBetween,
  formatFullDate,
  formatShortDate,
  getAppDate,
  startOfWeek,
  toISODate,
} from "@/lib/dates";

/** Local-time Date at a given wall-clock, matching how the app constructs dates. */
function at(y: number, m: number, d: number, h = 12, min = 0): Date {
  return new Date(y, m - 1, d, h, min);
}

describe("getAppDate — the 3 AM rollover", () => {
  it("a mid-afternoon moment belongs to that calendar day", () => {
    expect(getAppDate(at(2026, 7, 18, 15))).toBe("2026-07-18");
  });

  it("a 12:30 AM post-workout meal still counts toward the previous waking day", () => {
    expect(getAppDate(at(2026, 7, 19, 0, 30))).toBe("2026-07-18");
  });

  it("2:59 AM is still the prior day; 3:00 AM crosses over", () => {
    expect(getAppDate(at(2026, 7, 19, 2, 59))).toBe("2026-07-18");
    expect(getAppDate(at(2026, 7, 19, 3, 0))).toBe("2026-07-19");
  });

  it("rolls the month at the boundary", () => {
    expect(getAppDate(at(2026, 8, 1, 1))).toBe("2026-07-31");
  });
});

describe("toISODate", () => {
  it("zero-pads month and day", () => {
    expect(toISODate(at(2026, 1, 5))).toBe("2026-01-05");
  });
});

describe("addDays", () => {
  it("adds and subtracts within a month", () => {
    expect(addDays("2026-07-18", 3)).toBe("2026-07-21");
    expect(addDays("2026-07-18", -3)).toBe("2026-07-15");
  });

  it("crosses month boundaries in both directions", () => {
    expect(addDays("2026-07-31", 1)).toBe("2026-08-01");
    expect(addDays("2026-08-01", -1)).toBe("2026-07-31");
  });

  it("crosses a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles the leap-day boundary (2028 is a leap year)", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
  });
});

describe("daysBetween", () => {
  it("counts forward spans", () => {
    expect(daysBetween("2026-07-01", "2026-07-08")).toBe(7);
  });

  it("is negative when the target precedes the origin", () => {
    expect(daysBetween("2026-07-08", "2026-07-01")).toBe(-7);
  });

  it("is zero for the same day", () => {
    expect(daysBetween("2026-07-18", "2026-07-18")).toBe(0);
  });

  it("spans across a month boundary", () => {
    expect(daysBetween("2026-07-30", "2026-08-02")).toBe(3);
  });

  it("stays whole across a spring-forward DST transition", () => {
    // US DST 2026 begins Mar 8; a naive ms/86.4M would round to 6.96 → 7 here
    expect(daysBetween("2026-03-05", "2026-03-12")).toBe(7);
  });
});

describe("startOfWeek", () => {
  it("returns the same day when the date is already a Monday", () => {
    // 2026-07-13 is a Monday
    expect(startOfWeek("2026-07-13")).toBe("2026-07-13");
  });

  it("walks back to Monday from later in the week", () => {
    // 2026-07-18 is a Saturday → Monday the 13th
    expect(startOfWeek("2026-07-18")).toBe("2026-07-13");
  });

  it("treats Sunday as the end of the week, not the start", () => {
    // 2026-07-19 is a Sunday → still the week of Monday the 13th
    expect(startOfWeek("2026-07-19")).toBe("2026-07-13");
  });
});

describe("formatFullDate / formatShortDate", () => {
  it("renders a human-friendly full date", () => {
    expect(formatFullDate("2026-07-18")).toBe("Saturday, July 18");
  });

  it("renders a compact short date", () => {
    expect(formatShortDate("2026-07-18")).toBe("Jul 18");
  });
});
