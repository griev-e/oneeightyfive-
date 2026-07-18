@AGENTS.md

# Surplus

Personal fitness PWA for exactly one user (single account, no social, no bloat).
The mission: **hit a calorie surplus every day and progressively overload in the
gym.** Current stats: 23yo, 6'1", ~126 lbs, gaining at a target of +0.5 lb/week
toward a flexible goal weight (currently 185, editable in settings).

**Rule of Taste — every UI decision passes through: "would Robinhood / Vercel /
Linear / Apple ship this?" If not, redo it.** UX quality matters more than
feature count.

## Stack + commands

- Next.js 16 (App Router) · TypeScript · Tailwind v4 (CSS-first, no config file)
  · `motion` (framer-motion v12, import from `motion/react`) · vaul · geist ·
  lucide-react. Package manager: pnpm.
- `pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm start`
- `node scripts/generate-assets.mjs` regenerates icons + iOS splash screens
  (sharp; the mark is a rounded mint plus on near-black).
- M2+: Supabase via MCP tools — author SQL in `supabase/migrations/`, apply with
  `apply_migration`, regenerate `src/lib/database.types.ts` with
  `generate_typescript_types`. Never change schema any other way.

## Design tokens

`src/app/globals.css` `@theme` is the ONLY home for tokens. Never hardcode a
color/size in a component.

- Surfaces: `canvas #0A0A0B` (screen bg, never pure black) → `raised #131316`
  (cards) → `overlay #1B1B1F` (sheets, pressed). Elevation = background tint +
  1px border (`border-subtle/default/strong`), **never shadows** — the single
  exception is the sheet's `0 -8px 40px rgba(0,0,0,0.4)`.
- Text: `text-primary #F4F4F5`, `text-secondary` 62% alpha, `text-tertiary` 38%.
- **Accent `#34D399` (mint) means "target hit" — nothing else.** Surplus hit,
  on-pace, overload wins. PR moments use `pr #E8B84B` gold. Pace behind/ahead
  states are plain secondary text — this app celebrates, it never scolds, and
  **nothing is ever red** (muted `destructive` appears only inside delete
  confirmation sheets, M3+).
- Type: Geist variable (`geist` npm package) via `--font-geist-sans`. Scale is
  the `type-*` utilities (`hero 56/72`, `display 34`, `stat 28`, `title 22`,
  `headline 17`, `body 15`, `footnote 13`, `label 11 caps +0.08em`). Weight 600
  max — no 700/800. Tracking tightens as size grows (hero −0.035em).
  `tabular-nums` is mandatory on every stat — baked into `type-hero/display/
  stat` and `AnimatedNumber`.
- Radius: sm 8 / md 12 / lg 16 / xl 20 / sheet 24. Touch minimums: 44×44;
  primary buttons 52px (`h-13`); list rows 56px min.

## Motion doctrine

All transitions come from `src/lib/motion.ts` — **no component ever defines
inline stiffness/damping.** Springs, not tweens (`easeIOS` tween only for
enter-only fades/reveals).

- Presets: `instant` (press feedback ~120ms) · `snappy` (checkmarks ~180ms) ·
  `default` (lists/layout ~250ms) · `gentle` (ring fill, celebrations, slight
  overshoot) · `sheet` (critically damped slides) · `numberSpring` (useSpring
  count-glides).
- Press scales: buttons 0.97, icon buttons 0.92, rows/cards 0.98 — always with
  `touch-action: manipulation`.
- **Numbers animate on CHANGE, never on mount** (Robinhood pattern). Charts and
  progress rings/bars enter once when their panel first becomes ACTIVE (they
  stay mounted), then only retarget.
- Tab switches: 120ms opacity crossfade, outgoing panel holds underneath —
  no slides, no canvas flash. Exits are instant elsewhere too; drill-ins
  (Lift detail) push horizontally with `springs.sheet`.
- Chart scrub tracks the finger raw — **no spring on x**. `touch-action: pan-y`
  keeps page scroll alive.
- `MotionConfig reducedMotion="user"` wraps the app; AnimatedNumber and chart
  reveals degrade to static explicitly.
- No spinners exist in this app. Skeletons are static. Optimistic UI always;
  failures roll back quietly with the toast.

## Component conventions

- Primitives live in `src/components/ui/`, shell in `components/shell/`, screens
  in `components/panels/`, charts in `components/charts/`. No component
  libraries (vaul is a behavior primitive, allowed).
- One hero number per screen. Micro-caps `type-label` headers over sections.
- All entry flows are vaul bottom sheets (`ui/sheet.tsx`) — never
  `shouldScaleBackground` (it breaks the fixed tab bar). Numeric entry uses
  `ui/number-pad.tsx`, never the system keyboard.
- `cn()` from `lib/cn.ts` for class merging.

## Routing/shell invariants

- One page: `(app)/[[...tab]]/page.tsx` validates the slug server-side and
  renders `TabShell`; unknown paths redirect to `/`. Tabs: `/` Today ·
  `/weight` · `/food` · `/lift` (defs in `components/shell/tabs.ts` — a shared
  module because the server route imports it; never import from the client
  `tab-shell.tsx` in server code).
- All four panels stay MOUNTED; switching toggles visibility + `inert`. Scroll
  position and half-finished entries must survive switches. Tab taps use
  `history.replaceState` (never `router.push` — no back-stack growth);
  `popstate` re-syncs.
- Panels receive `isActive` — drive entrance animations from it, never from
  mount.
- Scrolling happens inside `Screen` containers only; the page never scrolls.

## Data rules

- Live domains (Weight, Settings since M2) flow: panel → `hooks/use-*`
  (TanStack Query, optimistic mutations, IndexedDB persistence via
  `idb-keyval`) → `/api/*` route handlers → `lib/supabase/server.ts`
  (secret key, server-only). Components never call supabase or fetch
  directly; the canonical optimistic-mutation shape lives in
  `hooks/use-weight.ts`.
- Not-yet-live domains (Food M3, Lift M4, streaks M5) still derive from
  `src/lib/mock.tsx`; delete each slice as its milestone lands.
- Supabase project: `surplus` (`aqykznlpspuguvvoacpi`, us-west-1). Org was
  at the free 2-project limit — `alpha/delta` is PAUSED to make room; don't
  unpause it without asking the user.
- `getAppDate()` in `lib/dates.ts` is the ONLY source of "what day is it" —
  the app-day rolls over at 3 AM local (a 12:30 AM post-workout meal counts
  toward the waking day). Dates are local `YYYY-MM-DD` strings.
- Derived math is pure in `lib/stats.ts`: 7-day rolling average (mean of
  existing points in window, never interpolate); pace = `RA(latest) −
  RA(latest−7d)` scaled to lb/wk, needs ≥5 weigh-ins spanning ≥7d, on-pace band
  = goal ±0.25; `e1rm` = Epley with reps clamped at 12. Streaks/PRs are always
  derived, never stored.
- Celebration tiers per set: PR (gold badge) > overload win (mint ▲) > plain
  check. First-ever session sets baselines and fires nothing. No haptics —
  `navigator.vibrate` doesn't exist on iOS.

## Auth invariants

- **No Supabase Auth, no email.** A 4-digit PIN gate: `/lock` (design-language
  PIN pad) → `POST /api/unlock` compares against the `PIN_LOCK` env var
  (constant-time) and sets a year-long httpOnly cookie whose value is
  `HMAC-SHA256(key=PIN, "surplus-unlock-v1")` — rotating `PIN_LOCK` logs out
  every device. `middleware.ts` gates every page and API route (pages →
  redirect `/lock`, APIs → 401); PWA chrome (manifest/icons/splash) stays
  public so install works. If `PIN_LOCK` is unset the gate stays open
  (bootstrap mode) — data routes still fail without the secret key.
- **Database access is server-only**: RLS is enabled on every table with ZERO
  policies, so the publishable/anon key can do nothing; the only path is
  `SUPABASE_SECRET_KEY` inside route handlers. Never put the secret key in
  client code or `NEXT_PUBLIC_*`.
- Env vars (Vercel + `.env.local`): `PIN_LOCK`, `SUPABASE_URL`,
  `SUPABASE_SECRET_KEY`.

## PWA checklist

- `viewport-fit=cover`; safe-areas: tab bar pads bottom, `Screen` and pushed
  detail views pad top. `100dvh`/`fixed inset-0` shell; `overscroll-behavior-y:
  none`.
- Icons `public/icons/`, splash `public/splash/` (generated — see scripts).
  Manifest name/short_name "Surplus", standalone, `#0A0A0B` everywhere.
- Service worker lands with M4 (workout logging must survive gym connectivity);
  it must NEVER cache Supabase responses — query persistence owns data.

## Milestone status

- [x] **M1 — shell + design system**: tokens, motion primitives, tab shell,
  all four panels on shared mock data, PWA manifest/icons/splash, `/design`
  gallery. Approved on-device; live at oneeightyfive.vercel.app.
- [x] **M2 — PIN gate + Supabase + Weight live**: `surplus` project + full
  schema (deny-all RLS), PIN lock screen + middleware + unlock cookie,
  TanStack Query + IndexedDB persistence, real weigh-ins (optimistic upsert,
  empty/loading states) + settings. Food/Lift/streaks still mock.
- [ ] **M3 — Nutrition live** (quick-add 2 taps, custom entry + save-as-meal,
  targets sheet + target_history, surplus celebration once/day, edit/delete,
  empty states)
- [ ] **M4 — Workout live** (picker + inline create, ghost prefill, PR/overload
  tiers, session volume chip, iPad two-pane, minimal service worker)
- [ ] **M5 — Dashboard/streaks + hardening** (real streak calc, sparkline,
  reduced-motion audit, offline polish)
