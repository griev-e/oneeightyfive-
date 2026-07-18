import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { asIsoDate, bad, oops, readBody } from "@/lib/api";
import {
  buildPlan,
  estimateObservedTdee,
  type Appetite,
  type BulkStyle,
  type DayIntake,
  type NeatTier,
  type PlanInputs,
  type Sex,
} from "@/lib/plan";
import { computePace } from "@/lib/stats";
import { targetFor, type TargetRow } from "@/lib/streaks";
import {
  RECALIBRATION_MIN_DELTA,
  shouldSuggestRecalibration,
} from "@/lib/recalibration";

/**
 * The "your real TDEE looks like X" engine — server-authoritative like every
 * other target write. It reruns buildPlan twice (once to learn the lean
 * fraction the observed-TDEE math needs, once with the observation blended in),
 * so the suggested numbers are computed here, never trusted from the client.
 */

type Ready = {
  status: "ready";
  observedTdee: number;
  confidence: number;
  currentTarget: number;
  suggestedTarget: number;
  suggestedProteinG: number;
  suggestedCarbG: number;
  suggestedFatG: number;
  direction: "up" | "down";
};

type Computed =
  | { ready: false }
  | {
      ready: true;
      inputs: PlanInputs;
      today: string;
      plan: ReturnType<typeof buildPlan>;
      observedTdee: number;
      confidence: number;
      currentTarget: number;
      settingsId: number;
    };

async function compute(today: string): Promise<Computed> {
  const supabase = supabaseServer();

  const [profileRes, settingsRes, weighInsRes, logsRes, targetsRes, eventRes] =
    await Promise.all([
      supabase.from("profile").select("*").eq("id", 1).single(),
      supabase.from("settings").select("*").eq("id", 1).single(),
      supabase.from("weigh_ins").select("date, weight_lbs").order("date"),
      supabase.from("food_logs").select("date, calories"),
      supabase
        .from("target_history")
        .select(
          "effective_date, calorie_target, protein_target_g, carb_target_g, fat_target_g",
        ),
      supabase
        .from("plan_events")
        .select("date")
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
  if (profileRes.error) throw new Error(profileRes.error.message);
  if (settingsRes.error) throw new Error(settingsRes.error.message);
  if (weighInsRes.error) throw new Error(weighInsRes.error.message);
  if (logsRes.error) throw new Error(logsRes.error.message);
  if (targetsRes.error) throw new Error(targetsRes.error.message);
  if (eventRes.error) throw new Error(eventRes.error.message);

  const p = profileRes.data;
  const s = settingsRes.data;

  // Only a completed questionnaire has the inputs buildPlan needs.
  if (
    p.completed_at === null ||
    !p.birth_date ||
    p.height_in === null ||
    !p.neat_tier ||
    p.lift_days_per_week === null ||
    p.session_min === null ||
    p.cardio_min_per_week === null ||
    p.training_months === null ||
    !p.training_months_as_of ||
    !p.appetite ||
    !p.bulk_style ||
    s.goal_weight_lbs === null
  ) {
    return { ready: false };
  }

  const weighIns = weighInsRes.data.map((w) => ({
    date: w.date,
    weightLbs: w.weight_lbs,
  }));

  const inputs: PlanInputs = {
    sex: p.sex as Sex,
    birthDate: p.birth_date,
    heightIn: p.height_in,
    currentWeightLbs:
      weighIns[weighIns.length - 1]?.weightLbs ?? s.goal_weight_lbs,
    bodyFatPct: p.body_fat_pct,
    neatTier: p.neat_tier as NeatTier,
    liftDaysPerWeek: p.lift_days_per_week,
    sessionMin: p.session_min,
    cardioMinPerWeek: p.cardio_min_per_week,
    trainingMonths: p.training_months,
    trainingMonthsAsOf: p.training_months_as_of,
    appetite: p.appetite as Appetite,
    bulkStyle: p.bulk_style as BulkStyle,
    goalWeightLbs: s.goal_weight_lbs,
    rateOverride:
      s.goal_rate_source === "custom" ? s.goal_rate_lbs_per_week : null,
  };

  const pace = computePace(weighIns, s.goal_rate_lbs_per_week);
  const baseCtx = {
    today,
    weighIns,
    currentCalorieTarget: s.calorie_target,
    paceBand: pace.status === "ready" ? pace.band : null,
  };

  // First pass (no observation) just to learn the lean fraction the observed
  // math needs, then the real observed TDEE, then the blended plan.
  const planNoObs = buildPlan(inputs, { ...baseCtx, observed: null });

  const targetRows: TargetRow[] = targetsRes.data.map((t) => ({
    effectiveDate: t.effective_date,
    calorieTarget: t.calorie_target,
    proteinTargetG: t.protein_target_g,
    carbTargetG: t.carb_target_g,
    fatTargetG: t.fat_target_g,
  }));

  const byDate = new Map<string, { calories: number; entryCount: number }>();
  for (const l of logsRes.data) {
    const d = byDate.get(l.date) ?? { calories: 0, entryCount: 0 };
    d.calories += l.calories;
    d.entryCount += 1;
    byDate.set(l.date, d);
  }
  const days: DayIntake[] = [...byDate.entries()].map(([date, d]) => ({
    date,
    calories: d.calories,
    entryCount: d.entryCount,
  }));

  const observed = estimateObservedTdee(
    days,
    (date) => targetFor(date, targetRows, s.calorie_target),
    weighIns,
    planNoObs.leanFraction,
    today,
  );
  if (!observed) return { ready: false };

  const plan = buildPlan(inputs, { ...baseCtx, observed });

  return {
    ready: true,
    inputs,
    today,
    plan,
    observedTdee: observed.observedTDEE,
    confidence: observed.confidence,
    currentTarget: s.calorie_target,
    settingsId: 1,
  };
}

export async function GET(req: Request) {
  const today = asIsoDate(new URL(req.url).searchParams.get("today"));
  if (!today) return bad("today required");

  let computed: Computed;
  try {
    computed = await compute(today);
  } catch (e) {
    return oops(e instanceof Error ? e.message : "recalibration failed");
  }
  if (!computed.ready) return NextResponse.json({ status: "none" });

  // Cadence: any prior plan event (applied/dismissed) holds the card back.
  const supabase = supabaseServer();
  const { data: events, error } = await supabase
    .from("plan_events")
    .select("date")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return oops(error.message);
  const lastEventDate = events[0]?.date ?? null;

  const suggestedTarget = computed.plan.calorieTarget;
  if (
    !shouldSuggestRecalibration({
      currentTarget: computed.currentTarget,
      suggestedTarget,
      lastEventDate,
      today,
    })
  ) {
    return NextResponse.json({ status: "none" });
  }

  const payload: Ready = {
    status: "ready",
    observedTdee: computed.observedTdee,
    confidence: computed.confidence,
    currentTarget: computed.currentTarget,
    suggestedTarget,
    suggestedProteinG: computed.plan.proteinG,
    suggestedCarbG: computed.plan.carbG,
    suggestedFatG: computed.plan.fatG,
    direction: suggestedTarget >= computed.currentTarget ? "up" : "down",
  };
  return NextResponse.json(payload);
}

/** Apply the observed-blend plan through the same atomic RPC as everything else. */
export async function POST(req: Request) {
  const b = await readBody(req);
  const today = asIsoDate(b.date);
  if (!today) return bad();

  let computed: Computed;
  try {
    computed = await compute(today);
  } catch (e) {
    return oops(e instanceof Error ? e.message : "recalibration failed");
  }
  if (!computed.ready) return bad("nothing to recalibrate");

  const { plan, currentTarget, observedTdee } = computed;
  if (Math.abs(plan.calorieTarget - currentTarget) < RECALIBRATION_MIN_DELTA) {
    return bad("nothing to recalibrate");
  }

  const supabase = supabaseServer();
  const { error: rpcErr } = await supabase.rpc("apply_targets", {
    p_effective_date: today,
    p_calorie_target: plan.calorieTarget,
    p_protein_target_g: plan.proteinG,
    p_carb_target_g: plan.carbG,
    p_fat_target_g: plan.fatG,
    p_goal_rate_lbs_per_week: plan.rateLbsPerWeek,
    p_goal_rate_source: plan.rateSource,
    p_action: "applied",
    p_observed_tdee: observedTdee,
  });
  if (rpcErr) return oops(rpcErr.message);

  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) return oops(error.message);

  return NextResponse.json({
    settings: {
      calorieTarget: data.calorie_target,
      proteinTargetG: data.protein_target_g,
      carbTargetG: data.carb_target_g,
      fatTargetG: data.fat_target_g,
      goalRateLbsPerWeek: data.goal_rate_lbs_per_week,
      goalWeightLbs: data.goal_weight_lbs,
      goalRateSource: data.goal_rate_source,
    },
  });
}
