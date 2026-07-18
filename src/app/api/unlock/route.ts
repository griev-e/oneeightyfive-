import { NextResponse } from "next/server";
import { UNLOCK_COOKIE, safeEqual, unlockToken } from "@/lib/auth";

export async function POST(req: Request) {
  const expected = process.env.PIN_LOCK;
  if (!expected) {
    return NextResponse.json({ error: "PIN_LOCK not set" }, { status: 500 });
  }

  const body = (await req.json().catch(() => null)) as { pin?: unknown } | null;
  const pin = typeof body?.pin === "string" ? body.pin : "";

  if (!safeEqual(pin, expected)) {
    // one wrong guess per ~400ms keeps a 4-digit space annoying to brute force
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(UNLOCK_COOKIE, await unlockToken(expected), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // unlock once per device, basically forever
  });
  return res;
}
