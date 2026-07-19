/**
 * Pure folds for the nutrition-history chart: closed-day sums from the
 * day-summaries feed → chart series per metric, with the stepwise target
 * path that ruled each day (via target_history, like the streak). Missing
 * days are omitted, never zero-filled — an unlogged day is not a zero.
 */

import { addDays } from "./dates";
import { rollingAverage, type WeighIn } from "./stats";
import { targetRowFor, type TargetRow } from "./streaks";

export type MacroKey = "calories" | "protein" | "carbs" | "fat";

export type DayMacros = {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type MacroTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

const valueOf = (d: DayMacros, key: MacroKey): number =>
  key === "calories"
    ? d.calories
    : key === "protein"
      ? d.proteinG
      : key === "carbs"
        ? d.carbsG
        : d.fatG;

const targetOf = (t: TargetRow, key: MacroKey): number =>
  key === "calories"
    ? t.calorieTarget
    : key === "protein"
      ? t.proteinTargetG
      : key === "carbs"
        ? t.carbTargetG
        : t.fatTargetG;

export type NutritionSeries = {
  /** per-closed-day sums, ascending */
  data: WeighIn[];
  /** 7-day rolling mean of data (existing points only) */
  avg: WeighIn[];
  /** stepwise target-in-force path across the data's span */
  guide: WeighIn[];
};

export type Adherence = { hit: number; logged: number };

/**
 * How often a closed, logged day met the target that ruled it. Unlogged
 * days simply aren't counted — absence of data is not a miss here (the
 * streak owns that judgment); this is "of the days you logged, how many
 * landed". Today is always excluded (still in progress).
 */
export function macroAdherence(
  days: DayMacros[],
  targets: TargetRow[],
  key: MacroKey,
  today: string,
  fallback: MacroTargets,
  windowDays = 30,
): Adherence {
  const from = addDays(today, -windowDays);
  let hit = 0;
  let logged = 0;
  for (const d of days) {
    if (d.date < from || d.date >= today) continue;
    logged += 1;
    const row = targetRowFor(d.date, targets);
    const target = row !== null ? targetOf(row, key) : fallback[key];
    if (valueOf(d, key) >= target) hit += 1;
  }
  return { hit, logged };
}

export function nutritionSeries(
  days: DayMacros[],
  targets: TargetRow[],
  key: MacroKey,
  today: string,
  fallback: MacroTargets,
  windowDays = 30,
): NutritionSeries {
  const from = addDays(today, -windowDays);
  const data = days
    .filter((d) => d.date >= from && d.date < today)
    .map((d) => ({ date: d.date, weightLbs: valueOf(d, key) }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (data.length < 2) return { data: [], avg: [], guide: [] };

  const guide: WeighIn[] = [];
  const last = data[data.length - 1].date;
  for (let date = data[0].date; date <= last; date = addDays(date, 1)) {
    const row = targetRowFor(date, targets);
    guide.push({
      date,
      weightLbs: row !== null ? targetOf(row, key) : fallback[key],
    });
  }

  return { data, avg: rollingAverage(data), guide };
}
