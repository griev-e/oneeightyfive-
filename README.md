# Surplus

A personal fitness PWA with one mission: **hit a calorie surplus every day and
progressively overload in the gym.** Built for exactly one user, designed to
the bar of "would Robinhood / Vercel / Linear / Apple ship this?"

Dark, near-black UI · one mint accent reserved for "target hit" moments · big
tabular hero numerals · spring-based motion throughout · installable on iPhone
as a standalone app.

## Stack

Next.js (App Router) · TypeScript · Tailwind v4 · motion (Framer Motion) ·
vaul · Geist · Supabase (from M2) · Vercel

## Develop

```sh
pnpm install
pnpm dev          # http://localhost:3000
pnpm build && pnpm start
node scripts/generate-assets.mjs   # regenerate icons + iOS splash screens
```

`.env.local` (the first three are required on Vercel):

```
PIN_LOCK=….............# the 4-digit unlock PIN
SUPABASE_URL=https://aqykznlpspuguvvoacpi.supabase.co
SUPABASE_SECRET_KEY=…  # Supabase dashboard → Settings → API keys (secret)
OPENAI_API_KEY=…       # label/photo/description/voice meal capture
OPENAI_FOOD_MODEL=gpt-5.6-terra  # optional override
USDA_API_KEY=…         # optional; raises USDA search limits above DEMO_KEY
```

Open Food Facts search and barcode lookup require no API key. All provider
credentials remain server-only and must never use a `NEXT_PUBLIC_` prefix.

`/design` is a hidden gallery of tokens, type, and motion primitives.

## Status

M1 (shell + design system), M2 (PIN lock, Supabase, live weight tracking), and
M3 (onboarding questionnaire + plan engine, live nutrition with full macros,
live workout logging with PR/overload detection, real streaks) are done. Mock
data is gone — every number in the app is yours. M4 (recalibration UI, iPad
two-pane, service worker) and M5 (dashboard polish) remain. Conventions, data
model, and the milestone plan live in [CLAUDE.md](./CLAUDE.md).
