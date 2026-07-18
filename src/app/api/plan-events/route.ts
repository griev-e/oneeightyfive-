import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { asInt, asIsoDate, bad, oops, readBody } from "@/lib/api";

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("plan_events")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) return oops(error.message);
  const e = data[0];
  return NextResponse.json(
    e
      ? {
          id: e.id,
          date: e.date,
          action: e.action,
          observedTdee: e.observed_tdee,
          targetBefore: e.target_before,
          targetSuggested: e.target_suggested,
          createdAt: e.created_at,
        }
      : null,
  );
}

/** Dismissals restart the recalibration cadence clock. */
export async function POST(req: Request) {
  const b = await readBody(req);
  const date = asIsoDate(b.date);
  if (!date || b.action !== "dismissed") return bad();
  const supabase = supabaseServer();
  const { error } = await supabase.from("plan_events").insert({
    date,
    action: "dismissed",
    observed_tdee: asInt(b.observedTdee ?? null, 0, 10000),
    target_before: asInt(b.targetBefore ?? null, 0, 10000),
    target_suggested: asInt(b.targetSuggested ?? null, 0, 10000),
  });
  if (error) return oops(error.message);
  return NextResponse.json({ ok: true });
}
