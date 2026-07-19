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

  it("scales missing per-serving macros from 100 g via serving_quantity", () => {
    // Real OFF shape (Cheerios): per-serving calories exist, but macros only
    // per 100 g. The old bare-key fallback returned 100 g macros against a
    // 39 g serving.
    expect(
      mapOpenFoodFactsProduct({
        code: "0016000275287",
        product_name: "Cheerios",
        serving_size: "1 cup (39 g)",
        serving_quantity: "39",
        nutriments: {
          "energy-kcal_serving": 140,
          "energy-kcal_100g": 358.97,
          "energy-kcal": 358.97,
          proteins_100g: 12.8,
          proteins: 12.8,
          carbohydrates_100g: 74.36,
          carbohydrates: 74.36,
          fat_100g: 6.41,
          fat: 6.41,
        },
      }),
    ).toMatchObject({
      servingLabel: "1 cup (39 g)",
      calories: 140,
      proteinG: 5,
      carbsG: 29,
      fatG: 2,
    });
  });

  it("never leaks per-100g bare keys into a per-serving entry", () => {
    expect(
      mapOpenFoodFactsProduct({
        code: "123456789012",
        product_name: "Granola",
        serving_size: "40 g",
        nutriments: {
          "energy-kcal_serving": 180,
          // Bare keys are per 100 g in OFF; with no serving_quantity to
          // scale by, unknown beats wrong.
          proteins: 10,
          carbohydrates: 60,
          fat: 12,
        },
      }),
    ).toMatchObject({
      servingLabel: "40 g",
      calories: 180,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
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

  it("scales ml-based beverage servings (FDC MLT unit)", () => {
    expect(
      mapUsdaFood({
        fdcId: 99,
        description: "Green tea with honey",
        servingSize: 360,
        servingSizeUnit: "MLT",
        householdServingFullText: "12 fl oz",
        gtinUpc: "00048500201985",
        foodNutrients: [
          { nutrientNumber: "1008", value: 19.4 },
          { nutrientNumber: "1003", value: 0 },
          { nutrientNumber: "1005", value: 5.28 },
          { nutrientNumber: "1004", value: 0 },
        ],
      }),
    ).toMatchObject({
      servingLabel: "12 fl oz",
      calories: 70,
      proteinG: 0,
      carbsG: 19,
      fatG: 0,
    });
  });

  it("scales branded nutrition to its household serving", () => {
    expect(
      mapUsdaFood({
        fdcId: 42,
        description: "Peanut butter",
        servingSize: 32,
        servingSizeUnit: "g",
        householdServingFullText: "2 Tbsp",
        gtinUpc: "123456789012",
        foodNutrients: [
          { nutrientNumber: "208", value: 600 },
          { nutrientNumber: "203", value: 25 },
          { nutrientNumber: "205", value: 20 },
          { nutrientNumber: "204", value: 50 },
        ],
      }),
    ).toMatchObject({
      servingLabel: "2 Tbsp",
      barcode: "123456789012",
      calories: 192,
      proteinG: 8,
      carbsG: 6,
      fatG: 16,
    });
  });
});
