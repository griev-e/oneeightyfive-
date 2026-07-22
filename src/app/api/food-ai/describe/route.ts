import { NextResponse } from "next/server";
import { asShortText, bad, readBody } from "@/lib/api";
import { consumeAiBudget } from "@/lib/ai-budget";
import { analyzeFoodDescription } from "@/lib/food-ai";
import { foodAiBudgetExhausted, foodAiFailure } from "../respond";

// Model calls regularly outlive the platform's default function
// timeout; without this the request 504s before the model answers.
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await readBody(req);
  const description = asShortText(body.description, 500);
  if (!description) return bad("description required");

  const retryAfterS = await consumeAiBudget();
  if (retryAfterS !== null) return foodAiBudgetExhausted(retryAfterS);

  try {
    const food = await analyzeFoodDescription(description);
    return NextResponse.json({ food });
  } catch (error) {
    console.error("food description analysis failed", error);
    return foodAiFailure(error, "Couldn't estimate that food");
  }
}
