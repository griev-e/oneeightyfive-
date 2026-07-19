import { describe, expect, it } from "vitest";
import { fitWithin } from "@/lib/image";

describe("fitWithin", () => {
  it("scales the long edge down to the max and keeps the aspect ratio", () => {
    expect(fitWithin(3600, 2400, 1800)).toEqual({ width: 1800, height: 1200 });
    expect(fitWithin(2400, 3600, 1800)).toEqual({ width: 1200, height: 1800 });
  });

  it("never scales up", () => {
    expect(fitWithin(800, 600, 1800)).toEqual({ width: 800, height: 600 });
  });

  it("floors at 1×1 for degenerate inputs", () => {
    expect(fitWithin(10000, 1, 1800)).toEqual({ width: 1800, height: 1 });
  });
});
