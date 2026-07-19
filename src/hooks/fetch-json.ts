/**
 * All data flows through /api/* (PIN-gated, server-side Supabase). A 401
 * means the unlock cookie expired or PIN_LOCK rotated — bounce to /lock.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    url: string,
  ) {
    super(`${url} → ${status}`);
  }
}

export async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(url, init);
  if (res.status === 401) {
    window.location.replace("/lock");
    throw new Error("locked");
  }
  if (!res.ok) throw new HttpError(res.status, url);
  return res.json() as Promise<T>;
}

export const jsonBody = (body: unknown): RequestInit => ({
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});
