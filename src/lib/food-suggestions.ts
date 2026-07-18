import { daysBetween } from "./dates";

export type FoodHistoryItem = {
  id: string;
  date: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealId: string | null;
  loggedAt: string;
};

export type FoodSuggestion = {
  key: string;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealId: string | null;
  lastUsedDate: string;
};

export type FoodMacros = Pick<
  FoodSuggestion,
  "calories" | "proteinG" | "carbsG" | "fatG"
>;

export function foodKey(food: {
  name: string;
  mealId?: string | null;
}): string {
  if (food.mealId) return `meal:${food.mealId}`;
  return `name:${food.name
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/\s+/g, " ")}`;
}

export function scaleFood<T extends FoodMacros>(food: T, multiplier: number): T {
  return {
    ...food,
    calories: Math.max(1, Math.round(food.calories * multiplier)),
    proteinG: Math.round(food.proteinG * multiplier),
    carbsG: Math.round(food.carbsG * multiplier),
    fatG: Math.round(food.fatG * multiplier),
  };
}

function weekday(iso: string): number {
  return new Date(`${iso}T12:00:00Z`).getUTCDay();
}

function historicalLocalHour(
  loggedAt: string,
  timezoneOffsetMinutes: number,
): number {
  const local = new Date(
    Date.parse(loggedAt) - timezoneOffsetMinutes * 60_000,
  );
  return local.getUTCHours() + local.getUTCMinutes() / 60;
}

function hourDistance(a: number, b: number): number {
  const direct = Math.abs(a - b);
  return Math.min(direct, 24 - direct);
}

/**
 * Personal ranking only: frequency, recency, weekday, and time-of-day.
 * Nutrition is always taken from the latest matching log, so a correction
 * teaches future suggestions without rewriting history.
 */
export function rankFoodSuggestions(
  history: FoodHistoryItem[],
  targetDate: string,
  localHour: number,
  timezoneOffsetMinutes: number,
  limit = 8,
): FoodSuggestion[] {
  const grouped = new Map<
    string,
    { score: number; latest: FoodHistoryItem }
  >();

  for (const item of history) {
    const age = daysBetween(item.date, targetDate);
    if (age < 1 || age > 42 || item.name === "Quick add") continue;

    const key = foodKey(item);
    const timeDistance = hourDistance(
      localHour,
      historicalLocalHour(item.loggedAt, timezoneOffsetMinutes),
    );
    const recency = Math.max(1, 18 - age * 0.4);
    const timeMatch = Math.max(0, 12 - timeDistance * 2);
    const weekdayMatch = weekday(item.date) === weekday(targetDate) ? 8 : 0;
    const previous = grouped.get(key);

    grouped.set(key, {
      score: (previous?.score ?? 0) + recency + timeMatch + weekdayMatch,
      latest:
        !previous || item.loggedAt > previous.latest.loggedAt
          ? item
          : previous.latest,
    });
  }

  return [...grouped.entries()]
    .sort(
      (a, b) =>
        b[1].score - a[1].score ||
        b[1].latest.loggedAt.localeCompare(a[1].latest.loggedAt),
    )
    .slice(0, limit)
    .map(([key, { latest }]) => ({
      key,
      name: latest.name.trim(),
      calories: latest.calories,
      proteinG: latest.proteinG,
      carbsG: latest.carbsG,
      fatG: latest.fatG,
      mealId: latest.mealId,
      lastUsedDate: latest.date,
    }));
}
