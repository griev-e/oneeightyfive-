import { NextResponse } from "next/server";
import { sameOrigin } from "@/lib/api";
import { consumeAiBudget } from "@/lib/ai-budget";
import { analyzeFoodDescription, transcribeFoodAudio } from "@/lib/food-ai";
import { foodAiBudgetExhausted, foodAiFailure } from "../respond";

// Model calls regularly outlive the platform's default function
// timeout; without this the request 504s before the model answers.
export const maxDuration = 60;

const MAX_AUDIO_BYTES = 6 * 1024 * 1024;

export async function POST(req: Request) {
  // multipart POSTs are CORS "simple requests" — reject cross-site senders
  if (!sameOrigin(req)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
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

  const retryAfterS = await consumeAiBudget();
  if (retryAfterS !== null) return foodAiBudgetExhausted(retryAfterS);

  try {
    const transcript = await transcribeFoodAudio(file);
    // Transcription may have spent up to 30s of the 60s maxDuration, so the
    // analysis leg gets a single shorter attempt instead of 25s × 2 — the
    // platform killing the function mid-flight is worse than one clean 502.
    const food = await analyzeFoodDescription(transcript, {
      timeoutMs: 20_000,
      maxRetries: 0,
    });
    return NextResponse.json({ transcript, food });
  } catch (error) {
    console.error("food voice analysis failed", error);
    return foodAiFailure(error, "Couldn't understand that recording");
  }
}
