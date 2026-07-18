import { describe, expect, it } from "vitest";
import {
  mapOpenFoodFactsProduct,
  mapUsdaFood,
} from "@/lib/food-catalog";

describe("mapOpenFoodFactsProduct", () => {
  it("prefers per-serving nutrition when the product provides it", () => {
    expect(
      mapOpenFoodFactsProduct({
        code: "123456789012",
        product_name: "Protein shake",
        brands: "Example",
        serving_size: "330 ml bottle",
        nutriments: {
          "energy-kcal_serving": 240,
          proteins_serving: 30,
          carbohydrates_serving: 18,
          fat_serving: 5,
          "energy-kcal_100g": 73,
          proteins_100g: 9.1,
        },
      }),
    ).toMatchObject({
      servingLabel: "330 ml bottle",
      calories: 240,
      proteinG: 30,
      carbsG: 18,
      fatG: 5,
    });
  });

  it("falls back to a clearly labeled 100 g basis", () => {
    expect(
      mapOpenFoodFactsProduct({
        code: "12345678",
        product_name: "Peanut butter",
        nutriments: {
          "energy-kcal_100g": 588.4,
          proteins_100g: 25.1,
          carbohydrates_100g: 20,
          fat_100g: 50.2,
        },
      }),
    ).toMatchObject({
      servingLabel: "100 g",
      calories: 588,
      proteinG: 25,
      carbsG: 20,
      fatG: 50,
    });
  });

  it("rejects products without usable calories", () => {
    expect(
      mapOpenFoodFactsProduct({
        code: "12345678",
        product_name: "Mystery product",
        nutriments: {},
      }),
    ).toBeNull();
  });
});

describe("mapUsdaFood", () => {
  it("maps stable nutrient numbers on a 100 g basis", () => {
    expect(
      mapUsdaFood({
        fdcId: 171705,
        description: "Chicken breast, roasted",
        foodNutrients: [
          { nutrientNumber: "1008", value: 165 },
          { nutrientNumber: "1003", value: 31.02 },
          { nutrientNumber: "1005", value: 0 },
          { nutrientNumber: "1004", value: 3.57 },
        ],
      }),
    ).toMatchObject({
      id: "usda:171705",
      servingLabel: "100 g",
      calories: 165,
      proteinG: 31,
      carbsG: 0,
      fatG: 4,
    });
  });
});
