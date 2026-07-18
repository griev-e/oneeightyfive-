import { NextResponse } from "next/server";

/** Route-handler helpers: uniform 400/500 shapes and body coercion. */

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export const bad = (message = "invalid body") =>
  NextResponse.json({ error: message }, { status: 400 });

export const oops = (message: string) =>
  NextResponse.json({ error: message }, { status: 500 });

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
