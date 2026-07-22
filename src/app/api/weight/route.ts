import { NextResponse } from "next/server";
import { allRows, supabaseServer } from "@/lib/supabase/server";
import { asIsoDate, asNum, bad, oops, readBody } from "@/lib/api";

export async function GET() {
  const supabase = supabaseServer();
  // daily weigh-ins pass PostgREST's 1000-row cap after ~3 years — page
  const { data, error } = await allRows((f, t) =>
    supabase
      .from("weigh_ins")
      .select("date, weight_lbs")
      .order("date", { ascending: true })
      .range(f, t),
  );
  if (error) return oops(error.message);
  if (!data) return oops("no rows");
  return NextResponse.json(
    data.map((w) => ({ date: w.date, weightLbs: w.weight_lbs })),
  );
}

/** Upsert by date — editing a historical weigh-in is a PUT with that date. */
export async function PUT(req: Request) {
  const b = await readBody(req);
  const date = asIsoDate(b.date);
  const weightLbs = asNum(b.weightLbs, 50, 500);
  if (!date || weightLbs === null) return bad("invalid weigh-in");

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("weigh_ins")
    .upsert({ date, weight_lbs: weightLbs }, { onConflict: "date" })
    .select("date, weight_lbs")
    .single();
  if (error) return oops(error.message);
  return NextResponse.json({ date: data.date, weightLbs: data.weight_lbs });
}
