import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { asShortText, bad, oops, readBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const b = await readBody(req);
  const update: { name?: string; archived_at?: null } = {};
  if (b.name !== undefined) {
    const name = asShortText(b.name, 60);
    if (!name) return bad();
    update.name = name;
  }
  // { archived: false } restores an archived exercise (the archive-Undo path)
  if (b.archived === false) update.archived_at = null;
  if (Object.keys(update).length === 0) return bad("nothing to update");
  const supabase = supabaseServer();
  const { error } = await supabase
    .from("exercises")
    .update(update)
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
