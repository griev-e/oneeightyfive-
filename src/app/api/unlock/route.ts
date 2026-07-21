import { NextResponse } from "next/server";
import {
  UNLOCK_COOKIE,
  UNLOCK_MAX_AGE_S,
  issueUnlockToken,
  safeEqualSecret,
} from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

// Brute-force lockout: after 5 straight misses, guessing pauses — 30s,
// doubling to 15min. Counted per IP, held both in instance memory (fast
// path) and in the unlock_attempts table, so a serverless cold start no
// longer resets the clock and one abusive IP can't lock the real user out.
const LOCKOUT_AFTER = 5;
const LOCKOUT_BASE_MS = 30_000;
const LOCKOUT_MAX_MS = 15 * 60_000;
const memory = new Map<string, { failures: number; lockedUntil: number }>();

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || req.headers.get("x-real-ip");
  return (ip || "unknown").slice(0, 64);
}

function lockoutMs(failures: number): number {
  if (failures < LOCKOUT_AFTER) return 0;
  return Math.min(
    LOCKOUT_BASE_MS * 2 ** (failures - LOCKOUT_AFTER),
    LOCKOUT_MAX_MS,
  );
}

// The durable side is best-effort: bootstrap installs have no Supabase yet,
// and a DB hiccup must never brick the lock screen.
async function readDurable(ip: string) {
  try {
    const { data } = await supabaseServer()
      .from("unlock_attempts")
      .select("failures, locked_until")
      .eq("ip", ip)
      .maybeSingle();
    return data ?? null;
  } catch {
    return null;
  }
}

async function writeDurable(ip: string, failures: number, lockedUntil: number) {
  try {
    await supabaseServer()
      .from("unlock_attempts")
      .upsert({
        ip,
        failures,
        locked_until: lockedUntil > 0 ? new Date(lockedUntil).toISOString() : null,
        updated_at: new Date().toISOString(),
      });
  } catch {
    // memory still counted this failure
  }
}

async function clearDurable(ip: string) {
  try {
    await supabaseServer().from("unlock_attempts").delete().eq("ip", ip);
  } catch {
    // stale row just expires by locked_until passing
  }
}

export async function POST(req: Request) {
  const expected = process.env.PIN_LOCK;
  if (!expected) {
    return NextResponse.json({ error: "PIN_LOCK not set" }, { status: 500 });
  }

  const ip = clientIp(req);
  const local = memory.get(ip) ?? { failures: 0, lockedUntil: 0 };
  const durable = await readDurable(ip);
  const failures = Math.max(local.failures, durable?.failures ?? 0);
  const lockedUntil = Math.max(
    local.lockedUntil,
    durable?.locked_until ? Date.parse(durable.locked_until) : 0,
  );

  if (Date.now() < lockedUntil) {
    const retryAfterS = Math.max(1, Math.ceil((lockedUntil - Date.now()) / 1000));
    return NextResponse.json(
      { ok: false },
      { status: 429, headers: { "retry-after": String(retryAfterS) } },
    );
  }

  const body = (await req.json().catch(() => null)) as { pin?: unknown } | null;
  const pin = typeof body?.pin === "string" ? body.pin : "";

  if (!(await safeEqualSecret(pin, expected))) {
    const nextFailures = failures + 1;
    const nextLockedUntil =
      lockoutMs(nextFailures) > 0 ? Date.now() + lockoutMs(nextFailures) : 0;
    memory.set(ip, { failures: nextFailures, lockedUntil: nextLockedUntil });
    await writeDurable(ip, nextFailures, nextLockedUntil);
    // one wrong guess per ~400ms keeps a 4-digit space annoying to brute force
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  memory.delete(ip);
  await clearDurable(ip);

  // greet the profile by name on later locks; never fail the unlock over it
  let name = "kevin";
  try {
    const { data } = await supabaseServer()
      .from("profile")
      .select("name")
      .eq("id", 1)
      .single();
    if (data?.name) name = data.name;
  } catch {
    // Supabase not configured yet — the default name is fine
  }

  const res = NextResponse.json({ ok: true, name });
  res.cookies.set(UNLOCK_COOKIE, await issueUnlockToken(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: UNLOCK_MAX_AGE_S, // unlock once per device, basically forever
  });
  return res;
}
