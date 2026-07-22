/**
 * The calorie-target streak — the app's only daily flame, and it never
 * scolds: today can only ADD to the streak (at the crossing moment), never
 * break it mid-day. Each past day is judged against the target that was in
 * force THAT day (target_history), so raising targets never rewrites history.
 */

import { addDays } from "./dates";

export type DaySum = { date: string; calories: number };
export type TargetRow = {
  effectiveDate: string;
  calorieTarget: number;
  proteinTargetG: number;
  carbTargetG: number;
  fatTargetG: number;
};

export type Streak = {
  /** consecutive hit days ending yesterday, plus today once it crosses */
  count: number;
  todayHit: boolean;
  todayTarget: number;
};

/** Target row in force on a date; earliest row covers earlier dates. */
export function targetRowFor(
  date: string,
  targets: TargetRow[],
): TargetRow | null {
  let best: TargetRow | null = null;
  let earliest: TargetRow | null = null;
  for (const t of targets) {
    if (!earliest || t.effectiveDate < earliest.effectiveDate) earliest = t;
    if (
      t.effectiveDate <= date &&
      (!best || t.effectiveDate > best.effectiveDate)
    ) {
      best = t;
    }
  }
  return best ?? earliest;
}

/** Calorie target in force on a date; settings cover an empty history. */
export function targetFor(
  date: string,
  targets: TargetRow[],
  fallbackCalories: number,
): number {
  return targetRowFor(date, targets)?.calorieTarget ?? fallbackCalories;
}

/** One day on the streak rail: its intake, the target that ruled it, hit state. */
export type StreakPoint = {
  date: string;
  calories: number;
  target: number;
  hit: boolean;
  /** false = no intake recorded that day (a nub on the rail, not a miss bar) */
  logged: boolean;
};

/**
 * The trailing-window series for the streak sparkline, oldest → newest ending
 * today. Today reads the live sum (never the closed-day history); every past
 * day is judged against its own target via `targetFor`, exactly like the
 * streak count — so the rail and the flame can never disagree.
 */
export function streakSeries(
  historyDays: DaySum[],
  targets: TargetRow[],
  today: string,
  todayCalories: number,
  fallbackCalories: number,
  windowDays = 28,
): StreakPoint[] {
  const byDate = new Map(historyDays.map((d) => [d.date, d.calories]));
  const out: StreakPoint[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const isToday = date === today;
    const calories = isToday ? todayCalories : (byDate.get(date) ?? 0);
    const logged = isToday ? todayCalories > 0 : byDate.has(date);
    const target = targetFor(date, targets, fallbackCalories);
    out.push({ date, calories, target, hit: calories >= target, logged });
  }
  return out;
}

/** Shared streak walk: consecutive hit days ending yesterday, plus today
 * once it crosses. A missing day reads as 0 — a miss. */
function runStreak(
  valueFor: (date: string) => number,
  targetOf: (date: string) => number,
  today: string,
  todayValue: number,
): Streak {
  let count = 0;
  let day = addDays(today, -1);
  // fixed 366-day window; display "365+" at the edge
  for (let i = 0; i < 366; i++) {
    if (valueFor(day) >= targetOf(day)) {
      count += 1;
      day = addDays(day, -1);
    } else {
      break;
    }
  }
  const todayTarget = targetOf(today);
  const todayHit = todayValue >= todayTarget;
  return { count: count + (todayHit ? 1 : 0), todayHit, todayTarget };
}

export function computeStreak(
  historyDays: DaySum[],
  targets: TargetRow[],
  today: string,
  /** live sum from ['food-logs', today] — the single source of truth for today */
  todayCalories: number,
  fallbackCalories: number,
): Streak {
  const byDate = new Map(historyDays.map((d) => [d.date, d.calories]));
  return runStreak(
    (date) => byDate.get(date) ?? 0,
    (date) => targetFor(date, targets, fallbackCalories),
    today,
    todayCalories,
  );
}

/**
 * The second flame: consecutive days at or over the protein floor, judged
 * against THAT day's protein target exactly like the calorie streak.
 */
export function computeProteinStreak(
  historyDays: { date: string; proteinG: number }[],
  targets: TargetRow[],
  today: string,
  /** live sum from ['food-logs', today] */
  todayProteinG: number,
  fallbackProteinG: number,
): Streak {
  const byDate = new Map(historyDays.map((d) => [d.date, d.proteinG]));
  return runStreak(
    (date) => byDate.get(date) ?? 0,
    (date) => targetRowFor(date, targets)?.proteinTargetG ?? fallbackProteinG,
    today,
    todayProteinG,
  );
}

/**
 * The trailing week as a trend, not a verdict: mean daily surplus/deficit vs
 * each day's own target over the last 7 closed days. Null until at least 3
 * of them have intake logged — a two-day average isn't a trend.
 */
export function weeklySurplus(
  historyDays: DaySum[],
  targets: TargetRow[],
  today: string,
  fallbackCalories: number,
): { avgDelta: number; loggedDays: number } | null {
  const byDate = new Map(historyDays.map((d) => [d.date, d.calories]));
  let sum = 0;
  let logged = 0;
  for (let i = 1; i <= 7; i++) {
    const date = addDays(today, -i);
    const calories = byDate.get(date);
    if (calories === undefined) continue;
    sum += calories - targetFor(date, targets, fallbackCalories);
    logged += 1;
  }
  if (logged < 3) return null;
  return { avgDelta: Math.round(sum / logged), loggedDays: logged };
}
