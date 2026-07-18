import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    calorieTarget: data.calorie_target,
    proteinTargetG: data.protein_target_g,
    goalRateLbsPerWeek: data.goal_rate_lbs_per_week,
    goalWeightLbs: data.goal_weight_lbs,
  });
}
