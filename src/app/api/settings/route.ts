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
 * Manual MACRO-target edits go through the same atomic RPC as the
 * questionnaire — hand-tweaks also write target_history, so streak fairness
 * applies to them. Goal fields are deliberately not accepted here: the RPC
 * coalesces the omitted params to their current values, so a target edit
 * never touches goal weight, pace, or rate provenance (that's PATCH's job).
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

  const supabase = supabaseServer();
  const { error } = await supabase.rpc("apply_targets", {
    p_effective_date: effectiveDate,
    p_calorie_target: calorieTarget,
    p_protein_target_g: proteinTargetG,
    p_carb_target_g: carbTargetG,
    p_fat_target_g: fatTargetG,
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

/**
 * Goal-field edits — a plain settings update, no RPC. Changing your goal
 * weight or pace writes no target_history row and no plan_event, so it can
 * never suppress the recalibration card or pollute the plan audit trail.
 */
export async function PATCH(req: Request) {
  const b = await readBody(req);
  const update: {
    goal_weight_lbs?: number;
    goal_rate_lbs_per_week?: number;
    goal_rate_source?: string;
  } = {};
  if (b.goalWeightLbs !== undefined) {
    const v = asNum(b.goalWeightLbs, 80, 400);
    if (v === null) return bad();
    update.goal_weight_lbs = v;
  }
  if (b.goalRateLbsPerWeek !== undefined) {
    const v = asNum(b.goalRateLbsPerWeek, 0.1, 2);
    if (v === null) return bad();
    update.goal_rate_lbs_per_week = v;
  }
  if (b.goalRateSource !== undefined) {
    if (b.goalRateSource !== "recommended" && b.goalRateSource !== "custom") {
      return bad();
    }
    update.goal_rate_source = b.goalRateSource;
  }
  if (Object.keys(update).length === 0) return bad("nothing to update");

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("settings")
    .update(update)
    .eq("id", 1)
    .select("*")
    .single();
  if (error) return oops(error.message);
  return NextResponse.json(toDto(data));
}
