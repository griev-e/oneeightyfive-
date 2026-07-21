import { NextResponse } from "next/server";
import { allRows, supabaseServer } from "@/lib/supabase/server";
import { asIsoDate, asUuid, bad, oops } from "@/lib/api";
import { e1rm } from "@/lib/stats";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Everything the set logger needs, all strictly before `today` so ghosts
 * never chase themselves: last session's sets (positional ghosts), all-time
 * records for PR detection (incl. max reps at bodyweight), and recent
 * session summaries. Computed at read time — records are never stored.
 */
export async function GET(req: Request, ctx: Ctx) {
  const id = asUuid((await ctx.params).id);
  if (!id) return bad("invalid id");
  const today = asIsoDate(new URL(req.url).searchParams.get("today"));
  if (!today) return bad("today required");

  const supabase = supabaseServer();
  // all-time records need the complete per-exercise history — page past the
  // 1000-row cap or old PRs silently vanish
  const { data, error } = await allRows((f, t) =>
    supabase
      .from("workout_sets")
      .select("date, weight_lbs, reps, set_number, rpe")
      .eq("exercise_id", id)
      .lt("date", today)
      .order("date", { ascending: false })
      .order("set_number", { ascending: true })
      .range(f, t),
  );
  if (error) return oops(error.message);

  if (!data || data.length === 0) {
    return NextResponse.json({ lastSession: null, records: null, recent: [] });
  }

  const lastDate = data[0].date;
  const lastSession = {
    date: lastDate,
    sets: data
      .filter((s) => s.date === lastDate)
      .map((s) => ({ weightLbs: s.weight_lbs, reps: s.reps, rpe: s.rpe })),
  };

  let maxWeightLbs = 0;
  let maxE1rm = 0;
  let maxRepsAtBodyweight = 0;
  for (const s of data) {
    if (s.weight_lbs > 0) {
      maxWeightLbs = Math.max(maxWeightLbs, s.weight_lbs);
      maxE1rm = Math.max(maxE1rm, e1rm(s.weight_lbs, s.reps));
    } else {
      maxRepsAtBodyweight = Math.max(maxRepsAtBodyweight, s.reps);
    }
  }

  const byDate = new Map<string, { sets: number; topWeight: number; topReps: number }>();
  for (const s of data) {
    const d = byDate.get(s.date) ?? { sets: 0, topWeight: 0, topReps: 0 };
    d.sets += 1;
    if (s.weight_lbs > d.topWeight) {
      d.topWeight = s.weight_lbs;
      d.topReps = s.reps;
    } else if (s.weight_lbs === d.topWeight) {
      d.topReps = Math.max(d.topReps, s.reps);
    }
    byDate.set(s.date, d);
  }
  const recent = [...byDate.entries()]
    .slice(0, 15)
    .map(([date, d]) => ({ date, ...d }));

  return NextResponse.json({
    lastSession,
    records: { maxWeightLbs, maxE1rm, maxRepsAtBodyweight },
    recent,
  });
}
