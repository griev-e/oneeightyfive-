import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { asInt, asIsoDate, asShortText, asUuid, bad, oops, readBody } from "@/lib/api";

const LOG_COLUMNS =
  "id, date, name, calories, protein_g, carbs_g, fat_g, meal_id, logged_at";

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
    .select(LOG_COLUMNS)
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
  const mealId = b.mealId == null ? null : asUuid(b.mealId);
  if (b.mealId != null && !mealId) return bad();
  // client_id is the offline-replay idempotency key, stamped into the
  // mutation variables at mutate time; absent for online-only callers
  const clientId = b.clientId === undefined ? null : asUuid(b.clientId);
  if (b.clientId !== undefined && !clientId) return bad();
  // Undo re-inserts with the original timestamp so the row keeps its place
  const loggedAt =
    typeof b.loggedAt === "string" && !Number.isNaN(Date.parse(b.loggedAt))
      ? b.loggedAt
      : undefined;
  if (!date || !name || calories === null || proteinG === null || carbsG === null || fatG === null)
    return bad();

  const supabase = supabaseServer();
  const row = {
    date,
    name,
    calories,
    protein_g: proteinG,
    carbs_g: carbsG,
    fat_g: fatG,
    meal_id: mealId,
    ...(clientId ? { client_id: clientId } : {}),
    ...(loggedAt ? { logged_at: loggedAt } : {}),
  };
  // A replayed write whose ACK was lost must not create a second row: with a
  // client_id the insert ignores the duplicate and returns the original.
  const { data, error } = clientId
    ? await supabase
        .from("food_logs")
        .upsert(row, { onConflict: "client_id", ignoreDuplicates: true })
        .select(LOG_COLUMNS)
        .maybeSingle()
    : await supabase.from("food_logs").insert(row).select(LOG_COLUMNS).single();
  if (error) return oops(error.message);

  let logged = data;
  if (!logged && clientId) {
    const { data: existing, error: readErr } = await supabase
      .from("food_logs")
      .select(LOG_COLUMNS)
      .eq("client_id", clientId)
      .single();
    if (readErr) return oops(readErr.message);
    logged = existing;
    return NextResponse.json(toDto(logged)); // replay — the bump already ran
  }
  if (!logged) return oops("insert returned no row");

  // best-effort ranking bump — a heuristic, not accounting
  if (mealId) {
    await supabase.rpc("increment_meal_use", { p_meal_id: mealId });
  }

  return NextResponse.json(toDto(logged));
}
