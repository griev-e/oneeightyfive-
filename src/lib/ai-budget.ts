import { supabaseServer } from "@/lib/supabase/server";

/**
 * Daily cap on food-AI calls — the only route family that spends provider
 * money, and the blast radius if the unlock cookie ever leaks. Counted in a
 * one-row-per-UTC-day table via the bump_ai_usage RPC so the count survives
 * serverless cold starts.
 */
const DEFAULT_DAILY_CAP = 60;

/**
 * Returns null when the call is within budget, or the seconds until the UTC
 * day rolls over when the cap is exhausted (for a Retry-After header).
 * Fail-open on any DB problem: a Supabase hiccup must never take capture down.
 */
export async function consumeAiBudget(): Promise<number | null> {
  const cap = Number(process.env.AI_DAILY_CAP ?? DEFAULT_DAILY_CAP);
  if (!Number.isFinite(cap) || cap <= 0) return null;
  try {
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    const { data, error } = await supabaseServer().rpc("bump_ai_usage", {
      p_day: day,
    });
    if (error || typeof data !== "number" || data <= cap) return null;
    const nextUtcMidnight = Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
    );
    return Math.max(60, Math.ceil((nextUtcMidnight - now.getTime()) / 1000));
  } catch {
    return null;
  }
}
