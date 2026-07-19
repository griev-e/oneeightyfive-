import { NextResponse } from "next/server";
import {
  analyzeFoodImage,
  FoodAiUnavailableError,
  type FoodImageMediaType,
} from "@/lib/food-ai";

// Vision analysis regularly outlives the platform's default function
// timeout; without this the reader 504s before the model answers.
export const maxDuration = 60;

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
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

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const food = await analyzeFoodImage(
      mode,
      file.type as FoodImageMediaType,
      base64,
    );
    return NextResponse.json({ food });
  } catch (error) {
    if (error instanceof FoodAiUnavailableError) {
      return NextResponse.json(
        { error: "Food AI is not configured" },
        { status: 503 },
      );
    }
    console.error("food image analysis failed", error);
    return NextResponse.json(
      { error: "Couldn't read that image" },
      { status: 502 },
    );
  }
}
