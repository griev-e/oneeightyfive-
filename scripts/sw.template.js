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

// __SW_VERSION__ is stamped per build (scripts/stamp-sw.mjs) so every deploy
// byte-diffs sw.js → the browser re-installs → activate purges stale caches.
const VERSION = "__SW_VERSION__";
const CACHE = `surplus-shell-${VERSION}`;
const SHELL_URL = "/";

// Only the app tabs may fall back to the cached shell offline — /lock and
// /setup are different documents, and serving the app shell there would be
// wrong (and could loop through the 401 → /lock redirect).
const SHELL_PATHS = new Set(["/", "/weight", "/food", "/lift"]);

// Never cache a redirected "/" — if the unlock cookie has expired, the
// response is the /lock page, and caching THAT as the shell would trap
// offline launches on the lock screen.
async function cacheShell(cache, res) {
  if (res.ok && !res.redirected) await cache.put(SHELL_URL, res);
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE)
      .then(async (cache) => cacheShell(cache, await fetch(SHELL_URL)))
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

  // App shell: network-first so it stays fresh, cached "/" as the offline
  // floor — but only for the app tabs (SHELL_PATHS).
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const res = await fetch(request);
          if (url.pathname === SHELL_URL) {
            const cache = await caches.open(CACHE);
            await cacheShell(cache, res.clone());
          }
          return res;
        } catch {
          if (SHELL_PATHS.has(url.pathname)) {
            const cached = await caches.match(SHELL_URL);
            if (cached) return cached;
          }
          return Response.error();
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
