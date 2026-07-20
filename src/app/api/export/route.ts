import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { oops } from "@/lib/api";

/**
 * The backup: every table the app owns as one versioned JSON document.
 * Rows are raw snake_case on purpose — an export is schema-faithful, not a
 * DTO — and each table pages past PostgREST's 1000-row cap ordered by its
 * primary key. The client names the file; the header is only a fallback.
 */

const TABLES = [
  ["settings", "id"],
  ["profile", "id"],
  ["target_history", "effective_date"],
  ["plan_events", "id"],
  ["weigh_ins", "date"],
  ["meals", "id"],
  ["food_logs", "id"],
  ["exercises", "id"],
  ["workout_sets", "id"],
] as const;

const PAGE = 1000;

export async function GET() {
  const supabase = supabaseServer();
  const tables: Record<string, unknown[]> = {};
  for (const [table, orderBy] of TABLES) {
    const rows: unknown[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from(table)
        .select("*")
        .order(orderBy, { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) return oops(error.message);
      rows.push(...data);
      if (data.length < PAGE) break;
    }
    tables[table] = rows;
  }

  return NextResponse.json(
    {
      app: "surplus",
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      tables,
    },
    {
      headers: {
        "content-disposition": 'attachment; filename="surplus-export.json"',
        "cache-control": "no-store",
      },
    },
  );
}
