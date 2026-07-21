/**
 * PIN gate. The unlock cookie is a signed, expiring token:
 *
 *   v2.<expires-epoch-seconds>.<hmac-hex>
 *
 * The HMAC key is SHA-256(PIN + "\n" + server secret), where the secret is
 * SESSION_SECRET (or SUPABASE_SECRET_KEY as a fallback). A leaked cookie is
 * therefore no longer a 10,000-guess offline oracle for the 4-digit PIN —
 * forging or cracking it requires the high-entropy secret. Rotating PIN_LOCK
 * (or the secret) still invalidates every device at once, and the embedded
 * expiry means a stolen cookie eventually dies on its own. Web Crypto only,
 * so it runs in both the edge middleware and node route handlers.
 */
export const UNLOCK_COOKIE = "surplus_unlock";
export const UNLOCK_MAX_AGE_S = 60 * 60 * 24 * 365;
const TOKEN_CONTEXT = "surplus-unlock-v2";

const enc = new TextEncoder();

function tokenSecret(): string {
  return process.env.SESSION_SECRET ?? process.env.SUPABASE_SECRET_KEY ?? "";
}

async function signExpiry(pin: string, expires: number): Promise<string> {
  const material = await crypto.subtle.digest(
    "SHA-256",
    enc.encode(`${pin}\n${tokenSecret()}`),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    material,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(`${TOKEN_CONTEXT}.${expires}`),
  );
  return toHex(sig);
}

export async function issueUnlockToken(
  pin: string,
  now: number = Date.now(),
): Promise<string> {
  const expires = Math.floor(now / 1000) + UNLOCK_MAX_AGE_S;
  return `v2.${expires}.${await signExpiry(pin, expires)}`;
}

export async function verifyUnlockToken(
  token: string,
  pin: string,
  now: number = Date.now(),
): Promise<boolean> {
  const [version, expiresRaw, sig] = token.split(".");
  if (version !== "v2" || !expiresRaw || !sig) return false;
  if (!/^\d{1,12}$/.test(expiresRaw)) return false;
  const expires = Number(expiresRaw);
  if (expires * 1000 <= now) return false;
  return safeEqual(sig, await signExpiry(pin, expires));
}

/** Constant-time string comparison for same-length digests. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Constant-time comparison for secrets of unknown length (the submitted PIN):
 * hashing both sides first means neither the length branch nor the byte loop
 * leaks how long the real PIN is.
 */
export async function safeEqualSecret(a: string, b: string): Promise<boolean> {
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  return safeEqual(toHex(ha), toHex(hb));
}

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
