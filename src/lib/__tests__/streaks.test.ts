import { describe, expect, it } from "vitest";
import { computeStreak, streakSeries, type TargetRow } from "@/lib/streaks";

const t = (effectiveDate: string, calorieTarget: number): TargetRow => ({
  effectiveDate,
  calorieTarget,
  proteinTargetG: 135,
  carbTargetG: 360,
  fatTargetG: 80,
});

const TODAY = "2026-07-18";

describe("computeStreak", () => {
  it("counts consecutive hit days ending yesterday", () => {
    const days = [
      { date: "2026-07-15", calories: 2800 },
      { date: "2026-07-16", calories: 2750 },
      { date: "2026-07-17", calories: 2900 },
    ];
    const s = computeStreak(days, [t("2026-07-01", 2700)], TODAY, 0, 2700);
    expect(s.count).toBe(3);
    expect(s.todayHit).toBe(false);
  });

  it("a missing day is a miss — bulking has no rest days from eating", () => {
    const days = [
      { date: "2026-07-15", calories: 2800 },
      // 16th missing
      { date: "2026-07-17", calories: 2900 },
    ];
    const s = computeStreak(days, [t("2026-07-01", 2700)], TODAY, 0, 2700);
    expect(s.count).toBe(1);
  });

  it("today adds to the streak only at the crossing moment", () => {
    const days = [{ date: "2026-07-17", calories: 2800 }];
    const before = computeStreak(days, [t("2026-07-01", 2700)], TODAY, 2699, 2700);
    expect(before.count).toBe(1);
    expect(before.todayHit).toBe(false);
    const after = computeStreak(days, [t("2026-07-01", 2700)], TODAY, 2700, 2700);
    expect(after.count).toBe(2);
    expect(after.todayHit).toBe(true);
  });

  it("target changes never rewrite history — each day judged by its own target", () => {
    const days = [
      { date: "2026-07-16", calories: 2750 }, // hit vs 2700
      { date: "2026-07-17", calories: 2750 }, // hit vs 2700 (raise effective today)
    ];
    const targets = [t("2026-07-01", 2700), t(TODAY, 3000)];
    const s = computeStreak(days, targets, TODAY, 0, 2700);
    expect(s.count).toBe(2);
    expect(s.todayTarget).toBe(3000);
  });

  it("empty target history falls back to current settings", () => {
    const days = [{ date: "2026-07-17", calories: 2750 }];
    const s = computeStreak(days, [], TODAY, 0, 2700);
    expect(s.count).toBe(1);
  });

  it("dates before the earliest target row use the earliest row", () => {
    const days = [
      { date: "2026-07-16", calories: 2500 }, // vs earliest row 2400 → hit
      { date: "2026-07-17", calories: 2500 }, // vs 2400 → hit
    ];
    const s = computeStreak(days, [t("2026-07-17", 2400)], TODAY, 0, 9999);
    expect(s.count).toBe(2);
  });
});

describe("streakSeries", () => {
  it("returns windowDays points, oldest first, ending today", () => {
    const s = streakSeries([], [], TODAY, 0, 2700, 7);
    expect(s).toHaveLength(7);
    expect(s[0].date).toBe("2026-07-12");
    expect(s[6].date).toBe(TODAY);
  });

  it("marks hit days against their own target and flags unlogged days", () => {
    const days = [
      { date: "2026-07-16", calories: 2800 }, // hit
      { date: "2026-07-17", calories: 2000 }, // logged miss
      // TODAY handled by the live sum below
    ];
    const s = streakSeries(days, [t("2026-07-01", 2700)], TODAY, 0, 2700, 4);
    // window: 07-15, 07-16, 07-17, 07-18(today)
    const byDate = Object.fromEntries(s.map((p) => [p.date, p]));
    expect(byDate["2026-07-15"]).toMatchObject({ hit: false, logged: false });
    expect(byDate["2026-07-16"]).toMatchObject({ hit: true, logged: true });
    expect(byDate["2026-07-17"]).toMatchObject({ hit: false, logged: true });
    expect(byDate[TODAY]).toMatchObject({ hit: false, logged: false });
  });

  it("today reads the live sum, not the closed-day history", () => {
    const s = streakSeries([], [t("2026-07-01", 2700)], TODAY, 2750, 2700, 3);
    const today = s[s.length - 1];
    expect(today.date).toBe(TODAY);
    expect(today.calories).toBe(2750);
    expect(today.hit).toBe(true);
    expect(today.logged).toBe(true);
  });
});
