---
name: verify
description: Build, launch, and drive Surplus locally to verify changes at the real surface.
---

# Verifying Surplus

## Build + launch

```bash
pnpm install --frozen-lockfile
pnpm build                      # stamps public/sw.js first
PIN_LOCK=1234 pnpm start -p 3100
```

Without `SUPABASE_URL`/`SUPABASE_SECRET_KEY` the shell still runs: pages
render (settings fall back to `DEFAULT_SETTINGS`), data routes 500. With
`PIN_LOCK` unset the gate stays open (bootstrap mode).

## Quick curl checks

- Security headers + middleware: `curl -sI localhost:3100/` → 307 to /lock
  plus the header set from `next.config.ts`.
- Unlock + cookie: `curl -c jar -X POST localhost:3100/api/unlock -H
  'content-type: application/json' -d '{"pin":"1234"}'`, then `-b jar` for
  any `/api/*`. 5 straight wrong PINs → 6th returns 429 (in-memory
  lockout; restart the server or wait 30s to clear).

## GUI driving

playwright-core is NOT a dependency — install it in the scratchpad, launch
with `executablePath: "/opt/pw-browsers/chromium"` (a symlink; the
`chrome-linux/chrome` path inside does not exist here) and `--no-sandbox`.

The panels are client components on TanStack Query — mock the whole data
layer from the browser with `context.route("**/api/**", ...)` fulfilling
per-path JSON (shapes: `hooks/use-*.ts`). Gotchas that cost time:

- Unlock first via the real PIN pad (all four panels are behind it), THEN
  install routes and reload.
- The app-day rolls over at 3 AM local (`getAppDate`) — compute mock dates
  with the same −3h shift or "closed days" land on the wrong side of today.
- All four panels stay mounted — `text=` selectors match hidden panels;
  scope locators or use unique strings. Sheets are vaul drawers:
  `getByRole("dialog")`.
- Charts are custom SVG in a `div[style*='touch-action']` — scrub/tap via
  `page.mouse` on its bounding box; wait ~700ms for the reveal animation.

## Flows worth driving

lock → unlock → Today (streak card, weight quick-log plus) → Food
(nutrition history tap → day drill-in sheet) → gear → Plan (targets,
Data/export row — clicking fires a real `download` event).
