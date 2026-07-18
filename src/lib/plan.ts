/**
 * The target-computation engine. Pure functions, shared verbatim by the
 * /setup client preview and the /api/profile server (server authoritative —
 * both must produce identical digits). Every constant is here, nowhere else.
 *
 * Chain: BMR (Mifflin-St Jeor ⊕ Katch-McArdle when BF% known) → decomposed
 * TDEE (NEAT tier × BMR + MET-based exercise energy) → observed-TDEE blend
 * when real logging data exists → gain rate from %bodyweight/month by
 * training age → surplus via p-ratio energy density (not a flat 3500) →
 * protein/fat/carb split with hormonal floors — carbs absorb rounding last.
 */

import { addDays, daysBetween } from "./dates";
import { rollingAverage, type WeighIn } from "./stats";

export const KG_PER_LB = 0.45359237;
export const CM_PER_IN = 2.54;

export type Sex = "male" | "female";
export type NeatTier = "sitting" | "light" | "active" | "demanding";
export type Appetite = "easy" | "manageable" | "struggle";
export type BulkStyle = "lean" | "standard" | "aggressive";
export type TrainingTier = "novice" | "intermediate" | "advanced";

export type PlanInputs = {
  sex: Sex;
  birthDate: string; // YYYY-MM-DD
  heightIn: number;
  /** typed in the questionnaire; superseded by the RA of recent weigh-ins */
  currentWeightLbs: number;
  bodyFatPct: number | null;
  neatTier: NeatTier;
  liftDaysPerWeek: number;
  sessionMin: number;
  cardioMinPerWeek: number;
  trainingMonths: number;
  trainingMonthsAsOf: string; // YYYY-MM-DD
  appetite: Appetite;
  bulkStyle: BulkStyle;
  goalWeightLbs: number;
  /** manual rate override (lb/wk); null = use recommendation */
  rateOverride: number | null;
};

export type PlanContext = {
  today: string;
  weighIns: WeighIn[];
  /** the calorie target currently in force (floor rule input) */
  currentCalorieTarget: number;
  /** current weight-trend band from lib/stats computePace, if available */
  paceBand: "behind" | "on-pace" | "ahead" | null;
  /** observed-TDEE ingredients; null when logging history is insufficient */
  observed: ObservedTdee | null;
};

export type ObservedTdee = {
  observedTDEE: number;
  /** 0..1 — how much weight the observation carries in the blend */
  confidence: number;
};

export type Plan = {
  calorieTarget: number; // round25, floored at current unless pace "ahead"
  computedCalorieTarget: number; // pre-floor, for the old→new reveal
  proteinG: number;
  fatG: number;
  carbG: number;
  fiberGuidelineG: number; // display-only footnote
  rateLbsPerWeek: number;
  recommendedRateLbsPerWeek: number;
  rateSource: "recommended" | "custom";
  bmr: number;
  formulaTDEE: number;
  observedTDEE: number | null;
  blendedTDEE: number;
  confidence: number | null;
  surplusPerDay: number;
  kcalPerLb: number;
  leanFraction: number;
  trainingTier: TrainingTier;
  projection:
    | { kind: "date"; projectedDate: string; weeks: number }
    | { kind: "open-ended" }
    | { kind: "at-goal" };
  flags: {
    underweightBoost: boolean;
    carbFloorUnmet: boolean;
    flooredToCurrent: boolean;
    atGoal: boolean;
  };
  explain: Record<
    "calories" | "protein" | "fat" | "carbs" | "rate" | "tdee",
    string
  >;
};

export const round25 = (n: number) => Math.round(n / 25) * 25;
export const round5 = (n: number) => Math.round(n / 5) * 5;
export const roundTo = (n: number, step: number) =>
  Math.round(n / step) * step;
const clamp = (n: number, lo: number, hi: number) =>
  Math.min(Math.max(n, lo), hi);

const NEAT_FACTOR: Record<NeatTier, number> = {
  sitting: 1.35,
  light: 1.5,
  active: 1.65,
  demanding: 1.85,
};

/** %bodyweight per month by training age × bulk style */
const RATE_TABLE: Record<TrainingTier, Record<BulkStyle, number>> = {
  novice: { lean: 1.0, standard: 1.25, aggressive: 1.5 },
  intermediate: { lean: 0.5, standard: 0.75, aggressive: 1.0 },
  advanced: { lean: 0.25, standard: 0.375, aggressive: 0.5 },
};

const P_RATIO_BASE: Record<TrainingTier, number> = {
  novice: 0.6,
  intermediate: 0.5,
  advanced: 0.4,
};
const KCAL_PER_LB_LEAN = 2000;
const KCAL_PER_LB_FAT = 3700;

const PROTEIN_G_PER_LB: Record<Appetite, number> = {
  easy: 0.95,
  manageable: 0.9,
  struggle: 0.8,
};

const AVG_DAYS_PER_MONTH = 30.44;
const WEEKS_PER_MONTH = AVG_DAYS_PER_MONTH / 7;

export function ageAt(birthDate: string, today: string): number {
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return age;
}

/** Training age self-advances from its as-of date — a stored tier goes stale. */
export function effectiveTrainingMonths(
  trainingMonths: number,
  asOf: string,
  today: string,
): number {
  const elapsed = Math.max(daysBetween(asOf, today), 0) / AVG_DAYS_PER_MONTH;
  return trainingMonths + elapsed;
}

export function tierOf(months: number): TrainingTier {
  if (months < 12) return "novice";
  if (months <= 36) return "intermediate";
  return "advanced";
}

/** Planning weight: RA at the latest weigh-in; questionnaire value as fallback. */
export function planWeightLbs(
  weighIns: WeighIn[],
  fallback: number,
): number {
  if (weighIns.length === 0) return fallback;
  const ra = rollingAverage(weighIns);
  return ra[ra.length - 1].weightLbs;
}

export function kcalPerLbGained(leanFraction: number): number {
  return leanFraction * KCAL_PER_LB_LEAN + (1 - leanFraction) * KCAL_PER_LB_FAT;
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

export function buildPlan(inputs: PlanInputs, ctx: PlanContext): Plan {
  const heightIn = clamp(inputs.heightIn, 55, 90);
  const weight = clamp(
    planWeightLbs(ctx.weighIns, inputs.currentWeightLbs),
    80,
    400,
  );
  const age = clamp(ageAt(inputs.birthDate, ctx.today), 16, 80);
  const kg = weight * KG_PER_LB;
  const cm = heightIn * CM_PER_IN;
  const bmi = (703 * weight) / (heightIn * heightIn);
  const underweight = bmi < 18.5;

  // ---- BMR ----
  const msj = 10 * kg + 6.25 * cm - 5 * age + (inputs.sex === "male" ? 5 : -161);
  let bmr: number;
  if (inputs.bodyFatPct == null) {
    bmr = Math.round(msj);
  } else {
    const lbmKg = kg * (1 - inputs.bodyFatPct / 100);
    const kma = 370 + 21.6 * lbmKg;
    bmr = Math.round(0.5 * msj + 0.5 * kma);
  }

  // ---- TDEE (decomposed: NEAT tier on BMR + explicit exercise energy) ----
  const liftKcalPerSession = 4.0 * kg * (inputs.sessionMin / 60);
  const cardioKcalPerWeek = 5.0 * kg * (inputs.cardioMinPerWeek / 60);
  const dailyEAT =
    (inputs.liftDaysPerWeek * liftKcalPerSession + cardioKcalPerWeek) / 7;
  const formulaTDEE = Math.round(bmr * NEAT_FACTOR[inputs.neatTier] + dailyEAT);

  // ---- observed-TDEE blend: real logs + weight trend beat any formula ----
  const observedTDEE = ctx.observed
    ? Math.round(
        clamp(ctx.observed.observedTDEE, 0.75 * formulaTDEE, 1.25 * formulaTDEE),
      )
    : null;
  const confidence = ctx.observed?.confidence ?? null;
  const blendedTDEE =
    observedTDEE != null && confidence != null
      ? Math.round(confidence * observedTDEE + (1 - confidence) * formulaTDEE)
      : formulaTDEE;

  // ---- gain rate ----
  const months = effectiveTrainingMonths(
    inputs.trainingMonths,
    inputs.trainingMonthsAsOf,
    ctx.today,
  );
  const tier = tierOf(months);
  const atGoal = inputs.goalWeightLbs <= weight;
  const pctPerMonth = RATE_TABLE[tier][inputs.bulkStyle] + (underweight ? 0.25 : 0);
  const recommendedRate = atGoal
    ? 0
    : clamp(
        roundTo((pctPerMonth / 100) * weight / WEEKS_PER_MONTH, 0.05),
        0.1,
        1.0,
      );
  const rate =
    inputs.rateOverride != null && !atGoal
      ? clamp(roundTo(inputs.rateOverride, 0.05), 0.1, 1.0)
      : recommendedRate;

  // ---- surplus via p-ratio energy density ----
  const leanFraction = clamp(
    P_RATIO_BASE[tier] +
      (underweight ? 0.1 : 0) +
      (inputs.bulkStyle === "lean" ? 0.05 : 0) +
      (inputs.bulkStyle === "aggressive" ? -0.05 : 0),
    0.3,
    0.7,
  );
  const kcalPerLb = kcalPerLbGained(leanFraction);
  let surplusPerDay = atGoal ? 0 : (rate * kcalPerLb) / 7;
  // a surplus inside formula noise is no surplus at all for an underweight
  // bulker — enforce a real minimum
  if (!atGoal && underweight) surplusPerDay = Math.max(surplusPerDay, 250);
  surplusPerDay = Math.round(surplusPerDay);

  // ---- calorie target (clamped, floored at the current target) ----
  let computedTarget = round25(blendedTDEE + surplusPerDay);
  computedTarget = clamp(
    computedTarget,
    atGoal ? Math.round(1.2 * bmr) : Math.max(Math.round(1.2 * bmr), blendedTDEE + 50),
    blendedTDEE + 600,
  );
  computedTarget = round25(computedTarget);

  // Never quietly cut an in-progress bulk: keep the current target unless the
  // trend says we're already gaining faster than planned.
  const flooredToCurrent =
    !atGoal &&
    computedTarget < ctx.currentCalorieTarget &&
    ctx.paceBand !== "ahead";
  const calorieTarget = flooredToCurrent
    ? ctx.currentCalorieTarget
    : computedTarget;

  // ---- protein ----
  const useLbm = inputs.bodyFatPct != null && inputs.bodyFatPct >= 25;
  let proteinG = useLbm
    ? round5(1.05 * weight * (1 - (inputs.bodyFatPct as number) / 100))
    : round5(PROTEIN_G_PER_LB[inputs.appetite] * weight);
  proteinG = clamp(proteinG, round5(0.7 * weight), round5(1.2 * weight));

  // ---- fat (hormonal floor) ----
  const fatShare = inputs.appetite === "struggle" ? 0.3 : 0.25;
  let fatG = round5(
    Math.max((calorieTarget * fatShare) / 9, 0.3 * weight),
  );
  fatG = Math.min(fatG, round5((calorieTarget * 0.4) / 9));

  // ---- carbs absorb all rounding (computed last, unrounded remainder) ----
  let carbG = round5((calorieTarget - 4 * proteinG - 9 * fatG) / 4);
  const carbFloor = round5(3.0 * kg);
  let carbFloorUnmet = false;
  if (carbG < carbFloor) {
    // resolution order: fat down toward its floor, then protein toward 0.8 g/lb
    const fatFloor = round5(Math.max(0.3 * weight, (calorieTarget * 0.2) / 9));
    while (carbG < carbFloor && fatG > fatFloor) {
      fatG -= 5;
      carbG = round5((calorieTarget - 4 * proteinG - 9 * fatG) / 4);
    }
    const proteinFloor = round5(0.8 * weight);
    while (carbG < carbFloor && proteinG > proteinFloor) {
      proteinG -= 5;
      carbG = round5((calorieTarget - 4 * proteinG - 9 * fatG) / 4);
    }
    carbFloorUnmet = carbG < carbFloor;
  }

  const fiberGuidelineG = round5((14 * calorieTarget) / 1000);

  // ---- projection ----
  const projection = atGoal
    ? ({ kind: "at-goal" } as const)
    : projectTimeline(
        weight,
        inputs.goalWeightLbs,
        months,
        inputs.bulkStyle,
        heightIn,
        inputs.rateOverride,
        ctx.today,
      );

  const tierLabel: Record<TrainingTier, string> = {
    novice: "novice",
    intermediate: "intermediate",
    advanced: "advanced",
  };
  const neatLabel: Record<NeatTier, string> = {
    sitting: "mostly sitting",
    light: "on your feet a few hours",
    active: "on your feet most of the day",
    demanding: "physically demanding days",
  };

  const explain: Plan["explain"] = {
    tdee:
      `${fmt(bmr)} at rest × ${NEAT_FACTOR[inputs.neatTier]} (${neatLabel[inputs.neatTier]})` +
      ` + ${fmt(dailyEAT)}/day from training` +
      (observedTDEE != null
        ? ` — blended with ~${fmt(observedTDEE)} observed from your own logs`
        : ""),
    rate: atGoal
      ? "You're at your goal weight — holding maintenance."
      : `${RATE_TABLE[tier][inputs.bulkStyle]}% of bodyweight/month for ${tier === "novice" ? "a" : "an"} ${tierLabel[tier]} lifter` +
        (underweight ? ", boosted while underweight" : "") +
        ` → ${rate.toFixed(2)} lb/week`,
    calories: atGoal
      ? `Maintenance at ~${fmt(blendedTDEE)} with no surplus.`
      : flooredToCurrent
        ? `The formula said ${fmt(computedTarget)}, but your current ${fmt(ctx.currentCalorieTarget)} stays — never cut a bulk that isn't ahead of pace.`
        : `${fmt(blendedTDEE)} maintenance + ${fmt(surplusPerDay)} surplus (${Math.round(leanFraction * 100)}% of gain expected lean).`,
    protein: useLbm
      ? `1.05 g per lb of lean mass.`
      : `${PROTEIN_G_PER_LB[inputs.appetite].toFixed(2)} g per lb of bodyweight — realistic for your appetite.`,
    fat: `${Math.round(fatShare * 100)}% of calories, never below 0.3 g/lb — hormones need it.`,
    carbs: `Everything left after protein and fat — the training fuel lever.`,
  };

  return {
    calorieTarget,
    computedCalorieTarget: computedTarget,
    proteinG,
    fatG,
    carbG,
    fiberGuidelineG,
    rateLbsPerWeek: rate,
    recommendedRateLbsPerWeek: recommendedRate,
    rateSource:
      inputs.rateOverride != null && !atGoal ? "custom" : "recommended",
    bmr,
    formulaTDEE,
    observedTDEE,
    blendedTDEE,
    confidence,
    surplusPerDay,
    kcalPerLb: Math.round(kcalPerLb),
    leanFraction,
    trainingTier: tier,
    projection,
    flags: {
      underweightBoost: underweight,
      carbFloorUnmet,
      flooredToCurrent,
      atGoal,
    },
    explain,
  };
}

/** Weekly simulation with training-age taper and the underweight boost decaying away. */
export function projectTimeline(
  startWeight: number,
  goalWeight: number,
  startMonths: number,
  style: BulkStyle,
  heightIn: number,
  rateOverride: number | null,
  today: string,
):
  | { kind: "date"; projectedDate: string; weeks: number }
  | { kind: "open-ended" } {
  let w = startWeight;
  let months = startMonths;
  let weeks = 0;
  const CAP = 260; // 5 years
  while (w < goalWeight && weeks < CAP) {
    const bmi = (703 * w) / (heightIn * heightIn);
    const rate =
      rateOverride ??
      ((RATE_TABLE[tierOf(months)][style] + (bmi < 18.5 ? 0.25 : 0)) / 100) *
        w /
        WEEKS_PER_MONTH;
    w += Math.max(rate, 0.05);
    weeks += 1;
    months += 1 / WEEKS_PER_MONTH;
  }
  if (weeks >= CAP) return { kind: "open-ended" };
  return { kind: "date", projectedDate: addDays(today, weeks * 7), weeks };
}

/**
 * Observed TDEE from the app's own records: mean intake on well-logged days
 * vs the smoothed weight trend. Window ends yesterday (today is incomplete).
 * A "logged day" needs ≥2 entries or ≥60% of target — a lone snack must not
 * drag the mean down and trigger a cut.
 */
export type DayIntake = {
  date: string;
  calories: number;
  entryCount: number;
};

export function estimateObservedTdee(
  days: DayIntake[],
  targets: (date: string) => number,
  weighIns: WeighIn[],
  leanFraction: number,
  today: string,
): ObservedTdee | null {
  const windowEnd = addDays(today, -1);
  const windowStart = addDays(windowEnd, -27); // up to 28 app-days
  const inWindow = days.filter(
    (d) => d.date >= windowStart && d.date <= windowEnd,
  );
  const logged = inWindow.filter(
    (d) => d.entryCount >= 2 || d.calories >= 0.6 * targets(d.date),
  );
  const windowDays = Math.min(daysBetween(windowStart, windowEnd) + 1, 28);
  if (logged.length < 14 || logged.length / windowDays < 0.8) return null;

  const ws = weighIns.filter(
    (w) => w.date >= windowStart && w.date <= windowEnd,
  );
  if (ws.length < 8) return null;
  const first4End = addDays(windowStart, 3);
  const last4Start = addDays(windowEnd, -3);
  const anchorStart = ws.find((w) => w.date <= first4End);
  const anchorEnd = [...ws].reverse().find((w) => w.date >= last4Start);
  if (!anchorStart || !anchorEnd) return null;

  const ra = rollingAverage(weighIns);
  const raAt = (date: string) =>
    ra.find((p) => p.date === date)?.weightLbs ?? null;
  const raStart = raAt(anchorStart.date);
  const raEnd = raAt(anchorEnd.date);
  if (raStart == null || raEnd == null) return null;
  const span = daysBetween(anchorStart.date, anchorEnd.date);
  if (span < 7) return null;

  const meanIntake =
    logged.reduce((s, d) => s + d.calories, 0) / logged.length;
  const deltaPerDay = (raEnd - raStart) / span;
  const observedRaw = meanIntake - deltaPerDay * kcalPerLbGained(leanFraction);
  const confidence =
    Math.min(logged.length / 28, 1) * Math.min(span / 28, 1);
  return { observedTDEE: Math.round(observedRaw), confidence };
}
