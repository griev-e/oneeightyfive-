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

`/design` is a hidden gallery of tokens, type, and motion primitives.

## Status

Milestone 1 (app shell + design system on live mock data) is complete and
deployed for on-device review. The full design system, conventions, data
model, and milestone plan live in [CLAUDE.md](./CLAUDE.md).
