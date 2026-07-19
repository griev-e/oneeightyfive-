import { describe, expect, it } from "vitest";
import { macroAdherence, nutritionSeries, type DayMacros } from "@/lib/history";
import type { TargetRow } from "@/lib/streaks";

const TODAY = "2026-07-18";
const FALLBACK = { calories: 2700, protein: 135, carbs: 360, fat: 80 };

const day = (date: string, over: Partial<DayMacros> = {}): DayMacros => ({
  date,
  calories: 2800,
  proteinG: 140,
  carbsG: 350,
  fatG: 85,
  ...over,
});

const target = (effectiveDate: string, over: Partial<TargetRow> = {}): TargetRow => ({
  effectiveDate,
  calorieTarget: 2700,
  proteinTargetG: 135,
  carbTargetG: 360,
  fatTargetG: 80,
  ...over,
});

describe("nutritionSeries", () => {
  it("excludes today (closed-days doctrine) and days outside the window", () => {
    const out = nutritionSeries(
      [day("2026-05-01"), day("2026-07-16"), day("2026-07-17"), day(TODAY)],
      [target("2026-07-01")],
      "calories",
      TODAY,
      FALLBACK,
    );
    expect(out.data.map((p) => p.date)).toEqual(["2026-07-16", "2026-07-17"]);
  });

  it("omits missing days rather than zero-filling them", () => {
    const out = nutritionSeries(
      [day("2026-07-10"), day("2026-07-17")],
      [target("2026-07-01")],
      "calories",
      TODAY,
      FALLBACK,
    );
    // a 6-day gap stays a gap — two points, no fabricated zeros
    expect(out.data).toHaveLength(2);
  });

  it("returns empty series below two closed days", () => {
    const out = nutritionSeries(
      [day("2026-07-17"), day(TODAY)],
      [],
      "calories",
      TODAY,
      FALLBACK,
    );
    expect(out).toEqual({ data: [], avg: [], guide: [] });
  });

  it("selects the metric per mode with macro sums as values", () => {
    const days = [day("2026-07-16", { proteinG: 120 }), day("2026-07-17", { proteinG: 150 })];
    const out = nutritionSeries(days, [target("2026-07-01")], "protein", TODAY, FALLBACK);
    expect(out.data.map((p) => p.weightLbs)).toEqual([120, 150]);
  });

  it("steps the guide when the target changed mid-window", () => {
    const out = nutritionSeries(
      [day("2026-07-15"), day("2026-07-16"), day("2026-07-17")],
      [
        target("2026-07-01", { calorieTarget: 2700 }),
        target("2026-07-17", { calorieTarget: 2900 }),
      ],
      "calories",
      TODAY,
      FALLBACK,
    );
    expect(out.guide.map((p) => p.weightLbs)).toEqual([2700, 2700, 2900]);
    expect(out.guide.map((p) => p.date)).toEqual([
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
    ]);
  });

  it("falls back to current settings when target history is empty", () => {
    const out = nutritionSeries(
      [day("2026-07-16"), day("2026-07-17")],
      [],
      "fat",
      TODAY,
      FALLBACK,
    );
    expect(out.guide.every((p) => p.weightLbs === 80)).toBe(true);
  });
});

describe("macroAdherence", () => {
  it("judges each day against the target in force that day", () => {
    const out = macroAdherence(
      [
        day("2026-07-15", { calories: 2750 }), // ≥ 2700 → hit
        day("2026-07-16", { calories: 2600 }), // < 2700 → miss
        day("2026-07-17", { calories: 2950 }), // ≥ 2900 (new target) → hit
      ],
      [target("2026-07-01"), target("2026-07-17", { calorieTarget: 2900 })],
      "calories",
      TODAY,
      FALLBACK,
    );
    expect(out).toEqual({ hit: 2, logged: 3 });
  });

  it("excludes today and out-of-window days; unlogged days are not misses", () => {
    const out = macroAdherence(
      [day("2026-05-01"), day("2026-07-16"), day(TODAY)],
      [target("2026-07-01")],
      "calories",
      TODAY,
      FALLBACK,
    );
    expect(out).toEqual({ hit: 1, logged: 1 });
  });

  it("falls back to current settings when history predates target_history", () => {
    const out = macroAdherence(
      [day("2026-07-16", { fatG: 85 })],
      [],
      "fat",
      TODAY,
      FALLBACK,
    );
    expect(out).toEqual({ hit: 1, logged: 1 });
  });
});
