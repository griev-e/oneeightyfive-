import { NextResponse, type NextRequest } from "next/server";
import { UNLOCK_COOKIE, verifyUnlockToken } from "@/lib/auth";

/**
 * Everything is behind the PIN. Until PIN_LOCK is configured the gate stays
 * open ONLY while nothing sensitive is reachable — if the Supabase secret is
 * present without a PIN, every data route would be exposed unauthenticated,
 * so the gate fails closed instead of open. Once PIN_LOCK is set, every page
 * and API route requires a valid (signed, unexpired) unlock cookie.
 */
export async function middleware(req: NextRequest) {
  const pin = process.env.PIN_LOCK;
  if (!pin) {
    if (process.env.SUPABASE_SECRET_KEY) {
      return new NextResponse("PIN_LOCK is not configured", { status: 503 });
    }
    return NextResponse.next();
  }

  const path = req.nextUrl.pathname;
  if (path === "/api/unlock") return NextResponse.next();

  const cookie = req.cookies.get(UNLOCK_COOKIE)?.value ?? "";
  const unlocked = cookie !== "" && (await verifyUnlockToken(cookie, pin));

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
