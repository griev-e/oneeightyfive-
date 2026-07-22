import { NextResponse } from "next/server";
import { FoodAiError, FoodAiUnavailableError } from "@/lib/food-ai";

/**
 * Shared failure mapping for the three capture routes. Every response carries
 * a machine-readable `code` so the client can pick the right toast: a refusal
 * must not say "try again", a rate limit should say "in a minute".
 */
export function foodAiFailure(error: unknown, fallback: string) {
  if (error instanceof FoodAiUnavailableError) {
    return NextResponse.json(
      { error: "Food AI is not configured", code: "unavailable" },
      { status: 503 },
    );
  }
  if (error instanceof FoodAiError) {
    switch (error.code) {
      case "refused":
        return NextResponse.json(
          { error: "Claude declined to analyze this input", code: "refused" },
          { status: 422 },
        );
      case "rate_limited":
        return NextResponse.json(
          { error: "Food AI is busy right now", code: "rate_limited" },
          { status: 429, headers: { "retry-after": "30" } },
        );
      case "timeout":
        return NextResponse.json(
          { error: fallback, code: "timeout" },
          { status: 502 },
        );
      default:
        return NextResponse.json(
          { error: fallback, code: error.code },
          { status: 502 },
        );
    }
  }
  return NextResponse.json({ error: fallback, code: "upstream" }, { status: 502 });
}

/** 429 for the app's own daily spend cap (distinct from provider limits). */
export function foodAiBudgetExhausted(retryAfterS: number) {
  return NextResponse.json(
    { error: "Daily food-AI limit reached", code: "rate_limited" },
    { status: 429, headers: { "retry-after": String(retryAfterS) } },
  );
}
