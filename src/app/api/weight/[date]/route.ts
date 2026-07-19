import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { asIsoDate, bad, oops } from "@/lib/api";

type Ctx = { params: Promise<{ date: string }> };

export async function DELETE(_req: Request, ctx: Ctx) {
  const { date: raw } = await ctx.params;
  const date = asIsoDate(raw);
  if (!date) return bad("invalid date");
  const supabase = supabaseServer();
  const { error } = await supabase.from("weigh_ins").delete().eq("date", date);
  if (error) return oops(error.message);
  return NextResponse.json({ ok: true });
}
