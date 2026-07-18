export type FoodAnalysisMode = "description" | "label" | "meal-photo";

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
    name: { type: "string", minLength: 1, maxLength: 80 },
    servingLabel: { type: "string", minLength: 1, maxLength: 80 },
    calories: { type: "integer", minimum: 1, maximum: 5000 },
    proteinG: { type: "integer", minimum: 0, maximum: 500 },
    carbsG: { type: "integer", minimum: 0, maximum: 1000 },
    fatG: { type: "integer", minimum: 0, maximum: 500 },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    notes: { type: "string", maxLength: 240 },
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

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new FoodAiUnavailableError("OPENAI_API_KEY is not configured");
  }
  return key;
}

function outputText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as {
    output_text?: unknown;
    output?: Array<{ content?: Array<{ type?: unknown; text?: unknown }> }>;
  };
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }
  return null;
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
  content: Array<Record<string, unknown>>,
): Promise<AnalyzedFood> {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(45_000),
    headers: {
      authorization: `Bearer ${getApiKey()}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_FOOD_MODEL ?? "gpt-5.6-terra",
      store: false,
      instructions: `${BASE_INSTRUCTIONS}\n${MODE_INSTRUCTIONS[mode]}`,
      input: [{ role: "user", content }],
      max_output_tokens: 500,
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "food_log_analysis",
          strict: true,
          schema: FOOD_SCHEMA,
        },
      },
    }),
  });
  if (!response.ok) throw new Error(`OpenAI responses API: ${response.status}`);
  const raw = outputText(await response.json());
  const analysis = raw ? normalizeAnalysis(JSON.parse(raw)) : null;
  if (!analysis) throw new Error("OpenAI returned an invalid food analysis");
  return analysis;
}

export function analyzeFoodDescription(text: string): Promise<AnalyzedFood> {
  return createAnalysis("description", [{ type: "input_text", text }]);
}

export function analyzeFoodImage(
  mode: "label" | "meal-photo",
  dataUrl: string,
): Promise<AnalyzedFood> {
  return createAnalysis(mode, [
    {
      type: "input_text",
      text:
        mode === "label"
          ? "Extract one serving from this nutrition label."
          : "Estimate the complete meal in this photo.",
    },
    { type: "input_image", image_url: dataUrl, detail: "high" },
  ]);
}

export async function transcribeFoodAudio(file: File): Promise<string> {
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
      headers: { authorization: `Bearer ${getApiKey()}` },
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
