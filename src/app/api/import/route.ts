import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { bad, oops } from "@/lib/api";

/**
 * The restore half of /api/export: replaces every table's contents with the
 * rows from a schemaVersion-1 export. Children clear before parents, parents
 * insert before children, singletons (settings/profile) upsert in place.
 * PostgREST has no cross-request transactions, so a mid-restore failure can
 * leave partial state — the client warns and the fix is re-importing.
 */

export const maxDuration = 60;

const SINGLETONS = ["settings", "profile"] as const;
// deletion order: FK children first; insertion runs in reverse
const COLLECTIONS = [
  "food_logs",
  "workout_sets",
  "meals",
  "exercises",
  "weigh_ins",
  "target_history",
  "plan_events",
] as const;
type Collection = (typeof COLLECTIONS)[number];

const PK: Record<Collection, string> = {
  food_logs: "id",
  workout_sets: "id",
  meals: "id",
  exercises: "id",
  weigh_ins: "date",
  target_history: "effective_date",
  plan_events: "id",
};

const CHUNK = 500;
const MAX_TOTAL_ROWS = 500_000;

function rowsOf(tables: Record<string, unknown>, name: string): Record<string, unknown>[] | null {
  const rows = tables[name];
  if (rows === undefined) return [];
  if (!Array.isArray(rows)) return null;
  if (!rows.every((r) => r !== null && typeof r === "object" && !Array.isArray(r))) {
    return null;
  }
  return rows as Record<string, unknown>[];
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    app?: unknown;
    schemaVersion?: unknown;
    tables?: unknown;
  } | null;
  if (
    !body ||
    body.app !== "surplus" ||
    body.schemaVersion !== 1 ||
    !body.tables ||
    typeof body.tables !== "object"
  ) {
    return bad("not a Surplus schemaVersion-1 export");
  }
  const tables = body.tables as Record<string, unknown>;

  const parsed = new Map<Collection, Record<string, unknown>[]>();
  let total = 0;
  for (const name of COLLECTIONS) {
    const rows = rowsOf(tables, name);
    if (rows === null) return bad(`malformed table: ${name}`);
    parsed.set(name, rows);
    total += rows.length;
  }
  if (total > MAX_TOTAL_ROWS) return bad("export too large");

  const supabase = supabaseServer();
  const counts: Record<string, number> = {};

  // 1. singletons upsert in place
  for (const name of SINGLETONS) {
    const rows = rowsOf(tables, name);
    if (rows === null) return bad(`malformed table: ${name}`);
    if (rows.length === 0) continue;
    const { error } = await supabase
      .from(name)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw export rows are schema-faithful by contract
      .upsert(rows[0] as any, { onConflict: "id" });
    if (error) return oops(error.message);
    counts[name] = 1;
  }

  // 2. clear children → parents
  for (const name of COLLECTIONS) {
    const { error } = await supabase.from(name).delete().not(PK[name], "is", null);
    if (error) return oops(error.message);
  }

  // 3. insert parents → children, chunked
  for (const name of [...COLLECTIONS].reverse()) {
    const rows = parsed.get(name) ?? [];
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase
        .from(name)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw export rows are schema-faithful by contract
        .insert(rows.slice(i, i + CHUNK) as any);
      if (error) return oops(error.message);
    }
    counts[name] = rows.length;
  }

  return NextResponse.json({ ok: true, counts });
}
