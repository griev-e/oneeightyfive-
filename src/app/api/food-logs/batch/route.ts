import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { asInt, asIsoDate, asShortText, asUuid, bad, oops, readBody } from "@/lib/api";

type BatchItem = {
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  mealId: string | null;
};

const toDto = (row: {
  id: string;
  date: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_id: string | null;
  logged_at: string;
}) => ({
  id: row.id,
  date: row.date,
  name: row.name,
  calories: row.calories,
  proteinG: row.protein_g,
  carbsG: row.carbs_g,
  fatG: row.fat_g,
  mealId: row.meal_id,
  loggedAt: row.logged_at,
});

function parseItem(value: unknown): BatchItem | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const name = asShortText(item.name, 80);
  const calories = asInt(item.calories, 1, 5000);
  const proteinG = asInt(item.proteinG ?? 0, 0, 500);
  const carbsG = asInt(item.carbsG ?? 0, 0, 1000);
  const fatG = asInt(item.fatG ?? 0, 0, 500);
  const mealId = item.mealId == null ? null : asUuid(item.mealId);
  if (item.mealId != null && !mealId) return null;
  if (
    !name ||
    calories === null ||
    proteinG === null ||
    carbsG === null ||
    fatG === null
  ) {
    return null;
  }
  return { name, calories, proteinG, carbsG, fatG, mealId };
}

export async function POST(req: Request) {
  const body = await readBody(req);
  const date = asIsoDate(body.date);
  if (!date || !Array.isArray(body.items) || body.items.length < 1) {
    return bad();
  }
  if (body.items.length > 50) return bad("maximum 50 entries");

  const items = body.items.map(parseItem);
  if (items.some((item) => item === null)) return bad();

  const startedAt = Date.now();
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("food_logs")
    .insert(
      (items as BatchItem[]).map((item, index) => ({
        date,
        name: item.name,
        calories: item.calories,
        protein_g: item.proteinG,
        carbs_g: item.carbsG,
        fat_g: item.fatG,
        meal_id: item.mealId,
        logged_at: new Date(startedAt + index).toISOString(),
      })),
    )
    .select(
      "id, date, name, calories, protein_g, carbs_g, fat_g, meal_id, logged_at",
    );
  if (error) return oops(error.message);

  return NextResponse.json(data.map(toDto));
}
