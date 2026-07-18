import { NextResponse, type NextRequest } from "next/server";
import { UNLOCK_COOKIE, safeEqual, unlockToken } from "@/lib/auth";

/**
 * Everything is behind the PIN. Until PIN_LOCK is configured in the
 * environment the gate stays open (data routes fail independently without
 * the Supabase secret key, so nothing is exposed) — once it's set, every
 * page and API route requires the unlock cookie.
 */
export async function middleware(req: NextRequest) {
  const pin = process.env.PIN_LOCK;
  if (!pin) return NextResponse.next();

  const path = req.nextUrl.pathname;
  if (path.startsWith("/api/unlock")) return NextResponse.next();

  const cookie = req.cookies.get(UNLOCK_COOKIE)?.value ?? "";
  const unlocked = cookie !== "" && safeEqual(cookie, await unlockToken(pin));

  if (path === "/lock") {
    return unlocked
      ? NextResponse.redirect(new URL("/", req.url))
      : NextResponse.next();
  }
  if (unlocked) return NextResponse.next();
  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/lock", req.url));
}

export const config = {
  // PWA chrome (manifest, icons, splash, service worker) stays public so
  // install + offline launch work
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|icons/|splash/|manifest.webmanifest|sw.js).*)",
  ],
};
