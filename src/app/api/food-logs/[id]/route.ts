import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import type { TablesUpdate } from "@/lib/database.types";
import { asInt, asShortText, asUuid, bad, oops, readBody } from "@/lib/api";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  const id = asUuid((await ctx.params).id);
  if (!id) return bad("invalid id");
  const b = await readBody(req);
  const update: TablesUpdate<"food_logs"> = {};
  if (b.name !== undefined) {
    const name = asShortText(b.name, 80);
    if (!name) return bad();
    update.name = name;
  }
  if (b.calories !== undefined) {
    const v = asInt(b.calories, 1, 5000);
    if (v === null) return bad();
    update.calories = v;
  }
  for (const [key, col, hi] of [
    ["proteinG", "protein_g", 500],
    ["carbsG", "carbs_g", 1000],
    ["fatG", "fat_g", 500],
  ] as const) {
    if (b[key] !== undefined) {
      const v = asInt(b[key], 0, hi);
      if (v === null) return bad();
      update[col] = v;
    }
  }
  if (Object.keys(update).length === 0) return bad("nothing to update");

  const supabase = supabaseServer();
  const { error } = await supabase.from("food_logs").update(update).eq("id", id);
  if (error) return oops(error.message);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const id = asUuid((await ctx.params).id);
  if (!id) return bad("invalid id");
  const supabase = supabaseServer();
  const { error } = await supabase.from("food_logs").delete().eq("id", id);
  if (error) return oops(error.message);
  return NextResponse.json({ ok: true });
}
