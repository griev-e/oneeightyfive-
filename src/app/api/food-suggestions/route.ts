import { NextResponse } from "next/server";
import { allRows, supabaseServer } from "@/lib/supabase/server";
import { asIsoDate, bad, oops } from "@/lib/api";
import { addDays } from "@/lib/dates";
import {
  rankFoodSuggestions,
  type FoodHistoryItem,
} from "@/lib/food-suggestions";

const toHistoryItem = (row: {
  id: string;
  date: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  meal_id: string | null;
  logged_at: string;
}): FoodHistoryItem => ({
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

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const date = asIsoDate(params.get("date"));
  const hour = Number(params.get("hour"));
  const timezoneOffsetMinutes = Number(params.get("timezoneOffsetMinutes"));
  if (
    !date ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23 ||
    !Number.isInteger(timezoneOffsetMinutes) ||
    timezoneOffsetMinutes < -840 ||
    timezoneOffsetMinutes > 840
  ) {
    return bad("valid date, hour, and timezoneOffsetMinutes required");
  }

  const supabase = supabaseServer();
  // 42 days of a heavy logger can pass the 1000-row cap — page
  const { data, error } = await allRows((f, t) =>
    supabase
      .from("food_logs")
      .select(
        "id, date, name, calories, protein_g, carbs_g, fat_g, meal_id, logged_at",
      )
      .gte("date", addDays(date, -42))
      .lt("date", date)
      .order("logged_at", { ascending: true })
      .order("id")
      .range(f, t),
  );
  if (error) return oops(error.message);

  const history = (data ?? []).map(toHistoryItem);
  return NextResponse.json({
    suggestions: rankFoodSuggestions(
      history,
      date,
      hour,
      timezoneOffsetMinutes,
      30,
    ),
    yesterday: history.filter((item) => item.date === addDays(date, -1)),
  });
}
