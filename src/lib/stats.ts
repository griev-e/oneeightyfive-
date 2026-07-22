import { addDays, daysBetween, startOfWeek } from "./dates";

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

export type SessionSummary = {
  date: string;
  sets: number;
  topWeight: number;
  topReps: number;
  /** per-session tonnage (Σ weight × reps over the weighted sets) */
  volumeLbs?: number;
  /** total reps that session — the bodyweight-lift volume analogue */
  totalReps?: number;
};

/**
 * Per-session trend points for the lift chart: top-set e1RM for weighted
 * lifts, top reps for bodyweight ones. Accepts the history feed's
 * newest-first `recent` and returns an ascending series.
 */
export function e1rmSeries(recent: SessionSummary[]): WeighIn[] {
  return [...recent]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((s) => ({
      date: s.date,
      weightLbs: s.topWeight > 0 ? e1rm(s.topWeight, s.topReps) : s.topReps,
    }));
}

/**
 * Per-session volume points: tonnage for weighted lifts, total reps for
 * bodyweight ones. Same ascending shape as e1rmSeries so the two feed the
 * same chart.
 */
export function volumeSeries(recent: SessionSummary[]): WeighIn[] {
  return [...recent]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((s) => ({
      date: s.date,
      weightLbs: s.topWeight > 0 ? (s.volumeLbs ?? 0) : (s.totalReps ?? 0),
    }));
}

/**
 * The next-set target that beats the positional ghost — the smallest
 * standard jump: +5 lb at the same reps for weighted lifts, +1 rep at
 * bodyweight. A suggestion the stepper can adopt in one tap, never a
 * value that logs itself.
 */
export function suggestProgression(ghost: SetInput): SetInput {
  if (ghost.weightLbs === 0) {
    return { weightLbs: 0, reps: Math.min(ghost.reps + 1, 100) };
  }
  return { weightLbs: Math.min(ghost.weightLbs + 5, 1500), reps: ghost.reps };
}

/**
 * Straight guide line from the latest trend point at the goal rate — the
 * same slope the pace band judges against. Clamped at the goal weight;
 * empty when there's nothing meaningful to project.
 */
export function projectionGuide(
  from: WeighIn | undefined,
  ratePerWeek: number,
  days: number,
  goalWeightLbs: number | null,
): WeighIn[] {
  if (!from || ratePerWeek <= 0 || days <= 0) return [];
  if (goalWeightLbs !== null && from.weightLbs >= goalWeightLbs) return [];
  let endDays = days;
  let end = from.weightLbs + (ratePerWeek / 7) * days;
  if (goalWeightLbs !== null && end > goalWeightLbs) {
    endDays = Math.ceil(((goalWeightLbs - from.weightLbs) * 7) / ratePerWeek);
    end = from.weightLbs + (ratePerWeek / 7) * endDays;
  }
  return [from, { date: addDays(from.date, endDays), weightLbs: end }];
}

/**
 * Session tonnage: Σ weight × reps. Bodyweight sets (weight 0) contribute
 * nothing to load — the volume chip falls back to a set count for those.
 */
export function sessionVolume(sets: SetInput[]): number {
  return sets.reduce((sum, s) => sum + s.weightLbs * s.reps, 0);
}

export type LiftDay = { date: string; volumeLbs: number; sets: number };

export type WeekVolume = {
  /** Monday of the bucket's week */
  weekStart: string;
  volumeLbs: number;
  sessions: number;
};

/**
 * Weekly training tonnage, newest week last. Closed days come from the
 * day-summaries feed; today is overlaid from the live sets cache instead
 * (feed rows at/after `today` are dropped so nothing double-counts).
 * Weeks with no training are real zeros — unlike intake, they're filled in.
 */
export function weeklyVolume(
  liftDays: LiftDay[],
  todaySets: SetInput[],
  today: string,
  weeks = 8,
): WeekVolume[] {
  const currentWeek = startOfWeek(today);
  const buckets = new Map<string, WeekVolume>();
  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDays(currentWeek, -7 * i);
    buckets.set(weekStart, { weekStart, volumeLbs: 0, sessions: 0 });
  }
  for (const day of liftDays) {
    if (day.date >= today) continue;
    const bucket = buckets.get(startOfWeek(day.date));
    if (!bucket) continue;
    bucket.volumeLbs += day.volumeLbs;
    bucket.sessions += 1;
  }
  if (todaySets.length > 0) {
    const bucket = buckets.get(currentWeek);
    if (bucket) {
      bucket.volumeLbs += sessionVolume(todaySets);
      bucket.sessions += 1;
    }
  }
  return [...buckets.values()];
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
