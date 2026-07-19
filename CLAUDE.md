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
  lucide-react · `@anthropic-ai/sdk` (food AI, server-only) · `@zxing/browser`
  (barcode scanning). Package manager: pnpm.
- `pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm start` · `npx vitest run`
  (unit tests in `src/lib/__tests__/`)
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
  **nothing is ever red** (muted `destructive` + `destructive-tint/border`
  appear only inside delete-confirmation swaps, `ui/confirm-swap.tsx`).
- Macro identity colors: `protein #A78BFA` (violet) · `carbs #0EA5E9` (sky) ·
  `fat #F472B6` (pink), each with a 12% tint and 28% border token. They are
  identity hues, NOT status — a macro bar never turns mint/red at any fill.
  Hitting the protein/fat floor draws a mint CheckDraw beside the label
  (that's a target-hit moment); carbs are a remainder and never get a check.
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

- **Everything is live — mock data is gone** (`lib/mock.tsx` deleted in M3).
  Every domain flows: panel → `hooks/use-*` (TanStack Query, optimistic
  mutations, IndexedDB persistence via `idb-keyval`) → `/api/*` route handlers
  (validators in `lib/api.ts`, camelCase JSON) → `lib/supabase/server.ts`
  (secret key, server-only). Components never call supabase or fetch directly;
  the canonical optimistic-mutation shape lives in `hooks/use-weight.ts` —
  food/set mutations refine it with targeted per-row rollback so a rollback
  never clobbers a concurrent log.
- Quick-add meals are never invalidated on log (no re-sort under the finger);
  `use_count` bumps are best-effort server-side. Set logging retries ×3 with
  backoff (gym connectivity); set numbers are server-assigned and keep gaps.
- **Offline write queue (M6)**: the three gym-critical creates carry
  mutationKeys (`log-weight`/`log-food`/`log-set`) registered in
  `lib/mutation-defaults.ts`. Fired offline they PAUSE (networkMode
  "online"), persist to IndexedDB (paused + registered key only, via
  `shouldPersistMutation`), and replay on the next launch through
  closure-free default mutationFns + `resumePausedMutations`. Invariant:
  these mutations' VARIABLES must fully self-describe the write — `date` and
  `loggedAt` ride in the variables (the hooks stamp them at mutate time),
  never in component closures. Edits/deletes/meals stay fail-and-rollback —
  replaying a stale edit is worse than losing it.
- Supabase project: `surplus` (`aqykznlpspuguvvoacpi`, us-west-1). Org was
  at the free 2-project limit — `alpha/delta` is PAUSED to make room; don't
  unpause it without asking the user.
- `getAppDate()` in `lib/dates.ts` is the ONLY source of "what day is it" —
  the app-day rolls over at 3 AM local (a 12:30 AM post-workout meal counts
  toward the waking day). Dates are local `YYYY-MM-DD` strings, always
  client-supplied — the server runs UTC and never guesses the day.
- Derived math is pure in `lib/stats.ts`: 7-day rolling average (mean of
  existing points in window, never interpolate); pace = `RA(latest) −
  RA(latest−7d)` scaled to lb/wk, needs ≥5 weigh-ins spanning ≥7d, on-pace band
  = goal ±0.25; `e1rm` = Epley with reps clamped at 12. Streaks/PRs are always
  derived, never stored.
- Streaks (`lib/streaks.ts`) count calorie-target days only, judged against
  `target_history` (the target that was live THAT day, via `targetFor`);
  today never breaks the streak mid-day; a missing day is a miss.
- PR/overload (`stats.ts classifySet`): PR = beats all-time server records
  (weighted lifts: max weight or max e1RM; bodyweight: max reps); overload =
  e1RM beats the positional ghost from last session. `serverRecords === null`
  means first-ever session — the whole day stays silent and sets baselines.
  Tiers per set: PR (gold badge) > overload win (mint ▲) > plain check. No
  haptics — `navigator.vibrate` doesn't exist on iOS. `GET
  /api/exercise-history/[id]` serves ghosts + records strictly BEFORE `today`
  so ghosts never chase themselves; records are computed at read time.
- `GET /api/day-summaries` is the one-round-trip history feed (per-day intake
  sums with entry counts, full `target_history`, distinct training dates) that
  powers streaks + the training-week chip via `hooks/use-day-summaries.ts`.
  It is closed-days-only — today's live numbers come from `['food-logs',
  today]`, never from this feed.

## Food capture + suggestions

- Five ways into the food entry sheet: catalog search, barcode scan, label
  photo, meal photo, and natural-language description (typed or voice).
  **Nothing ever auto-logs** — every capture result prefills the entry sheet
  for review first. Client hooks live in `hooks/use-food-capture.ts`; the
  mode picker UI is `components/food/food-capture.tsx`.
- Catalog (`GET /api/food-search`, pure mappers in `lib/food-catalog.ts`):
  Open Food Facts for text search + barcode lookup (no API key), USDA
  FoodData Central for text search (`USDA_API_KEY` optional — falls back to
  `DEMO_KEY` rate limits). USDA per-100g nutrients are scaled to household
  servings; products without serving data get a usable fallback serving.
  Search fires at ≥2 chars with 5-min staleTime.
- Food AI (`lib/food-ai.ts`) runs on **Anthropic structured outputs** —
  model `claude-sonnet-5` (`ANTHROPIC_FOOD_MODEL` overrides), effort `low`,
  strict JSON schema (no range keywords — the API rejects them; clamping
  lives in `normalizeAnalysis`). Three modes: `description`, `label` (one
  stated serving, never the package), `meal-photo` (confidence is never
  "high"). Routes `POST /api/food-ai/{describe,image}` export `maxDuration =
  60`; the client is 25s/attempt + 1 retry to fit inside it. A missing
  `ANTHROPIC_API_KEY` 503s (`FoodAiUnavailableError`) and the client toasts
  "Food AI isn't set up" instead of "retry".
- Voice: `components/food/voice-recorder.tsx` (MediaRecorder, 25s cap) →
  `POST /api/food-ai/transcribe` → OpenAI `gpt-4o-mini-transcribe`
  (Anthropic has no transcription API) → transcript feeds the describe flow.
  `OPENAI_API_KEY` is optional — without it only voice 503s; every other
  capture mode still works.
- Camera images are downscaled client-side before upload (`lib/image.ts`,
  max edge 1800px) — never send a full-res phone photo through a serverless
  function. The barcode scanner (`components/food/barcode-scanner.tsx`,
  `@zxing/browser`) starts the camera in a mount-only effect (it must not
  restart on parent re-renders) and always offers manual barcode entry.
- Predictive suggestions ("you usually log X around now"): ranking is pure in
  `lib/food-suggestions.ts` — 1–42 day window, frequency + recency +
  time-of-day + same-weekday scoring; identity key is `mealId` or normalized
  name; nutrition always comes from the LATEST matching log, so correcting an
  entry re-teaches future suggestions without rewriting history; "Quick add"
  entries are excluded. `GET /api/food-suggestions` takes client-supplied
  `date`/`hour`/`timezoneOffsetMinutes` (server never guesses local time).
  `POST /api/food-logs/batch` logs multi-item picks in one call.

## Plan engine (lib/plan.ts)

- The 13-step questionnaire (`/setup`, first-run gated by
  `profile.completed_at`) feeds `buildPlan`, which is **server-authoritative**:
  `PUT /api/profile` recomputes the plan server-side and applies targets via
  the `apply_targets` RPC (atomic settings + `target_history` +
  `plan_events` write). The client runs the same pure function only to
  preview in `components/setup/plan-reveal.tsx`.
- BMR = Mifflin-St Jeor, blended 50/50 with Katch-McArdle when body-fat% is
  known. TDEE is decomposed: NEAT factor (1.35/1.50/1.65/1.85) × BMR +
  MET-based training add-ons (lift 4.0 × kg × hrs, cardio 5.0 × kg × hrs).
- Gain rate = %BW/month table by training tier (novice <12mo / intermediate
  12–36 / advanced >36, advancing automatically from `training_months_as_of`)
  × bulk style; surplus/lb from p-ratio (leaner gains are cheaper); +250 kcal
  floor while BMI < 18.5. **Never cut a bulker**: computed target below the
  current one is floored unless weight pace is already "ahead".
- Protein 0.80–0.95 g/lb by appetite (1.05 × LBM when BF ≥ 25%); fat =
  max(25–30% kcal, 0.3 g/lb) capped at 40%; carbs = remainder with a 3 g/kg
  floor. Observed TDEE (from logged intake + weight trend, ≥"logged day"
  quality gates) blends into the formula confidence-weighted, clamped ±25%.
- Projection = weekly simulation with tier taper; goal ≤ current weight puts
  the plan in maintenance mode instead of bricking. 46 vitest tests pin the
  numbers (`src/lib/__tests__/` — plan, streaks, recalibration, food-catalog,
  food-suggestions) — run `npx vitest run` after touching any pure-math lib.
- Recalibration UI ("your real TDEE looks like X — apply?") lives on Today
  (`components/today/recalibration-card.tsx`): `GET /api/recalibration`
  reruns `buildPlan` server-side with the observed blend and returns a
  suggestion; the cadence gate is pure in `lib/recalibration.ts` (≥100 kcal
  delta, 14-day cooldown after any `plan_event`). Apply goes through the same
  `apply_targets` RPC (`action='applied'`, `observed_tdee` recorded); "Not
  now" posts a `dismissed` event — both restart the clock.

## Auth invariants

- **No Supabase Auth, no email.** A 4-digit PIN gate: `/lock` (design-language
  PIN pad, time-of-day greeting from the profile name cached in localStorage)
  → `POST /api/unlock` compares against the `PIN_LOCK` env var
  (constant-time) and sets a year-long httpOnly cookie whose value is
  `HMAC-SHA256(key=PIN, "surplus-unlock-v1")` — rotating `PIN_LOCK` logs out
  every device. `middleware.ts` gates every page and API route (pages →
  redirect `/lock`, APIs → 401); PWA chrome (manifest/icons/splash) stays
  public so install works. If `PIN_LOCK` is unset the gate stays open
  (bootstrap mode) — data routes still fail without the secret key.
- **Database access is server-only**: RLS is enabled on every table with ZERO
  policies, so the publishable/anon key can do nothing; the only path is
  `SUPABASE_SECRET_KEY` inside route handlers. Never put the secret key in
  client code or `NEXT_PUBLIC_*`. The `apply_targets` RPC is pinned
  (`search_path = ''`) with EXECUTE revoked from anon/authenticated/public.
- Env vars (Vercel + `.env.local`): required — `PIN_LOCK`, `SUPABASE_URL`,
  `SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`; optional —
  `ANTHROPIC_FOOD_MODEL`, `OPENAI_API_KEY` (voice transcription only),
  `USDA_API_KEY`. All provider keys are server-only — never `NEXT_PUBLIC_*`.

## PWA checklist

- `viewport-fit=cover`; safe-areas: tab bar pads bottom, `Screen` and pushed
  detail views pad top; `overscroll-behavior-y: none`.
- **iOS standalone viewport (hard-won — don't "simplify"):** `html`/`body`
  are `height: 100vh` — NOT `100%`, NOT `100dvh` (both reproduce the
  cold-start letterbox where the tab bar is clipped). The app shell is
  `height: var(--app-height, 100vh)`; `shell/app-height.tsx` publishes live
  `window.innerHeight` (plus `visualViewport` resize) as `--app-height`.
  Never size the shell to `window.screen.*` — iOS refuses to paint below its
  viewport line, so the paintable region is the only truth.
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
- [x] **M3 — fully functional, zero mock**: onboarding questionnaire (13
  steps) + plan engine + plan reveal, full-macro nutrition (quick-add,
  custom entry + save-as-meal, edit/delete + Undo, macro grid), live workout
  logging (ghost prefill, PR/overload tiers, first-session baselines,
  edit/archive), real streaks vs `target_history`, `plan_events` +
  recalibration math (UI in M4), unit tests.
- [x] **M4 — Workout polish + recalibration UI**: searchable exercise picker
  with inline create (type-to-create, no separate sheet), today's session
  volume chip on Lift + per-exercise chip in the detail, "your real TDEE"
  recalibration card on Today (`/api/recalibration` + `lib/recalibration.ts`
  cadence), iPad two-pane lift list/detail, minimal gym-connectivity service
  worker (`public/sw.js`, shell + static only, never caches data).
- [x] **M5 — Dashboard/streaks + hardening**: streak sparkline on Today
  (`charts/streak-rail.tsx` + pure `streakSeries` in `lib/streaks.ts`, mint =
  target-hit day), once-a-day surplus celebration (`today/surplus-celebration
  .tsx`, body-portaled so it shows over any tab, localStorage-guarded per
  app-day, degrades under reduced motion), reduced-motion audit (rail +
  celebration + offline pill all honor `useReducedMotion`), offline polish
  (`use-online-status` + shell `OfflineIndicator` pill; SW already shells the
  app for gym Wi-Fi).
- [x] **Post-M5 — food capture + iOS fixes** (merged via PRs #7–#17):
  predictive fast logging (`lib/food-suggestions.ts` + suggestions API),
  universal food search + barcode/label/photo/voice capture (Open Food
  Facts + USDA catalog, AI analysis), food AI migrated from OpenAI to
  Anthropic `claude-sonnet-5` (voice transcription stays on OpenAI), iOS
  standalone-PWA viewport fixes (`100vh` root + `--app-height` shell,
  `shell/app-height.tsx`), barcode serving-size fallbacks. Tests now 46.
- [x] **M6 — plan view + progression analytics + offline queue**: gear
  drill-in on Today (`components/plan/plan-view.tsx`) — targets/goal/pace
  editable via the previously-dormant `useUpdateSettings`, profile edits
  rebuild the plan through `PUT /api/profile` (always send the
  self-advanced `effectiveTrainingMonths` — the PUT re-stamps its as-of
  date), live "why these numbers" rationale from client `buildPlan`, and
  the `plan_events` audit list (`GET /api/plan-events` now returns newest-
  first rows). Lift progression: `lift/exercise-trend.tsx` charts the
  history feed's previously-discarded `recent` (top-set e1RM, strictly
  before today), fills the iPad idle pane, and the Today lift tile gained
  volume/last-session context. Nutrition history on Food
  (`food/nutrition-history.tsx` + pure `lib/history.ts`: closed days only,
  gaps never zero-filled, guide = stepwise `target_history`) and a dashed
  goal-rate guide on the Weight chart (`projectionGuide` in `lib/stats.ts`;
  `LineChart` grew backwards-compatible `color`/`guide` props). Offline
  write queue per the Data rules bullet. `CACHE_BUSTER` → v3 (day-summaries
  shape + mutation persistence). `pnpm test` script added. Tests 171.
