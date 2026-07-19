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
  serving_quantity?: unknown;
  nutriments?: Nutriments;
};

export type UsdaFood = {
  fdcId?: unknown;
  description?: unknown;
  brandName?: unknown;
  gtinUpc?: unknown;
  servingSize?: unknown;
  servingSizeUnit?: unknown;
  householdServingFullText?: unknown;
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

function positive(value: unknown): number | null {
  const parsed =
    typeof value === "string" && value.trim() ? Number(value) : value;
  const quantity = finite(parsed);
  return quantity !== null && quantity > 0 ? quantity : null;
}

function per100g(nutriments: Nutriments, key: string): number | null {
  // OFF mirrors the per-100g value onto the bare key.
  return finite(nutriments[`${key}_100g`]) ?? finite(nutriments[key]);
}

/** Per-serving value, scaled from 100 g when the explicit key is missing.
 * Never the bare key: OFF fills it per 100 g, and mixing bases is how a 39 g
 * serving ends up wearing 100 g macros. */
function perServing(
  nutriments: Nutriments,
  key: string,
  servingQuantity: number | null,
): number | null {
  const explicit = finite(nutriments[`${key}_serving`]);
  if (explicit !== null) return explicit;
  const base = per100g(nutriments, key);
  return base !== null && servingQuantity !== null
    ? (base * servingQuantity) / 100
    : null;
}

export function mapOpenFoodFactsProduct(
  product: OpenFoodFactsProduct,
): CatalogFood | null {
  const name = text(product.product_name);
  const barcode = text(product.code);
  const nutriments = product.nutriments ?? {};
  const servingSize = text(product.serving_size);
  const servingQuantity = positive(product.serving_quantity);
  const hasServing =
    servingSize !== null &&
    perServing(nutriments, "energy-kcal", servingQuantity) !== null;
  const value = hasServing
    ? (key: string) => perServing(nutriments, key, servingQuantity)
    : (key: string) => per100g(nutriments, key);
  const protein = value("proteins");
  const carbs = value("carbohydrates");
  const fat = value("fat");
  const calories =
    value("energy-kcal") ??
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
    servingLabel: hasServing ? servingSize : "100 g",
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
  const servingSize = finite(food.servingSize);
  const servingUnit = text(food.servingSizeUnit);
  const canScaleServing =
    servingSize !== null &&
    servingSize > 0 &&
    servingUnit?.toLocaleLowerCase("en-US") === "g";
  const scale = canScaleServing ? servingSize / 100 : 1;
  const servingLabel =
    (canScaleServing && text(food.householdServingFullText)) ||
    (canScaleServing ? `${servingSize} g` : "100 g");

  return {
    id: `usda:${id}`,
    source: "usda",
    name,
    brand: text(food.brandName),
    barcode: text(food.gtinUpc),
    servingLabel,
    calories: Math.max(1, Math.round(calories * scale)),
    proteinG: rounded(protein === null ? null : protein * scale),
    carbsG: rounded(carbs === null ? null : carbs * scale),
    fatG: rounded(fat === null ? null : fat * scale),
  };
}
