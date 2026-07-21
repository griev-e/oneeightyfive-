import { NextResponse } from "next/server";

/** Route-handler helpers: uniform 400/500 shapes and body coercion. */

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const bad = (message = "invalid body") =>
  NextResponse.json({ error: message }, { status: 400 });

/** 500 that never echoes upstream detail — Postgres/RPC messages leak schema
 * and constraint names, so they go to the server log only. */
export const oops = (detail: unknown) => {
  console.error("[api]", detail);
  return NextResponse.json({ error: "something went wrong" }, { status: 500 });
};

export async function readBody(req: Request): Promise<Record<string, unknown>> {
  const body = await req.json().catch(() => null);
  return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
}

export function asInt(
  v: unknown,
  lo: number,
  hi: number,
): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  const n = Math.round(v);
  return n >= lo && n <= hi ? n : null;
}

export function asNum(v: unknown, lo: number, hi: number): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return v >= lo && v <= hi ? v : null;
}

export function asIsoDate(v: unknown): string | null {
  return typeof v === "string" && ISO_DATE.test(v) ? v : null;
}

export function asShortText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length >= 1 && t.length <= max ? t : null;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Row ids and foreign keys arrive as strings; rejecting malformed ones here
 * returns a clean 400 instead of leaking an FK/constraint error via a 500. */
export function asUuid(v: unknown): string | null {
  return typeof v === "string" && UUID.test(v) ? v : null;
}

/**
 * Cross-site defense-in-depth for the multipart routes: FormData POSTs are
 * CORS "simple requests", so SameSite=Lax is otherwise the only thing keeping
 * a hostile page from riding the unlock cookie. Browsers always send Origin
 * on cross-origin POSTs; absent means same-origin or a non-browser client.
 */
export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  const host = req.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
