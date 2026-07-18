/**
 * Surplus service worker — minimal, gym-connectivity only.
 *
 * The whole point is that a cold PWA launch on flaky gym Wi-Fi still paints the
 * app shell so set logging (optimistic, IndexedDB-backed) keeps working. It
 * caches ONLY the static shell + build assets. It must NEVER touch data: every
 * /api/* request and every cross-origin request (Supabase) falls straight
 * through to the network — TanStack Query's IndexedDB persistence owns data,
 * and a stale cached API response would silently corrupt the day.
 */

const CACHE = "surplus-shell-v1";
const SHELL_URL = "/";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(SHELL_URL))
      .catch(() => {}),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Data is sacred: never cache Supabase (cross-origin) or our own API.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // App shell: network-first so it stays fresh, cached "/" as the offline floor.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (url.pathname === SHELL_URL && res.ok) {
            const cache = await caches.open(CACHE);
            cache.put(SHELL_URL, res.clone());
          }
          return res;
        } catch {
          const cached = await caches.match(SHELL_URL);
          return cached ?? Response.error();
        }
      })(),
    );
    return;
  }

  // Immutable build assets + PWA chrome: stale-while-revalidate.
  const isStatic =
    url.pathname.startsWith("/_next/static") ||
    /\.(?:js|css|png|svg|ico|webmanifest|woff2?)$/.test(url.pathname);
  if (!isStatic) return;

  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((res) => {
          if (res.ok) cache.put(request, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached ?? network;
    }),
  );
});
