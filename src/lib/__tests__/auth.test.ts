import { afterEach, describe, expect, it, vi } from "vitest";
import {
  UNLOCK_COOKIE,
  UNLOCK_MAX_AGE_S,
  issueUnlockToken,
  safeEqual,
  safeEqualSecret,
  verifyUnlockToken,
} from "@/lib/auth";

const NOW = 1_750_000_000_000;

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("unlock token v2", () => {
  it("has the v2.<expiry>.<hmac-hex> shape", async () => {
    const token = await issueUnlockToken("1234", NOW);
    expect(token).toMatch(/^v2\.\d+\.[0-9a-f]{64}$/);
  });

  it("round-trips: a freshly issued token verifies against the same PIN", async () => {
    const token = await issueUnlockToken("1234", NOW);
    expect(await verifyUnlockToken(token, "1234", NOW)).toBe(true);
  });

  it("rejects a token issued for a different PIN — rotating PIN_LOCK logs out every device", async () => {
    const token = await issueUnlockToken("1234", NOW);
    expect(await verifyUnlockToken(token, "1235", NOW)).toBe(false);
  });

  it("expires: verification fails once the embedded expiry passes", async () => {
    const token = await issueUnlockToken("1234", NOW);
    const afterExpiry = NOW + (UNLOCK_MAX_AGE_S + 1) * 1000;
    expect(await verifyUnlockToken(token, "1234", afterExpiry)).toBe(false);
  });

  it("rejects a tampered expiry — the signature covers it", async () => {
    const token = await issueUnlockToken("1234", NOW);
    const [, expires, sig] = token.split(".");
    const extended = `v2.${Number(expires) + 1_000_000}.${sig}`;
    expect(await verifyUnlockToken(extended, "1234", NOW)).toBe(false);
  });

  it("rejects legacy v1 tokens (bare hex digests) and garbage", async () => {
    const { createHmac } = await import("node:crypto");
    const v1 = createHmac("sha256", "1234").update("surplus-unlock-v1").digest("hex");
    expect(await verifyUnlockToken(v1, "1234", NOW)).toBe(false);
    expect(await verifyUnlockToken("", "1234", NOW)).toBe(false);
    expect(await verifyUnlockToken("v2..deadbeef", "1234", NOW)).toBe(false);
    expect(await verifyUnlockToken("v2.notanumber.deadbeef", "1234", NOW)).toBe(false);
  });

  it("keys on the server secret — the cookie is not a PIN-only oracle", async () => {
    vi.stubEnv("SESSION_SECRET", "a-long-random-server-secret");
    const withSecret = await issueUnlockToken("1234", NOW);
    vi.stubEnv("SESSION_SECRET", "a-different-server-secret");
    const withOther = await issueUnlockToken("1234", NOW);
    expect(withSecret).not.toBe(withOther);
    // a token minted under one secret dies when the secret rotates
    expect(await verifyUnlockToken(withSecret, "1234", NOW)).toBe(false);
    vi.stubEnv("SESSION_SECRET", "a-long-random-server-secret");
    expect(await verifyUnlockToken(withSecret, "1234", NOW)).toBe(true);
  });

  it("falls back to SUPABASE_SECRET_KEY when SESSION_SECRET is unset", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", "supabase-secret");
    const token = await issueUnlockToken("1234", NOW);
    expect(await verifyUnlockToken(token, "1234", NOW)).toBe(true);
    vi.stubEnv("SUPABASE_SECRET_KEY", "rotated-secret");
    expect(await verifyUnlockToken(token, "1234", NOW)).toBe(false);
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

describe("safeEqualSecret", () => {
  it("matches equal secrets", async () => {
    expect(await safeEqualSecret("1234", "1234")).toBe(true);
  });

  it("rejects differing secrets, including different lengths", async () => {
    expect(await safeEqualSecret("1234", "1235")).toBe(false);
    expect(await safeEqualSecret("1234", "12345")).toBe(false);
    expect(await safeEqualSecret("", "1234")).toBe(false);
  });
});

describe("UNLOCK_COOKIE", () => {
  it("is the stable cookie name middleware and routes agree on", () => {
    expect(UNLOCK_COOKIE).toBe("surplus_unlock");
  });
});
