import { describe, expect, it } from "vitest";
import { formatInt, formatPace, formatWeight } from "@/lib/format";

describe("formatInt", () => {
  it("rounds and groups thousands", () => {
    expect(formatInt(2725)).toBe("2,725");
    expect(formatInt(2724.6)).toBe("2,725");
  });

  it("handles small numbers without a separator", () => {
    expect(formatInt(90)).toBe("90");
  });
});

describe("formatWeight", () => {
  it("always keeps exactly one decimal for steady tabular width", () => {
    expect(formatWeight(125.8)).toBe("125.8");
    expect(formatWeight(126)).toBe("126.0");
  });
});

describe("formatPace", () => {
  it("uses a real Unicode minus, not an ASCII hyphen", () => {
    const out = formatPace(-0.2);
    expect(out).toBe("−0.20"); // − U+2212, matches tabular figure width
    expect(out).not.toContain("-"); // ASCII hyphen would break alignment
  });

  it("signs positive paces with a plus", () => {
    expect(formatPace(0.55)).toBe("+0.55");
  });

  it("treats zero as non-negative (plus sign)", () => {
    expect(formatPace(0)).toBe("+0.00");
  });

  it("keeps two decimals of precision", () => {
    expect(formatPace(0.5)).toBe("+0.50");
  });
});
