export type CatalogFood = {
  id: string;
  source: "open-food-facts" | "usda";
  name: string;
  brand: string | null;
  barcode: string | null;
  servingLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

type Nutriments = Record<string, unknown>;

export type OpenFoodFactsProduct = {
  code?: unknown;
  product_name?: unknown;
  brands?: unknown;
  serving_size?: unknown;
  nutriments?: Nutriments;
};

export type UsdaFood = {
  fdcId?: unknown;
  description?: unknown;
  brandName?: unknown;
  foodNutrients?: Array<{
    nutrientName?: unknown;
    nutrientNumber?: unknown;
    unitName?: unknown;
    value?: unknown;
  }>;
};

function finite(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function text(value: unknown): string | null {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    const joined = value.filter((item) => typeof item === "string").join(", ");
    return joined || null;
  }
  return null;
}

function rounded(value: number | null): number {
  return Math.max(0, Math.round(value ?? 0));
}

function nutrient(
  nutriments: Nutriments,
  key: string,
  basis: "serving" | "100g",
): number | null {
  return finite(nutriments[`${key}_${basis}`]) ?? finite(nutriments[key]);
}

export function mapOpenFoodFactsProduct(
  product: OpenFoodFactsProduct,
): CatalogFood | null {
  const name = text(product.product_name);
  const barcode = text(product.code);
  const nutriments = product.nutriments ?? {};
  const hasServing =
    text(product.serving_size) !== null &&
    nutrient(nutriments, "energy-kcal", "serving") !== null;
  const basis = hasServing ? "serving" : "100g";
  const protein = nutrient(nutriments, "proteins", basis);
  const carbs = nutrient(nutriments, "carbohydrates", basis);
  const fat = nutrient(nutriments, "fat", basis);
  const calories =
    nutrient(nutriments, "energy-kcal", basis) ??
    (protein !== null || carbs !== null || fat !== null
      ? (protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fat ?? 0) * 9
      : null);
  if (!name || !barcode || calories === null || calories <= 0) return null;

  return {
    id: `off:${barcode}`,
    source: "open-food-facts",
    name,
    brand: text(product.brands),
    barcode,
    servingLabel: hasServing ? text(product.serving_size)! : "100 g",
    calories: Math.max(1, Math.round(calories)),
    proteinG: rounded(protein),
    carbsG: rounded(carbs),
    fatG: rounded(fat),
  };
}

function usdaNutrient(food: UsdaFood, numbers: string[]): number | null {
  const match = food.foodNutrients?.find((item) =>
    numbers.includes(String(item.nutrientNumber ?? "")),
  );
  return finite(match?.value);
}

export function mapUsdaFood(food: UsdaFood): CatalogFood | null {
  const id =
    typeof food.fdcId === "number" || typeof food.fdcId === "string"
      ? String(food.fdcId)
      : null;
  const name = text(food.description);
  // FDC search nutrients are normalized per 100 g. Nutrient numbers are the
  // stable identifiers; names vary between legacy and Foundation records.
  const protein = usdaNutrient(food, ["203", "1003"]);
  const fat = usdaNutrient(food, ["204", "1004"]);
  const carbs = usdaNutrient(food, ["205", "1005"]);
  const calories =
    usdaNutrient(food, ["208", "1008"]) ??
    (protein !== null || carbs !== null || fat !== null
      ? (protein ?? 0) * 4 + (carbs ?? 0) * 4 + (fat ?? 0) * 9
      : null);
  if (!id || !name || calories === null || calories <= 0) return null;

  return {
    id: `usda:${id}`,
    source: "usda",
    name,
    brand: text(food.brandName),
    barcode: null,
    servingLabel: "100 g",
    calories: Math.max(1, Math.round(calories)),
    proteinG: rounded(protein),
    carbsG: rounded(carbs),
    fatG: rounded(fat),
  };
}
