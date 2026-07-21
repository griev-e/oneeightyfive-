import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Server-only Supabase client using the secret key — it bypasses RLS, and
 * RLS has zero policies, so this is the ONLY path to the data. The secret
 * key must never appear in client code or NEXT_PUBLIC_* vars; the PIN
 * middleware gates every route that uses this.
 */
export function supabaseServer() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SECRET_KEY are not configured");
  }
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const PAGE_SIZE = 1000;

/**
 * PostgREST silently caps un-ranged selects at 1000 rows — enough to corrupt
 * any multi-year read (observed TDEE, day summaries, weigh-in history).
 * Callers rebuild their query per page; ordering must be deterministic.
 */
export async function allRows<T>(
  page: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<{ data: T[] | null; error: { message: string } | null }> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { data: rows, error: null };
  }
}
