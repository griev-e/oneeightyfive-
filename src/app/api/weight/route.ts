import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("weigh_ins")
    .select("date, weight_lbs")
    .order("date", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(
    data.map((w) => ({ date: w.date, weightLbs: w.weight_lbs })),
  );
}

export async function PUT(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    date?: unknown;
    weightLbs?: unknown;
  } | null;
  const date = typeof body?.date === "string" ? body.date : "";
  const weightLbs =
    typeof body?.weightLbs === "number" ? body.weightLbs : NaN;

  if (!ISO_DATE.test(date) || !(weightLbs >= 50 && weightLbs <= 500)) {
    return NextResponse.json({ error: "invalid weigh-in" }, { status: 400 });
  }

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("weigh_ins")
    .upsert({ date, weight_lbs: weightLbs }, { onConflict: "date" })
    .select("date, weight_lbs")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ date: data.date, weightLbs: data.weight_lbs });
}
