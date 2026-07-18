import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { asInt, asShortText, bad, oops, readBody } from "@/lib/api";

const toDto = (m: {
  id: string;
  name: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  use_count: number;
  last_used_at: string | null;
}) => ({
  id: m.id,
  name: m.name,
  calories: m.calories,
  proteinG: m.protein_g,
  carbsG: m.carbs_g,
  fatG: m.fat_g,
  useCount: m.use_count,
  lastUsedAt: m.last_used_at,
});

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("meals")
    .select("id, name, calories, protein_g, carbs_g, fat_g, use_count, last_used_at")
    .is("archived_at", null)
    .order("use_count", { ascending: false })
    .order("last_used_at", { ascending: false, nullsFirst: false });
  if (error) return oops(error.message);
  return NextResponse.json(data.map(toDto));
}

export async function POST(req: Request) {
  const b = await readBody(req);
  const name = asShortText(b.name, 80);
  const calories = asInt(b.calories, 0, 5000);
  const proteinG = asInt(b.proteinG ?? 0, 0, 500);
  const carbsG = asInt(b.carbsG ?? 0, 0, 1000);
  const fatG = asInt(b.fatG ?? 0, 0, 500);
  if (!name || calories === null || proteinG === null || carbsG === null || fatG === null)
    return bad();

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("meals")
    .insert({
      name,
      calories,
      protein_g: proteinG,
      carbs_g: carbsG,
      fat_g: fatG,
    })
    .select("id, name, calories, protein_g, carbs_g, fat_g, use_count, last_used_at")
    .single();
  if (error) return oops(error.message);
  return NextResponse.json(toDto(data));
}
