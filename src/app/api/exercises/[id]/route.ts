import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { asInt, asShortText, asUuid, bad, oops, readBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const id = asUuid((await ctx.params).id);
  if (!id) return bad("invalid id");
  const b = await readBody(req);
  const update: { name?: string; archived_at?: null; rest_seconds?: number | null } = {};
  if (b.name !== undefined) {
    const name = asShortText(b.name, 60);
    if (!name) return bad();
    update.name = name;
  }
  // explicit null clears the per-exercise rest target back to the default
  if (b.restSeconds !== undefined) {
    if (b.restSeconds === null) {
      update.rest_seconds = null;
    } else {
      const v = asInt(b.restSeconds, 30, 600);
      if (v === null) return bad();
      update.rest_seconds = v;
    }
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
  const id = asUuid((await ctx.params).id);
  if (!id) return bad("invalid id");
  const supabase = supabaseServer();
  const { error } = await supabase
    .from("exercises")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return oops(error.message);
  return NextResponse.json({ ok: true });
}
