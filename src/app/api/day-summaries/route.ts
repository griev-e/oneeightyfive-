import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { asIsoDate, bad, oops } from "@/lib/api";

/**
 * One round trip for the streak + week chip: per-day intake sums (with entry
 * counts, so recalibration can tell a logged day from a lone snack), the full
 * target history, and distinct training dates.
 */
export async function GET(req: Request) {
  const from = asIsoDate(new URL(req.url).searchParams.get("from"));
  if (!from) return bad("from required");

  const supabase = supabaseServer();
  const [logs, targets, sets] = await Promise.all([
    supabase
      .from("food_logs")
      .select("date, calories, protein_g, carbs_g, fat_g")
      .gte("date", from)
      .order("date"),
    supabase
      .from("target_history")
      .select("effective_date, calorie_target, protein_target_g, carb_target_g, fat_target_g")
      .order("effective_date"),
    supabase
      .from("workout_sets")
      .select("date, weight_lbs, reps")
      .gte("date", from),
  ]);
  if (logs.error) return oops(logs.error.message);
  if (targets.error) return oops(targets.error.message);
  if (sets.error) return oops(sets.error.message);

  const byDate = new Map<
    string,
    { calories: number; proteinG: number; carbsG: number; fatG: number; entryCount: number }
  >();
  for (const l of logs.data) {
    const d =
      byDate.get(l.date) ??
      { calories: 0, proteinG: 0, carbsG: 0, fatG: 0, entryCount: 0 };
    d.calories += l.calories;
    d.proteinG += l.protein_g;
    d.carbsG += l.carbs_g;
    d.fatG += l.fat_g;
    d.entryCount += 1;
    byDate.set(l.date, d);
  }

  const liftByDate = new Map<string, { volumeLbs: number; sets: number }>();
  for (const s of sets.data) {
    const d = liftByDate.get(s.date) ?? { volumeLbs: 0, sets: 0 };
    d.volumeLbs += s.weight_lbs * s.reps;
    d.sets += 1;
    liftByDate.set(s.date, d);
  }

  return NextResponse.json({
    days: [...byDate.entries()].map(([date, d]) => ({ date, ...d })),
    targets: targets.data.map((t) => ({
      effectiveDate: t.effective_date,
      calorieTarget: t.calorie_target,
      proteinTargetG: t.protein_target_g,
      carbTargetG: t.carb_target_g,
      fatTargetG: t.fat_target_g,
    })),
    trainingDates: [...liftByDate.keys()].sort(),
    liftDays: [...liftByDate.entries()]
      .map(([date, d]) => ({ date, ...d }))
      .sort((a, b) => (a.date < b.date ? -1 : 1)),
  });
}
