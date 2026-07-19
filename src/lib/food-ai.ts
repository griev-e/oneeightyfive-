import Anthropic from "@anthropic-ai/sdk";

export type FoodAnalysisMode = "description" | "label" | "meal-photo";

export type FoodImageMediaType = "image/jpeg" | "image/png" | "image/webp";

export type AnalyzedFood = {
  name: string;
  servingLabel: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  confidence: "high" | "medium" | "low";
  notes: string;
};

export class FoodAiUnavailableError extends Error {}

// Structured-outputs schema. The API rejects numeric/length constraints
// (minimum, maxLength, …) in strict JSON schemas — range clamping stays in
// normalizeAnalysis instead.
const FOOD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "name",
    "servingLabel",
    "calories",
    "proteinG",
    "carbsG",
    "fatG",
    "confidence",
    "notes",
  ],
  properties: {
    name: { type: "string" },
    servingLabel: { type: "string" },
    calories: { type: "integer" },
    proteinG: { type: "integer" },
    carbsG: { type: "integer" },
    fatG: { type: "integer" },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    notes: { type: "string" },
  },
} as const;

const BASE_INSTRUCTIONS = `You extract a single aggregate food-log entry for a calorie-surplus tracker.
Return calories, protein, carbohydrates, and fat for the amount described or visible.
Use integer values. Never add health advice. Be conservative and explicitly note assumptions.
The user reviews every result before logging it.`;

const MODE_INSTRUCTIONS: Record<FoodAnalysisMode, string> = {
  description: `Interpret the user's natural-language food description, including quantities and units. Aggregate multiple foods into one entry. Use standard nutrition references when exact branding is absent.`,
  label: `Read the nutrition-facts label. Return values for exactly one stated serving, not the whole package. Prefer printed values over visual estimates. Mention the serving size and any unreadable or derived field.`,
  "meal-photo": `Identify visible foods and estimate their portions. Aggregate the complete visible meal. Account for likely cooking oil or sauces only when visually supported. Meal-photo estimates are inherently uncertain, so confidence must never be high.`,
};

function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new FoodAiUnavailableError("ANTHROPIC_API_KEY is not configured");
  }
  // 25s per attempt + 1 retry stays inside the route's 60s maxDuration.
  return new Anthropic({ timeout: 25_000, maxRetries: 1 });
}

function normalizeAnalysis(value: unknown): AnalyzedFood | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const name = typeof item.name === "string" ? item.name.trim() : "";
  const servingLabel =
    typeof item.servingLabel === "string" ? item.servingLabel.trim() : "";
  const notes = typeof item.notes === "string" ? item.notes.trim() : "";
  const confidence = item.confidence;
  const fields = [
    item.calories,
    item.proteinG,
    item.carbsG,
    item.fatG,
  ];
  if (
    !name ||
    !servingLabel ||
    !fields.every((field) => typeof field === "number" && Number.isFinite(field)) ||
    (confidence !== "high" && confidence !== "medium" && confidence !== "low")
  ) {
    return null;
  }
  return {
    name: name.slice(0, 80),
    servingLabel: servingLabel.slice(0, 80),
    calories: Math.max(1, Math.min(5000, Math.round(item.calories as number))),
    proteinG: Math.max(0, Math.min(500, Math.round(item.proteinG as number))),
    carbsG: Math.max(0, Math.min(1000, Math.round(item.carbsG as number))),
    fatG: Math.max(0, Math.min(500, Math.round(item.fatG as number))),
    confidence,
    notes: notes.slice(0, 240),
  };
}

async function createAnalysis(
  mode: FoodAnalysisMode,
  content: Anthropic.ContentBlockParam[],
): Promise<AnalyzedFood> {
  const client = getAnthropicClient();
  const response = await client.messages.create({
    model: process.env.ANTHROPIC_FOOD_MODEL ?? "claude-sonnet-5",
    max_tokens: 4096,
    system: `${BASE_INSTRUCTIONS}\n${MODE_INSTRUCTIONS[mode]}`,
    // Nutrition extraction is short, scoped work — low effort keeps
    // adaptive thinking cheap and the response fast.
    output_config: {
      effort: "low",
      format: { type: "json_schema", schema: FOOD_SCHEMA },
    },
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal") {
    throw new Error("Claude declined to analyze this input");
  }
  const raw = response.content.find(
    (block): block is Anthropic.TextBlock => block.type === "text",
  )?.text;
  if (!raw) {
    throw new Error(
      `Claude returned no analysis text (stop_reason ${String(response.stop_reason)})`,
    );
  }
  const analysis = normalizeAnalysis(JSON.parse(raw));
  if (!analysis) throw new Error("Claude returned an invalid food analysis");
  return analysis;
}

export function analyzeFoodDescription(text: string): Promise<AnalyzedFood> {
  return createAnalysis("description", [{ type: "text", text }]);
}

export function analyzeFoodImage(
  mode: "label" | "meal-photo",
  mediaType: FoodImageMediaType,
  base64: string,
): Promise<AnalyzedFood> {
  return createAnalysis(mode, [
    {
      type: "image",
      source: { type: "base64", media_type: mediaType, data: base64 },
    },
    {
      type: "text",
      text:
        mode === "label"
          ? "Extract one serving from this nutrition label."
          : "Estimate the complete meal in this photo.",
    },
  ]);
}

/** Anthropic has no transcription endpoint, so voice capture still rides on
 * OpenAI's transcription API. Optional: without OPENAI_API_KEY the voice
 * route 503s while every other capture mode works. */
export async function transcribeFoodAudio(file: File): Promise<string> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new FoodAiUnavailableError(
      "OPENAI_API_KEY is not configured (voice transcription only)",
    );
  }
  const form = new FormData();
  form.set("file", file, file.name || "food.webm");
  form.set("model", "gpt-4o-mini-transcribe");
  form.set("response_format", "text");
  form.set(
    "prompt",
    "A short food log with quantities, brands, serving sizes, calories, and macros.",
  );
  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      headers: { authorization: `Bearer ${key}` },
      body: form,
    },
  );
  if (!response.ok) {
    throw new Error(`OpenAI transcription API: ${response.status}`);
  }
  const transcript = (await response.text()).trim();
  if (!transcript) throw new Error("Empty transcription");
  return transcript;
}
