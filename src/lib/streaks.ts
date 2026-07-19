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

export function computeStreak(
  historyDays: DaySum[],
  targets: TargetRow[],
  today: string,
  /** live sum from ['food-logs', today] — the single source of truth for today */
  todayCalories: number,
  fallbackCalories: number,
): Streak {
  const byDate = new Map(historyDays.map((d) => [d.date, d.calories]));
  let count = 0;
  let day = addDays(today, -1);
  // fixed 366-day window; display "365+" at the edge
  for (let i = 0; i < 366; i++) {
    const calories = byDate.get(day) ?? 0;
    if (calories >= targetFor(day, targets, fallbackCalories)) {
      count += 1;
      day = addDays(day, -1);
    } else {
      break;
    }
  }
  const todayTarget = targetFor(today, targets, fallbackCalories);
  const todayHit = todayCalories >= todayTarget;
  return { count: count + (todayHit ? 1 : 0), todayHit, todayTarget };
}
