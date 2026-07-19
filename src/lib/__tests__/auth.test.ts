import { describe, expect, it } from "vitest";
import { UNLOCK_COOKIE, safeEqual, unlockToken } from "@/lib/auth";

describe("unlockToken", () => {
  it("is a 64-char hex HMAC-SHA256 digest", async () => {
    const token = await unlockToken("1234");
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic for the same PIN", async () => {
    expect(await unlockToken("1234")).toBe(await unlockToken("1234"));
  });

  it("changes completely when the PIN changes — rotating PIN_LOCK logs out every device", async () => {
    expect(await unlockToken("1234")).not.toBe(await unlockToken("1235"));
  });

  it("matches a known-answer vector (HMAC-SHA256(key='1234', 'surplus-unlock-v1'))", async () => {
    // Independent reference value; guards against silent changes to the token recipe.
    const { createHmac } = await import("node:crypto");
    const expected = createHmac("sha256", "1234")
      .update("surplus-unlock-v1")
      .digest("hex");
    expect(await unlockToken("1234")).toBe(expected);
  });
});

describe("safeEqual", () => {
  it("is true for identical strings", () => {
    expect(safeEqual("1234", "1234")).toBe(true);
  });

  it("is false for same-length but differing strings", () => {
    expect(safeEqual("1234", "1235")).toBe(false);
  });

  it("is false for different lengths without throwing", () => {
    expect(safeEqual("1234", "12345")).toBe(false);
    expect(safeEqual("", "1")).toBe(false);
  });

  it("is true for two empty strings", () => {
    expect(safeEqual("", "")).toBe(true);
  });
});

describe("UNLOCK_COOKIE", () => {
  it("is the stable cookie name middleware and routes agree on", () => {
    expect(UNLOCK_COOKIE).toBe("surplus_unlock");
  });
});
