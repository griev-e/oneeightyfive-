import { describe, expect, it } from "vitest";
import { normalizeAnalysis } from "@/lib/food-ai";

const valid = {
  name: "Chicken breast",
  servingLabel: "6 oz",
  calories: 280,
  proteinG: 52,
  carbsG: 0,
  fatG: 6,
  confidence: "medium",
  notes: "Grilled, no added oil.",
};

describe("normalizeAnalysis — happy path", () => {
  it("passes a well-formed analysis through, trimming text", () => {
    expect(
      normalizeAnalysis({ ...valid, name: "  Chicken breast  " }),
    ).toEqual({ ...valid });
  });
});

describe("normalizeAnalysis — rejection", () => {
  it("rejects a null/non-object value", () => {
    expect(normalizeAnalysis(null)).toBeNull();
    expect(normalizeAnalysis("nope")).toBeNull();
  });

  it("rejects a missing/blank name or serving label", () => {
    expect(normalizeAnalysis({ ...valid, name: "   " })).toBeNull();
    expect(normalizeAnalysis({ ...valid, servingLabel: "" })).toBeNull();
  });

  it("rejects a non-finite or non-numeric macro", () => {
    expect(normalizeAnalysis({ ...valid, calories: "280" })).toBeNull();
    expect(normalizeAnalysis({ ...valid, proteinG: NaN })).toBeNull();
    expect(normalizeAnalysis({ ...valid, fatG: Infinity })).toBeNull();
  });

  it("rejects an unknown confidence value", () => {
    expect(normalizeAnalysis({ ...valid, confidence: "certain" })).toBeNull();
    expect(normalizeAnalysis({ ...valid, confidence: undefined })).toBeNull();
  });
});

describe("normalizeAnalysis — clamping (the API can't express these bounds)", () => {
  it("floors calories at 1 and rounds macros to integers", () => {
    const out = normalizeAnalysis({
      ...valid,
      calories: 0,
      proteinG: 12.4,
      carbsG: 12.6,
      fatG: -3,
    });
    expect(out).not.toBeNull();
    expect(out!.calories).toBe(1);
    expect(out!.proteinG).toBe(12);
    expect(out!.carbsG).toBe(13);
    expect(out!.fatG).toBe(0); // floored at 0
  });

  it("caps each field at its ceiling", () => {
    const out = normalizeAnalysis({
      ...valid,
      calories: 999999,
      proteinG: 9999,
      carbsG: 9999,
      fatG: 9999,
    });
    expect(out).toMatchObject({
      calories: 5000,
      proteinG: 500,
      carbsG: 1000,
      fatG: 500,
    });
  });

  it("truncates overlong name (80) and notes (240)", () => {
    const out = normalizeAnalysis({
      ...valid,
      name: "n".repeat(200),
      notes: "x".repeat(500),
    });
    expect(out!.name).toHaveLength(80);
    expect(out!.notes).toHaveLength(240);
  });

  it("accepts empty notes (they are optional context, not required)", () => {
    const out = normalizeAnalysis({ ...valid, notes: 123 });
    expect(out).not.toBeNull();
    expect(out!.notes).toBe(""); // non-string notes degrade to empty, not a rejection
  });
});
