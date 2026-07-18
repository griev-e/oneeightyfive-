/**
 * PIN gate. The unlock cookie's value is HMAC-SHA256 keyed by the PIN over a
 * fixed version string — deriving it requires knowing the PIN, and changing
 * PIN_LOCK invalidates every device at once. Web Crypto only, so it runs in
 * both the edge middleware and node route handlers.
 */
export const UNLOCK_COOKIE = "surplus_unlock";
const TOKEN_VERSION = "surplus-unlock-v1";

export async function unlockToken(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(TOKEN_VERSION));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
