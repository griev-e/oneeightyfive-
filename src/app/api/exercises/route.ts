import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { asShortText, bad, oops, readBody } from "@/lib/api";

const EXERCISE_COLUMNS = "id, name, is_seeded, sort_order, rest_seconds";

const toDto = (e: {
  id: string;
  name: string;
  is_seeded: boolean;
  sort_order: number;
  rest_seconds: number | null;
}) => ({
  id: e.id,
  name: e.name,
  isSeeded: e.is_seeded,
  sortOrder: e.sort_order,
  restSeconds: e.rest_seconds,
});

export async function GET() {
  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("exercises")
    .select(EXERCISE_COLUMNS)
    .is("archived_at", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  if (error) return oops(error.message);
  return NextResponse.json(data.map(toDto));
}

export async function POST(req: Request) {
  const b = await readBody(req);
  const name = asShortText(b.name, 60);
  if (!name) return bad();

  const supabase = supabaseServer();
  const { data, error } = await supabase
    .from("exercises")
    .insert({ name })
    .select(EXERCISE_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "already exists" }, { status: 409 });
    }
    return oops(error.message);
  }
  return NextResponse.json(toDto(data));
}
