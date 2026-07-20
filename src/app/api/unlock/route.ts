import { NextResponse } from "next/server";
import { UNLOCK_COOKIE, safeEqual, unlockToken } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase/server";

// Brute-force lockout: after 5 straight misses, guessing pauses — 30s,
// doubling to 15min. Per-instance memory (serverless resets it on a cold
// start), so it's a rate limiter for a 10,000-PIN space, not a vault door.
const LOCKOUT_AFTER = 5;
const LOCKOUT_BASE_MS = 30_000;
const LOCKOUT_MAX_MS = 15 * 60_000;
let failures = 0;
let lockedUntil = 0;

export async function POST(req: Request) {
  const expected = process.env.PIN_LOCK;
  if (!expected) {
    return NextResponse.json({ error: "PIN_LOCK not set" }, { status: 500 });
  }

  if (Date.now() < lockedUntil) {
    return NextResponse.json({ ok: false }, { status: 429 });
  }

  const body = (await req.json().catch(() => null)) as { pin?: unknown } | null;
  const pin = typeof body?.pin === "string" ? body.pin : "";

  if (!safeEqual(pin, expected)) {
    failures += 1;
    if (failures >= LOCKOUT_AFTER) {
      lockedUntil =
        Date.now() +
        Math.min(LOCKOUT_BASE_MS * 2 ** (failures - LOCKOUT_AFTER), LOCKOUT_MAX_MS);
    }
    // one wrong guess per ~400ms keeps a 4-digit space annoying to brute force
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  failures = 0;
  lockedUntil = 0;

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
  res.cookies.set(UNLOCK_COOKIE, await unlockToken(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // unlock once per device, basically forever
  });
  return res;
}
