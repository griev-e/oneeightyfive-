import { describe, expect, it } from "vitest";
import {
  buildPlan,
  estimateObservedTdee,
  projectionSeries,
  projectTimeline,
  type PlanContext,
  type PlanInputs,
} from "@/lib/plan";
import { addDays } from "@/lib/dates";

const TODAY = "2026-07-18";

const kevin: PlanInputs = {
  sex: "male",
  birthDate: "2003-05-01", // 23 at TODAY
  heightIn: 73,
  currentWeightLbs: 126,
  bodyFatPct: 12.5,
  neatTier: "light",
  liftDaysPerWeek: 4,
  sessionMin: 75,
  cardioMinPerWeek: 0,
  trainingMonths: 6,
  trainingMonthsAsOf: TODAY,
  appetite: "struggle",
  bulkStyle: "standard",
  goalWeightLbs: 185,
  rateOverride: null,
};

const baseCtx: PlanContext = {
  today: TODAY,
  weighIns: [{ date: TODAY, weightLbs: 126 }],
  currentCalorieTarget: 2700,
  paceBand: null,
  observed: null,
};

describe("buildPlan — the Kevin fixture, digit for digit", () => {
  const plan = buildPlan(kevin, baseCtx);

  it("BMR = 1535 (50/50 Mifflin-St Jeor / Katch-McArdle)", () => {
    expect(plan.bmr).toBe(1535);
  });
  it("formula TDEE = 2466 (1535 × 1.50 light NEAT + 163/day training)", () => {
    expect(plan.formulaTDEE).toBe(2466);
  });
  it("recommended rate = 0.45 lb/wk (novice standard 1.25%/mo + 0.25 underweight boost)", () => {
    expect(plan.recommendedRateLbsPerWeek).toBeCloseTo(0.45, 10);
    expect(plan.trainingTier).toBe("novice");
    expect(plan.flags.underweightBoost).toBe(true);
  });
  it("surplus hits the 250 kcal underweight floor (raw 161 is inside formula noise)", () => {
    expect(plan.surplusPerDay).toBe(250);
    expect(plan.kcalPerLb).toBe(2510); // p = 0.70
  });
  it("calorie target = 2725, not floored (2725 > current 2700)", () => {
    expect(plan.computedCalorieTarget).toBe(2725);
    expect(plan.calorieTarget).toBe(2725);
    expect(plan.flags.flooredToCurrent).toBe(false);
  });
  it("macros: P 100 / F 90 / C 380, fiber guideline 40", () => {
    expect(plan.proteinG).toBe(100);
    expect(plan.fatG).toBe(90);
    expect(plan.carbG).toBe(380);
    expect(plan.fiberGuidelineG).toBe(40);
  });
  it("macro kcal drift stays within ±30 of the target", () => {
    const kcal = 4 * plan.proteinG + 9 * plan.fatG + 4 * plan.carbG;
    expect(Math.abs(kcal - plan.calorieTarget)).toBeLessThanOrEqual(30);
  });
  it("59 lb at a tapering rate lands honestly at ~4.9 years", () => {
    expect(plan.projection).toEqual({
      kind: "date",
      projectedDate: "2031-06-21",
      weeks: 257,
    });
  });
});

describe("buildPlan — guardrails", () => {
  it("never cuts a bulk that isn't ahead of pace (floor at current target)", () => {
    const plan = buildPlan(kevin, { ...baseCtx, currentCalorieTarget: 2800 });
    expect(plan.computedCalorieTarget).toBe(2725);
    expect(plan.calorieTarget).toBe(2800);
    expect(plan.flags.flooredToCurrent).toBe(true);
  });
  it("allows the cut when the trend is ahead of pace", () => {
    const plan = buildPlan(kevin, {
      ...baseCtx,
      currentCalorieTarget: 2800,
      paceBand: "ahead",
    });
    expect(plan.calorieTarget).toBe(2725);
    expect(plan.flags.flooredToCurrent).toBe(false);
  });
  it("at goal weight → maintenance, zero surplus, at-goal projection", () => {
    const plan = buildPlan(
      { ...kevin, goalWeightLbs: 120 },
      { ...baseCtx, currentCalorieTarget: 2500 },
    );
    expect(plan.flags.atGoal).toBe(true);
    expect(plan.surplusPerDay).toBe(0);
    expect(plan.rateLbsPerWeek).toBe(0);
    expect(plan.projection.kind).toBe("at-goal");
  });
  it("training age self-advances from its as-of date (novice → intermediate)", () => {
    const plan = buildPlan(
      { ...kevin, trainingMonths: 6, trainingMonthsAsOf: "2025-07-18" },
      baseCtx,
    );
    expect(plan.trainingTier).toBe("intermediate"); // 6 + ~12 elapsed
  });
  it("blends observed TDEE when logging evidence exists", () => {
    const plan = buildPlan(kevin, {
      ...baseCtx,
      observed: { observedTDEE: 2800, confidence: 0.5 },
    });
    expect(plan.observedTDEE).toBe(2800);
    expect(plan.blendedTDEE).toBe(Math.round(0.5 * 2800 + 0.5 * 2466));
  });
  it("clamps an implausible observed TDEE to ±25% of formula", () => {
    const plan = buildPlan(kevin, {
      ...baseCtx,
      observed: { observedTDEE: 5000, confidence: 1 },
    });
    expect(plan.observedTDEE).toBe(Math.round(1.25 * 2466));
  });
  it("rate override is clamped and marks the plan custom", () => {
    const plan = buildPlan({ ...kevin, rateOverride: 3 }, baseCtx);
    expect(plan.rateLbsPerWeek).toBe(1.0);
    expect(plan.rateSource).toBe("custom");
  });
});

describe("estimateObservedTdee", () => {
  const targets = () => 2700;
  const mkDays = (n: number, calories: number) =>
    Array.from({ length: n }, (_, i) => ({
      date: `2026-06-${String(19 + i).padStart(2, "0")}`,
      calories,
      entryCount: 3,
    }));

  it("returns null with fewer than 14 well-logged days", () => {
    expect(
      estimateObservedTdee(mkDays(5, 2700), targets, [], 0.7, "2026-07-18"),
    ).toBeNull();
  });
  it("a lone snack day does not count as logged", () => {
    const days = mkDays(20, 2700).map((d) => ({
      ...d,
      calories: 200,
      entryCount: 1,
    }));
    expect(
      estimateObservedTdee(days, targets, [], 0.7, "2026-07-18"),
    ).toBeNull();
  });
});

describe("projectionSeries", () => {
  it("starts at the anchor and rises monotonically to the goal", () => {
    const series = projectionSeries(126, 185, 6, "standard", 73, null, TODAY);
    expect(series[0]).toEqual({ date: TODAY, weightLbs: 126 });
    for (let i = 1; i < series.length; i++) {
      expect(series[i].weightLbs).toBeGreaterThan(series[i - 1].weightLbs);
      expect(series[i].date).toBe(addDays(TODAY, i * 7));
    }
    expect(series[series.length - 1].weightLbs).toBeGreaterThanOrEqual(185);
  });

  it("lands on the same date projectTimeline reports", () => {
    const series = projectionSeries(126, 185, 6, "standard", 73, null, TODAY);
    const timeline = projectTimeline(126, 185, 6, "standard", 73, null, TODAY);
    expect(timeline).toEqual({
      kind: "date",
      projectedDate: series[series.length - 1].date,
      weeks: series.length - 1,
    });
  });

  it("tapers the slope as the lifter crosses a training-age tier", () => {
    // starts novice (6 months); by week 30 the sim has crossed into
    // intermediate territory and weekly gains must have shrunk
    const series = projectionSeries(150, 200, 6, "standard", 73, null, TODAY);
    const early = series[4].weightLbs - series[3].weightLbs;
    const late = series[40].weightLbs - series[39].weightLbs;
    expect(late).toBeLessThan(early);
  });

  it("holds a constant slope under a manual rate override", () => {
    const series = projectionSeries(150, 160, 6, "standard", 73, 0.5, TODAY);
    for (let i = 1; i < series.length; i++) {
      expect(series[i].weightLbs - series[i - 1].weightLbs).toBeCloseTo(0.5);
    }
  });

  it("caps an unreachable goal at 260 weeks (projectTimeline: open-ended)", () => {
    const series = projectionSeries(150, 5000, 40, "lean", 73, null, TODAY);
    expect(series).toHaveLength(261);
    expect(projectTimeline(150, 5000, 40, "lean", 73, null, TODAY)).toEqual({
      kind: "open-ended",
    });
  });

  it("returns only the anchor when already at goal", () => {
    expect(projectionSeries(185, 185, 6, "standard", 73, null, TODAY)).toEqual([
      { date: TODAY, weightLbs: 185 },
    ]);
  });
});
