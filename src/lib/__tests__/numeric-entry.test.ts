import { describe, expect, it } from "vitest";
import { applyWeightKey } from "@/lib/numeric-entry";
import { sumMacros } from "@/lib/macros";

describe("applyWeightKey", () => {
  it("appends digits up to three integer places", () => {
    expect(applyWeightKey("", "1")).toBe("1");
    expect(applyWeightKey("12", "5")).toBe("125");
    expect(applyWeightKey("125", "9")).toBe("125"); // 4th integer digit blocked
  });

  it("allows one decimal place, entered after the integers", () => {
    expect(applyWeightKey("125", ".")).toBe("125.");
    expect(applyWeightKey("125.", "8")).toBe("125.8");
    expect(applyWeightKey("125.8", "9")).toBe("125.8"); // 2nd decimal blocked
  });

  it("rejects a leading or repeated decimal point", () => {
    expect(applyWeightKey("", ".")).toBe("");
    expect(applyWeightKey("125.", ".")).toBe("125.");
    expect(applyWeightKey("125.8", ".")).toBe("125.8");
  });

  it("del removes the last character and is safe on empty", () => {
    expect(applyWeightKey("125.8", "del")).toBe("125.");
    expect(applyWeightKey("1", "del")).toBe("");
    expect(applyWeightKey("", "del")).toBe("");
  });
});

describe("sumMacros", () => {
  it("sums all four fields", () => {
    expect(
      sumMacros([
        { calories: 300, proteinG: 10, carbsG: 54, fatG: 5 },
        { calories: 700, proteinG: 45, carbsG: 60, fatG: 22 },
      ]),
    ).toEqual({ calories: 1000, proteinG: 55, carbsG: 114, fatG: 27 });
  });

  it("returns zeros for an empty day", () => {
    expect(sumMacros([])).toEqual({
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    });
  });
});
