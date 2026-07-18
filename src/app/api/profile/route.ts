import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { asInt, asIsoDate, asNum, bad, oops, readBody } from "@/lib/api";
import {
  buildPlan,
  type Appetite,
  type BulkStyle,
  type NeatTier,
  type PlanInputs,
  type Sex,
} from "@/lib/plan";
import { computePace } from "@/lib/stats";

const profileDto = (p: Record<string, unknown>) => ({
  name: p.name,
  sex: p.sex,
  birthDate: p.birth_date,
  heightIn: p.height_in,
  bodyFatPct: p.body_fat_pct,
  neatTier: p.neat_tier,
  liftDaysPerWeek: p.lift_days_per_week,
  sessionMin: p.session_min,
  cardioMinPerWeek: p.cardio_min_per_week,
  trainingMonths: p.training_months,
  trainingMonthsAsOf: p.training_months_as_of,
  appetite: p.appetite,
  bulkStyle: p.bulk_style,
  completedAt: p.completed_at,
});

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("profile")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) return oops(error.message);
  return NextResponse.json(profileDto(data));
}

const ONE_OF = <T extends string>(v: unknown, opts: readonly T[]): T | null =>
  typeof v === "string" && (opts as readonly string[]).includes(v)
    ? (v as T)
    : null;

/**
 * Questionnaire submission. The server re-runs buildPlan (authoritative —
 * the client preview must match digit-for-digit) and applies everything
 * atomically via the apply_targets RPC.
 */
export async function PUT(req: Request) {
  const b = await readBody(req);
  const effectiveDate = asIsoDate(b.effectiveDate);
  const a = (b.answers ?? {}) as Record<string, unknown>;

  const sex = ONE_OF<Sex>(a.sex, ["male", "female"]);
  const birthDate = asIsoDate(a.birthDate);
  const heightIn = asNum(a.heightIn, 55, 90);
  const currentWeightLbs = asNum(a.currentWeightLbs, 80, 400);
  const bodyFatPct =
    a.bodyFatPct === null ? null : asNum(a.bodyFatPct, 3, 60);
  const neatTier = ONE_OF<NeatTier>(a.neatTier, [
    "sitting",
    "light",
    "active",
    "demanding",
  ]);
  const liftDaysPerWeek = asInt(a.liftDaysPerWeek, 2, 6);
  const sessionMin = asInt(a.sessionMin, 45, 90);
  const cardioMinPerWeek = asInt(a.cardioMinPerWeek, 0, 180);
  const trainingMonths = asInt(a.trainingMonths, 0, 600);
  const appetite = ONE_OF<Appetite>(a.appetite, [
    "easy",
    "manageable",
    "struggle",
  ]);
  const bulkStyle = ONE_OF<BulkStyle>(a.bulkStyle, [
    "lean",
    "standard",
    "aggressive",
  ]);
  const goalWeightLbs = asNum(a.goalWeightLbs, 80, 400);
  const rateOverride =
    a.rateOverride == null ? null : asNum(a.rateOverride, 0.1, 1.0);

  if (
    !effectiveDate ||
    !sex ||
    !birthDate ||
    heightIn === null ||
    currentWeightLbs === null ||
    !neatTier ||
    liftDaysPerWeek === null ||
    sessionMin === null ||
    cardioMinPerWeek === null ||
    trainingMonths === null ||
    !appetite ||
    !bulkStyle ||
    goalWeightLbs === null
  ) {
    return bad();
  }

  const supabase = supabaseServer();

  const [settingsRes, weighInsRes] = await Promise.all([
    supabase.from("settings").select("*").eq("id", 1).single(),
    supabase.from("weigh_ins").select("date, weight_lbs").order("date"),
  ]);
  if (settingsRes.error) return oops(settingsRes.error.message);
  if (weighInsRes.error) return oops(weighInsRes.error.message);
  const weighIns = weighInsRes.data.map((w) => ({
    date: w.date,
    weightLbs: w.weight_lbs,
  }));

  // The typed weight becomes a real weigh-in when the log has nothing recent —
  // future recalculations need the anchor.
  const latest = weighIns[weighIns.length - 1];
  if (!latest || latest.date < effectiveDate) {
    await supabase
      .from("weigh_ins")
      .upsert(
        { date: effectiveDate, weight_lbs: currentWeightLbs },
        { onConflict: "date" },
      );
    weighIns.push({ date: effectiveDate, weightLbs: currentWeightLbs });
    weighIns.sort((x, y) => (x.date < y.date ? -1 : 1));
  }

  const inputs: PlanInputs = {
    sex,
    birthDate,
    heightIn,
    currentWeightLbs,
    bodyFatPct,
    neatTier,
    liftDaysPerWeek,
    sessionMin,
    cardioMinPerWeek,
    trainingMonths,
    trainingMonthsAsOf: effectiveDate,
    appetite,
    bulkStyle,
    goalWeightLbs,
    rateOverride,
  };
  const pace = computePace(weighIns, settingsRes.data.goal_rate_lbs_per_week);
  const plan = buildPlan(inputs, {
    today: effectiveDate,
    weighIns,
    currentCalorieTarget: settingsRes.data.calorie_target,
    paceBand: pace.status === "ready" ? pace.band : null,
    observed: null,
  });

  // manual target tweaks from the reveal override the computed numbers
  const o = (b.overrides ?? {}) as Record<string, unknown>;
  const calorieTarget =
    asInt(o.calorieTarget, 1000, 10000) ?? plan.calorieTarget;
  const proteinG = asInt(o.proteinG, 30, 500) ?? plan.proteinG;
  const carbG = asInt(o.carbG, 50, 1200) ?? plan.carbG;
  const fatG = asInt(o.fatG, 20, 400) ?? plan.fatG;
  const customized =
    calorieTarget !== plan.calorieTarget ||
    proteinG !== plan.proteinG ||
    carbG !== plan.carbG ||
    fatG !== plan.fatG ||
    plan.rateSource === "custom";

  const { error: profileErr } = await supabase
    .from("profile")
    .update({
      sex,
      birth_date: birthDate,
      height_in: heightIn,
      body_fat_pct: bodyFatPct,
      neat_tier: neatTier,
      lift_days_per_week: liftDaysPerWeek,
      session_min: sessionMin,
      cardio_min_per_week: cardioMinPerWeek,
      training_months: trainingMonths,
      training_months_as_of: effectiveDate,
      appetite,
      bulk_style: bulkStyle,
      completed_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (profileErr) return oops(profileErr.message);

  const { error: rpcErr } = await supabase.rpc("apply_targets", {
    p_effective_date: effectiveDate,
    p_calorie_target: calorieTarget,
    p_protein_target_g: proteinG,
    p_carb_target_g: carbG,
    p_fat_target_g: fatG,
    p_goal_rate_lbs_per_week: plan.rateLbsPerWeek,
    p_goal_weight_lbs: goalWeightLbs,
    p_goal_rate_source: customized ? "custom" : "recommended",
    p_action: "questionnaire",
  });
  if (rpcErr) return oops(rpcErr.message);

  const [profileRes, newSettings] = await Promise.all([
    supabase.from("profile").select("*").eq("id", 1).single(),
    supabase.from("settings").select("*").eq("id", 1).single(),
  ]);
  if (profileRes.error) return oops(profileRes.error.message);
  if (newSettings.error) return oops(newSettings.error.message);

  return NextResponse.json({
    profile: profileDto(profileRes.data),
    settings: {
      calorieTarget: newSettings.data.calorie_target,
      proteinTargetG: newSettings.data.protein_target_g,
      carbTargetG: newSettings.data.carb_target_g,
      fatTargetG: newSettings.data.fat_target_g,
      goalRateLbsPerWeek: newSettings.data.goal_rate_lbs_per_week,
      goalWeightLbs: newSettings.data.goal_weight_lbs,
      goalRateSource: newSettings.data.goal_rate_source,
    },
    plan,
  });
}
