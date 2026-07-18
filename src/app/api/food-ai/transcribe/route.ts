import { NextResponse } from "next/server";
import {
  analyzeFoodDescription,
  FoodAiUnavailableError,
  transcribeFoodAudio,
} from "@/lib/food-ai";

const MAX_AUDIO_BYTES = 6 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null);
  const file = form?.get("audio");
  if (
    !(file instanceof File) ||
    !file.type.startsWith("audio/") ||
    file.size < 1 ||
    file.size > MAX_AUDIO_BYTES
  ) {
    return NextResponse.json({ error: "invalid audio" }, { status: 400 });
  }

  try {
    const transcript = await transcribeFoodAudio(file);
    const food = await analyzeFoodDescription(transcript);
    return NextResponse.json({ transcript, food });
  } catch (error) {
    if (error instanceof FoodAiUnavailableError) {
      return NextResponse.json(
        { error: "Food AI is not configured" },
        { status: 503 },
      );
    }
    console.error("food voice analysis failed", error);
    return NextResponse.json(
      { error: "Couldn't understand that recording" },
      { status: 502 },
    );
  }
}
