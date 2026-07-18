import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { asInt, asIsoDate, asShortText, bad, oops, readBody } from "@/lib/api";

const toDto = (l: {
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
  id: l.id,
  date: l.date,
  name: l.name,
  calories: l.calories,
  proteinG: l.protein_g,
  carbsG: l.carbs_g,
  fatG: l.fat_g,
  mealId: l.meal_id,
  loggedAt: l.logged_at,
});

export async function GET(req: Request) {
  const date = asIsoDate(new URL(req.url).searchParams.get("date"));
  if (!date) return bad("date required");
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("food_logs")
    .select("id, date, name, calories, protein_g, carbs_g, fat_g, meal_id, logged_at")
    .eq("date", date)
    .order("logged_at", { ascending: true });
  if (error) return oops(error.message);
  return NextResponse.json(data.map(toDto));
}

export async function POST(req: Request) {
  const b = await readBody(req);
  const date = asIsoDate(b.date);
  const name = asShortText(b.name ?? "Quick add", 80);
  const calories = asInt(b.calories, 1, 5000);
  const proteinG = asInt(b.proteinG ?? 0, 0, 500);
  const carbsG = asInt(b.carbsG ?? 0, 0, 1000);
  const fatG = asInt(b.fatG ?? 0, 0, 500);
  const mealId = typeof b.mealId === "string" ? b.mealId : null;
  // Undo re-inserts with the original timestamp so the row keeps its place
  const loggedAt =
    typeof b.loggedAt === "string" && !Number.isNaN(Date.parse(b.loggedAt))
      ? b.loggedAt
      : undefined;
  if (!date || !name || calories === null || proteinG === null || carbsG === null || fatG === null)
    return bad();

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("food_logs")
    .insert({
      date,
      name,
      calories,
      protein_g: proteinG,
      carbs_g: carbsG,
      fat_g: fatG,
      meal_id: mealId,
      ...(loggedAt ? { logged_at: loggedAt } : {}),
    })
    .select("id, date, name, calories, protein_g, carbs_g, fat_g, meal_id, logged_at")
    .single();
  if (error) return oops(error.message);

  // best-effort ranking bump — a heuristic, not accounting
  if (mealId) {
    const { data: meal } = await supabase
      .from("meals")
      .select("use_count")
      .eq("id", mealId)
      .single();
    if (meal) {
      await supabase
        .from("meals")
        .update({
          use_count: meal.use_count + 1,
          last_used_at: new Date().toISOString(),
        })
        .eq("id", mealId);
    }
  }

  return NextResponse.json(toDto(data));
}
