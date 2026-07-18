import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { asShortText, bad, oops, readBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const b = await readBody(req);
  const name = asShortText(b.name, 60);
  if (!name) return bad();
  const supabase = supabaseServer();
  const { error } = await supabase
    .from("exercises")
    .update({ name })
    .eq("id", id);
  if (error) return oops(error.message);
  return NextResponse.json({ ok: true });
}

/** Archive — history (and its PRs) stays intact under the covers. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const supabase = supabaseServer();
  const { error } = await supabase
    .from("exercises")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return oops(error.message);
  return NextResponse.json({ ok: true });
}
