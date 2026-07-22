import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/api";
import { consumeAiBudget } from "@/lib/ai-budget";
import { analyzeFoodImage, type FoodImageMediaType } from "@/lib/food-ai";
import { foodAiBudgetExhausted, foodAiFailure } from "../respond";

// Vision analysis regularly outlives the platform's default function
// timeout; without this the reader 504s before the model answers.
export const maxDuration = 60;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  // multipart POSTs are CORS "simple requests" — reject cross-site senders
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  const mode = form?.get("mode");
  if (
    !(file instanceof File) ||
    (mode !== "label" && mode !== "meal-photo") ||
    !IMAGE_TYPES.has(file.type) ||
    file.size < 1 ||
    file.size > MAX_IMAGE_BYTES
  ) {
    return NextResponse.json({ error: "invalid image" }, { status: 400 });
  }

  const retryAfterS = await consumeAiBudget();
  if (retryAfterS !== null) return foodAiBudgetExhausted(retryAfterS);

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const food = await analyzeFoodImage(
      mode,
      file.type as FoodImageMediaType,
      base64,
    );
    return NextResponse.json({ food });
  } catch (error) {
    console.error("food image analysis failed", error);
    return foodAiFailure(error, "Couldn't read that image");
  }
}
