import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { asInt, asIsoDate, asNum, bad, oops, readBody } from "@/lib/api";

const toDto = (s: {
  calorie_target: number;
  protein_target_g: number;
  carb_target_g: number;
  fat_target_g: number;
  goal_rate_lbs_per_week: number;
  goal_weight_lbs: number | null;
  goal_rate_source: string;
}) => ({
  calorieTarget: s.calorie_target,
  proteinTargetG: s.protein_target_g,
  carbTargetG: s.carb_target_g,
  fatTargetG: s.fat_target_g,
  goalRateLbsPerWeek: s.goal_rate_lbs_per_week,
  goalWeightLbs: s.goal_weight_lbs,
  goalRateSource: s.goal_rate_source,
});

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) return oops(error.message);
  return NextResponse.json(toDto(data));
}

/**
 * Manual target edits go through the same atomic RPC as the questionnaire —
 * hand-tweaks also write target_history, so streak fairness applies to them.
 */
export async function PUT(req: Request) {
  const b = await readBody(req);
  const effectiveDate = asIsoDate(b.effectiveDate);
  const calorieTarget = asInt(b.calorieTarget, 1000, 10000);
  const proteinTargetG = asInt(b.proteinTargetG, 30, 500);
  const carbTargetG = asInt(b.carbTargetG, 50, 1200);
  const fatTargetG = asInt(b.fatTargetG, 20, 400);
  if (
    !effectiveDate ||
    calorieTarget === null ||
    proteinTargetG === null ||
    carbTargetG === null ||
    fatTargetG === null
  ) {
    return bad();
  }
  const goalRate =
    b.goalRateLbsPerWeek === undefined
      ? undefined
      : asNum(b.goalRateLbsPerWeek, 0, 1);
  const goalWeight =
    b.goalWeightLbs === undefined ? undefined : asNum(b.goalWeightLbs, 80, 400);
  if (goalRate === null || goalWeight === null) return bad();

  const supabase = supabaseServer();
  const { error } = await supabase.rpc("apply_targets", {
    p_effective_date: effectiveDate,
    p_calorie_target: calorieTarget,
    p_protein_target_g: proteinTargetG,
    p_carb_target_g: carbTargetG,
    p_fat_target_g: fatTargetG,
    ...(goalRate !== undefined ? { p_goal_rate_lbs_per_week: goalRate } : {}),
    ...(goalWeight !== undefined ? { p_goal_weight_lbs: goalWeight } : {}),
    p_goal_rate_source: "custom",
    p_action: "applied",
  });
  if (error) return oops(error.message);

  const { data, error: readErr } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (readErr) return oops(readErr.message);
  return NextResponse.json(toDto(data));
}
