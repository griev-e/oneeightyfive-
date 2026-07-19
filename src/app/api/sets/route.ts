import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { asInt, asIsoDate, asNum, asShortText, bad, oops, readBody } from "@/lib/api";

const SET_COLUMNS = "id, date, exercise_id, weight_lbs, reps, set_number, rpe, note";

const toDto = (s: {
  id: string;
  date: string;
  exercise_id: string;
  weight_lbs: number;
  reps: number;
  set_number: number;
  rpe: number | null;
  note: string | null;
}) => ({
  id: s.id,
  date: s.date,
  exerciseId: s.exercise_id,
  weightLbs: s.weight_lbs,
  reps: s.reps,
  setNumber: s.set_number,
  rpe: s.rpe,
  note: s.note,
});

export async function GET(req: Request) {
  const date = asIsoDate(new URL(req.url).searchParams.get("date"));
  if (!date) return bad("date required");
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("workout_sets")
    .select(SET_COLUMNS)
    .eq("date", date)
    .order("exercise_id")
    .order("set_number");
  if (error) return oops(error.message);
  return NextResponse.json(data.map(toDto));
}

export async function POST(req: Request) {
  const b = await readBody(req);
  const date = asIsoDate(b.date);
  const exerciseId = typeof b.exerciseId === "string" ? b.exerciseId : null;
  const weightLbs = asNum(b.weightLbs, 0, 1500);
  const reps = asInt(b.reps, 1, 100);
  if (!date || !exerciseId || weightLbs === null || reps === null) return bad();
  // rpe/note are optional — present-but-invalid is still a 400
  let rpe: number | null = null;
  if (b.rpe !== undefined && b.rpe !== null) {
    rpe = asNum(b.rpe, 5, 10);
    if (rpe === null) return bad();
  }
  let note: string | null = null;
  if (b.note !== undefined && b.note !== null) {
    note = asShortText(b.note, 200);
    if (note === null) return bad();
  }

  const supabase = supabaseServer();
  // server assigns set_number; one retry absorbs a same-moment double-log
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data: maxRow } = await supabase
      .from("workout_sets")
      .select("set_number")
      .eq("date", date)
      .eq("exercise_id", exerciseId)
      .order("set_number", { ascending: false })
      .limit(1)
      .maybeSingle();
    const setNumber = (maxRow?.set_number ?? 0) + 1;
    const { data, error } = await supabase
      .from("workout_sets")
      .insert({
        date,
        exercise_id: exerciseId,
        weight_lbs: weightLbs,
        reps,
        set_number: setNumber,
        rpe,
        note,
      })
      .select(SET_COLUMNS)
      .single();
    if (!error) return NextResponse.json(toDto(data));
    if (error.code !== "23505") return oops(error.message);
  }
  return oops("could not assign set number");
}
