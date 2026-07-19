import { NextResponse } from "next/server";
import { asShortText, bad } from "@/lib/api";
import {
  mapOpenFoodFactsProduct,
  mapUsdaFood,
  type CatalogFood,
  type OpenFoodFactsProduct,
  type UsdaFood,
} from "@/lib/food-catalog";

const OFF_FIELDS = [
  "code",
  "product_name",
  "brands",
  "serving_size",
  "serving_quantity",
  "nutriments",
].join(",");
const USER_AGENT = "Surplus/1.0 personal-fitness-pwa";

async function lookupBarcode(barcode: string): Promise<CatalogFood[]> {
  const url = new URL(
    `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(barcode)}.json`,
  );
  url.searchParams.set("fields", OFF_FIELDS);
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return [];
  const body = (await response.json()) as {
    status?: unknown;
    product?: OpenFoodFactsProduct;
  };
  if (body.status !== 1 || !body.product) return [];
  const product = mapOpenFoodFactsProduct(body.product);
  return product ? [product] : [];
}

/** USDA branded foods often carry the serving OFF lacks (e.g. "1 bottle").
 * gtinUpc is stored as a zero-padded GTIN-14, so search the padded form and
 * verify the match — the endpoint is full-text, not a barcode index. */
async function lookupBarcodeUsda(barcode: string): Promise<CatalogFood[]> {
  const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
  const response = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        query: barcode.padStart(14, "0"),
        pageSize: 5,
        dataType: ["Branded"],
      }),
    },
  );
  if (!response.ok) return [];
  const body = (await response.json()) as { foods?: UsdaFood[] };
  const scanned = barcode.replace(/^0+/, "");
  return (body.foods ?? [])
    .filter(
      (food) =>
        typeof food.gtinUpc === "string" &&
        food.gtinUpc.replace(/^0+/, "") === scanned,
    )
    .map(mapUsdaFood)
    .filter((food): food is CatalogFood => food !== null);
}

async function searchOpenFoodFacts(query: string): Promise<CatalogFood[]> {
  const url = new URL("https://world.openfoodfacts.org/cgi/search.pl");
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "15");
  url.searchParams.set("fields", OFF_FIELDS);
  const response = await fetch(url, {
    cache: "no-store",
    headers: { "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) return [];
  const body = (await response.json()) as {
    products?: OpenFoodFactsProduct[];
  };
  return (body.products ?? [])
    .map(mapOpenFoodFactsProduct)
    .filter((food): food is CatalogFood => food !== null);
}

async function searchUsda(query: string): Promise<CatalogFood[]> {
  // USDA explicitly provides DEMO_KEY for low-volume evaluation. A personal
  // key raises the limit, but search should still work on first launch.
  const apiKey = process.env.USDA_API_KEY || "DEMO_KEY";
  const response = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      cache: "no-store",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(8_000),
      body: JSON.stringify({
        query,
        pageSize: 15,
        dataType: ["Foundation", "SR Legacy", "Branded"],
      }),
    },
  );
  if (!response.ok) return [];
  const body = (await response.json()) as { foods?: UsdaFood[] };
  return (body.foods ?? [])
    .map(mapUsdaFood)
    .filter((food): food is CatalogFood => food !== null);
}

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const barcode = params.get("barcode")?.trim() ?? "";
  if (barcode) {
    if (!/^\d{6,14}$/.test(barcode)) return bad("invalid barcode");
    const [off, usda] = await Promise.allSettled([
      lookupBarcode(barcode),
      lookupBarcodeUsda(barcode),
    ]);
    const candidates = [
      ...(off.status === "fulfilled" ? off.value : []),
      ...(usda.status === "fulfilled" ? usda.value : []),
    ];
    // A "100 g" label means the source had no serving data — a real serving
    // from either source beats it (drinks otherwise log ~1/5 of a bottle).
    const withServing = candidates.filter(
      (food) => food.servingLabel !== "100 g",
    );
    const foods = (withServing.length > 0 ? withServing : candidates).slice(0, 1);
    return NextResponse.json(
      { foods },
      { headers: { "cache-control": "private, max-age=3600" } },
    );
  }

  const query = asShortText(params.get("query"), 80);
  if (!query || query.length < 2) return bad("query required");
  const [off, usda] = await Promise.allSettled([
    searchOpenFoodFacts(query),
    searchUsda(query),
  ]);
  const foods = [
    ...(off.status === "fulfilled" ? off.value : []),
    ...(usda.status === "fulfilled" ? usda.value : []),
  ];
  return NextResponse.json(
    { foods },
    { headers: { "cache-control": "private, max-age=300" } },
  );
}
