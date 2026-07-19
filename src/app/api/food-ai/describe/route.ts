import { NextResponse } from "next/server";
import { asShortText, bad, readBody } from "@/lib/api";
import {
  analyzeFoodDescription,
  FoodAiUnavailableError,
} from "@/lib/food-ai";

// Model calls regularly outlive the platform's default function
// timeout; without this the request 504s before OpenAI answers.
export const maxDuration = 60;

export async function POST(req: Request) {
  const body = await readBody(req);
  const description = asShortText(body.description, 500);
  if (!description) return bad("description required");

  try {
    const food = await analyzeFoodDescription(description);
    return NextResponse.json({ food });
  } catch (error) {
    if (error instanceof FoodAiUnavailableError) {
      return NextResponse.json(
        { error: "Food AI is not configured" },
        { status: 503 },
      );
    }
    console.error("food description analysis failed", error);
    return NextResponse.json(
      { error: "Couldn't estimate that food" },
      { status: 502 },
    );
  }
}
