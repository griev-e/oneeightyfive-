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
