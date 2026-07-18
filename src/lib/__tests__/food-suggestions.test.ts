import { describe, expect, it } from "vitest";
import {
  rankFoodSuggestions,
  scaleFood,
  type FoodHistoryItem,
} from "@/lib/food-suggestions";

const item = (
  id: string,
  date: string,
  name: string,
  hour: number,
  overrides: Partial<FoodHistoryItem> = {},
): FoodHistoryItem => ({
  id,
  date,
  name,
  calories: 500,
  proteinG: 30,
  carbsG: 60,
  fatG: 15,
  mealId: null,
  loggedAt: `${date}T${String(hour).padStart(2, "0")}:00:00.000Z`,
  ...overrides,
});

describe("rankFoodSuggestions", () => {
  it("prioritizes repeated foods at the current time of day", () => {
    const history = [
      item("1", "2026-07-16", "Oats", 8),
      item("2", "2026-07-17", "Oats", 8),
      item("3", "2026-07-17", "Chicken bowl", 19),
    ];

    const suggestions = rankFoodSuggestions(
      history,
      "2026-07-18",
      8,
      0,
    );

    expect(suggestions.map((s) => s.name)).toEqual(["Oats", "Chicken bowl"]);
  });

  it("uses the latest corrected macros for a repeated food", () => {
    const history = [
      item("1", "2026-07-16", "Shake", 10),
      item("2", "2026-07-17", "  shake ", 10, {
        calories: 650,
        proteinG: 42,
      }),
    ];

    const [suggestion] = rankFoodSuggestions(
      history,
      "2026-07-18",
      10,
      0,
    );

    expect(suggestion).toMatchObject({
      name: "shake",
      calories: 650,
      proteinG: 42,
      lastUsedDate: "2026-07-17",
    });
  });

  it("converts UTC timestamps to the supplied local timezone", () => {
    const history = [
      // 15:00 UTC is 08:00 at UTC-7 (offset +420).
      item("1", "2026-07-17", "Breakfast", 15),
      item("2", "2026-07-17", "Dinner", 8),
    ];

    const suggestions = rankFoodSuggestions(
      history,
      "2026-07-18",
      8,
      420,
    );

    expect(suggestions[0].name).toBe("Breakfast");
  });

  it("ignores quick adds, future rows, and history older than 42 days", () => {
    const history = [
      item("1", "2026-07-17", "Quick add", 8),
      item("2", "2026-07-18", "Today", 8),
      item("3", "2026-05-01", "Old", 8),
    ];

    expect(
      rankFoodSuggestions(history, "2026-07-18", 8, 0),
    ).toEqual([]);
  });
});

describe("scaleFood", () => {
  it("scales and rounds a complete macro snapshot", () => {
    expect(
      scaleFood(
        { calories: 555, proteinG: 31, carbsG: 67, fatG: 17 },
        0.5,
      ),
    ).toEqual({ calories: 278, proteinG: 16, carbsG: 34, fatG: 9 });
  });
});
