import { addDays, daysBetween } from "./dates";

export type WeighIn = { date: string; weightLbs: number };

/**
 * 7-day rolling average: mean of the weigh-ins that exist in [d−6, d].
 * Never interpolates; returns a point only for dates that have a weigh-in.
 */
export function rollingAverage(
  series: WeighIn[],
  windowDays = 7,
): WeighIn[] {
  const byDate = new Map(series.map((w) => [w.date, w.weightLbs]));
  return series.map(({ date }) => {
    let sum = 0;
    let n = 0;
    for (let i = 0; i < windowDays; i++) {
      const w = byDate.get(addDays(date, -i));
      if (w !== undefined) {
        sum += w;
        n++;
      }
    }
    return { date, weightLbs: sum / n };
  });
}

export type Pace =
  | { status: "gathering"; have: number; need: number }
  | {
      status: "ready";
      lbsPerWeek: number;
      band: "behind" | "on-pace" | "ahead";
    };

/**
 * Pace = RA(latest) − RA(~7 days earlier), scaled to lbs/week.
 * One subtraction on the smoothed series — current within days, no
 * double-smoothed regression lag. Requires ≥5 weigh-ins spanning ≥7 days.
 */
export function computePace(
  series: WeighIn[],
  goalRate: number,
): Pace {
  if (series.length < 5) {
    return { status: "gathering", have: series.length, need: 5 };
  }
  const ra = rollingAverage(series);
  const latest = ra[ra.length - 1];
  const targetDate = addDays(latest.date, -7);
  // closest RA point at or before latest−7d
  let anchor: WeighIn | undefined;
  for (let i = ra.length - 1; i >= 0; i--) {
    if (ra[i].date <= targetDate) {
      anchor = ra[i];
      break;
    }
  }
  if (!anchor) {
    return { status: "gathering", have: series.length, need: 5 };
  }
  const span = daysBetween(anchor.date, latest.date);
  const perWeek = ((latest.weightLbs - anchor.weightLbs) / span) * 7;
  const band =
    perWeek < goalRate - 0.25
      ? "behind"
      : perWeek > goalRate + 0.25
        ? "ahead"
        : "on-pace";
  return { status: "ready", lbsPerWeek: perWeek, band };
}

/** Epley e1RM, reps clamped at 12 — the progressive-overload scoreboard */
export function e1rm(weightLbs: number, reps: number): number {
  return weightLbs * (1 + Math.min(reps, 12) / 30);
}

/**
 * All-time records for one exercise. Weighted lifts race maxWeight/maxE1rm;
 * bodyweight lifts (weight 0) race maxReps — they must be able to PR too.
 * null records = first-ever session: everything is baseline, nothing fires.
 */
export type ExerciseRecords = {
  maxWeightLbs: number;
  maxE1rm: number;
  maxRepsAtBodyweight: number;
};

export type SetInput = { weightLbs: number; reps: number };

export type SetFlag = "none" | "overload" | "pr";

/** Fold already-logged sets from today into records so a repeat isn't a second PR. */
export function foldRecords(
  records: ExerciseRecords,
  todaySets: SetInput[],
): ExerciseRecords {
  let { maxWeightLbs, maxE1rm, maxRepsAtBodyweight } = records;
  for (const s of todaySets) {
    if (s.weightLbs > 0) {
      maxWeightLbs = Math.max(maxWeightLbs, s.weightLbs);
      maxE1rm = Math.max(maxE1rm, e1rm(s.weightLbs, s.reps));
    } else {
      maxRepsAtBodyweight = Math.max(maxRepsAtBodyweight, s.reps);
    }
  }
  return { maxWeightLbs, maxE1rm, maxRepsAtBodyweight };
}

/**
 * Celebration tier for a set, derived at render time — never stored, so
 * edits and deletes self-heal. PR is judged against ALL-TIME records
 * (server records + today's earlier sets); overload against the positional
 * ghost from last session, on estimated 1RM — 105×3 does not beat 100×10.
 */
export function classifySet(
  set: SetInput,
  serverRecords: ExerciseRecords | null,
  todayEarlierSets: SetInput[],
  ghost: SetInput | null,
): SetFlag {
  // first-ever session: baselines set silently, whole day stays quiet
  if (serverRecords === null) return "none";
  const records = foldRecords(serverRecords, todayEarlierSets);
  const isPr =
    set.weightLbs > 0
      ? set.weightLbs > records.maxWeightLbs ||
        e1rm(set.weightLbs, set.reps) > records.maxE1rm
      : set.reps > records.maxRepsAtBodyweight;
  if (isPr) return "pr";
  if (!ghost) return "none";
  const beatsGhost =
    set.weightLbs > 0 || ghost.weightLbs > 0
      ? e1rm(set.weightLbs, set.reps) > e1rm(ghost.weightLbs, ghost.reps)
      : set.reps > ghost.reps;
  return beatsGhost ? "overload" : "none";
}
