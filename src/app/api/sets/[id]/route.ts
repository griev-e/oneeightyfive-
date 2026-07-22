import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/lib/database.types";
import { asInt, asNum, asShortText, asUuid, bad, oops, readBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const id = asUuid((await ctx.params).id);
  if (!id) return bad("invalid id");
  const b = await readBody(req);
  const update: TablesUpdate<"workout_sets"> = {};
  if (b.weightLbs !== undefined) {
    const v = asNum(b.weightLbs, 0, 1500);
    if (v === null) return bad();
    update.weight_lbs = v;
  }
  if (b.reps !== undefined) {
    const v = asInt(b.reps, 1, 100);
    if (v === null) return bad();
    update.reps = v;
  }
  // explicit null clears rpe/note — "not recorded" beats a stale value
  if (b.rpe !== undefined) {
    if (b.rpe === null) {
      update.rpe = null;
    } else {
      const v = asNum(b.rpe, 5, 10);
      if (v === null) return bad();
      update.rpe = v;
    }
  }
  if (b.note !== undefined) {
    if (b.note === null) {
      update.note = null;
    } else {
      const v = asShortText(b.note, 200);
      if (v === null) return bad();
      update.note = v;
    }
  }
  if (Object.keys(update).length === 0) return bad("nothing to update");

  const supabase = supabaseServer();
  const { error } = await supabase
    .from("workout_sets")
    .update(update)
    .eq("id", id);
  if (error) return oops(error.message);
  return NextResponse.json({ ok: true });
}

/** Hard delete; set numbers keep their gaps — display index is array position. */
export async function DELETE(_req: Request, ctx: Ctx) {
  const id = asUuid((await ctx.params).id);
  if (!id) return bad("invalid id");
  const supabase = supabaseServer();
  const { error } = await supabase.from("workout_sets").delete().eq("id", id);
  if (error) return oops(error.message);
  return NextResponse.json({ ok: true });
}
