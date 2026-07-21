import { describe, expect, it, vi } from "vitest";
import {
  asInt,
  asIsoDate,
  asNum,
  asShortText,
  asUuid,
  bad,
  oops,
  readBody,
  sameOrigin,
} from "@/lib/api";

describe("asInt", () => {
  it("rounds a finite number inside the range", () => {
    expect(asInt(3.4, 0, 10)).toBe(3);
    expect(asInt(3.6, 0, 10)).toBe(4);
  });

  it("treats the bounds as inclusive", () => {
    expect(asInt(0, 0, 10)).toBe(0);
    expect(asInt(10, 0, 10)).toBe(10);
  });

  it("rejects out-of-range, non-numbers, and non-finite values", () => {
    expect(asInt(11, 0, 10)).toBeNull();
    expect(asInt(-1, 0, 10)).toBeNull();
    expect(asInt("5", 0, 10)).toBeNull();
    expect(asInt(NaN, 0, 10)).toBeNull();
    expect(asInt(Infinity, 0, 10)).toBeNull();
  });

  it("rounds before the range check (2.5 rounds to 3, still ≤ 3)", () => {
    expect(asInt(2.5, 0, 3)).toBe(3);
  });
});

describe("asNum", () => {
  it("passes a finite number through without rounding", () => {
    expect(asNum(125.8, 0, 500)).toBe(125.8);
  });

  it("enforces inclusive bounds and rejects bad input", () => {
    expect(asNum(0, 0, 10)).toBe(0);
    expect(asNum(10.0001, 0, 10)).toBeNull();
    expect(asNum("5", 0, 10)).toBeNull();
    expect(asNum(NaN, 0, 10)).toBeNull();
  });
});

describe("asIsoDate", () => {
  it("accepts a YYYY-MM-DD string", () => {
    expect(asIsoDate("2026-07-18")).toBe("2026-07-18");
  });

  it("rejects wrong shapes and non-strings", () => {
    expect(asIsoDate("2026-7-8")).toBeNull();
    expect(asIsoDate("07-18-2026")).toBeNull();
    expect(asIsoDate("2026-07-18T00:00")).toBeNull();
    expect(asIsoDate(20260718)).toBeNull();
    expect(asIsoDate(null)).toBeNull();
  });
});

describe("asShortText", () => {
  it("trims and returns non-empty text within the limit", () => {
    expect(asShortText("  chicken  ", 80)).toBe("chicken");
  });

  it("rejects empty/whitespace-only and over-length text", () => {
    expect(asShortText("   ", 80)).toBeNull();
    expect(asShortText("", 80)).toBeNull();
    expect(asShortText("x".repeat(81), 80)).toBeNull();
  });

  it("accepts text exactly at the limit", () => {
    expect(asShortText("x".repeat(80), 80)).toBe("x".repeat(80));
  });

  it("rejects non-strings", () => {
    expect(asShortText(42, 80)).toBeNull();
  });
});

describe("readBody", () => {
  it("returns the parsed object for valid JSON", async () => {
    const req = new Request("http://x/api", {
      method: "POST",
      body: JSON.stringify({ pin: "1234" }),
    });
    expect(await readBody(req)).toEqual({ pin: "1234" });
  });

  it("falls back to an empty object on malformed JSON", async () => {
    const req = new Request("http://x/api", { method: "POST", body: "not json" });
    expect(await readBody(req)).toEqual({});
  });

  it("falls back to an empty object when the body is JSON null", async () => {
    const nul = new Request("http://x/api", { method: "POST", body: "null" });
    expect(await readBody(nul)).toEqual({});
  });

  it("passes a JSON array through (typeof [] is 'object') — callers coerce fields via asX", async () => {
    const arr = new Request("http://x/api", { method: "POST", body: "[1,2,3]" });
    // documents the actual contract: readBody only guards null/non-objects, not arrays.
    expect(await readBody(arr)).toEqual([1, 2, 3]);
  });
});

describe("bad / oops response helpers", () => {
  it("bad returns a 400 with the default message", async () => {
    const res = bad();
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid body" });
  });

  it("bad carries a custom message", async () => {
    expect(await bad("no pin").json()).toEqual({ error: "no pin" });
  });

  it("oops returns a generic 500 — upstream detail never reaches the client", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = oops('duplicate key value violates unique constraint "food_logs_pkey"');
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "something went wrong" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("asUuid", () => {
  it("accepts a canonical UUID in either case", () => {
    expect(asUuid("f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe(
      "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    );
    expect(asUuid("F47AC10B-58CC-4372-A567-0E02B2C3D479")).toBe(
      "F47AC10B-58CC-4372-A567-0E02B2C3D479",
    );
  });

  it("rejects malformed ids and non-strings", () => {
    expect(asUuid("not-a-uuid")).toBeNull();
    expect(asUuid("f47ac10b58cc4372a5670e02b2c3d479")).toBeNull();
    expect(asUuid("")).toBeNull();
    expect(asUuid(42)).toBeNull();
    expect(asUuid(null)).toBeNull();
  });
});

describe("sameOrigin", () => {
  const req = (headers: Record<string, string>) =>
    new Request("http://surplus.test/api/food-ai/image", {
      method: "POST",
      headers,
    });

  it("passes when Origin matches Host", () => {
    expect(
      sameOrigin(req({ origin: "https://surplus.test", host: "surplus.test" })),
    ).toBe(true);
  });

  it("passes when Origin is absent (same-origin or non-browser)", () => {
    expect(sameOrigin(req({ host: "surplus.test" }))).toBe(true);
  });

  it("rejects a cross-site Origin and unparseable Origins", () => {
    expect(
      sameOrigin(req({ origin: "https://evil.example", host: "surplus.test" })),
    ).toBe(false);
    expect(sameOrigin(req({ origin: "null", host: "surplus.test" }))).toBe(false);
  });
});
