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
pnpm build && pnpm start   # build also stamps public/sw.js from scripts/sw.template.js
pnpm test && pnpm lint && pnpm typecheck
node scripts/generate-assets.mjs   # regenerate icons + iOS splash screens
```

`.env.local` (the first three are required on Vercel):

```
PIN_LOCK=….............# the 4-digit unlock PIN
SUPABASE_URL=https://aqykznlpspuguvvoacpi.supabase.co
SUPABASE_SECRET_KEY=…  # Supabase dashboard → Settings → API keys (secret)
ANTHROPIC_API_KEY=…    # label/photo/description meal capture (Claude)
ANTHROPIC_FOOD_MODEL=claude-sonnet-5  # optional override
OPENAI_API_KEY=…       # optional; voice transcription only — Anthropic has no transcription API
USDA_API_KEY=…         # optional; raises USDA search limits above DEMO_KEY
```

Open Food Facts search and barcode lookup require no API key. All provider
credentials remain server-only and must never use a `NEXT_PUBLIC_` prefix.

`/design` is a hidden gallery of tokens, type, and motion primitives.

## Status

Milestones M1–M7 are complete: shell + design system, PIN lock + Supabase,
fully live data (zero mock), workout polish + recalibration, dashboard +
streaks, universal food capture (search/barcode/label/photo/voice), plan
view + offline write queue, and M7's weekly insights (volume, adherence,
goal projection) + gym QoL (rest timer, per-set RPE/notes) + hardening
(deploy-versioned service worker, weigh-in corrections, settings/plan-event
decoupling). Conventions, data model, and the milestone ledger live in
[CLAUDE.md](./CLAUDE.md).
