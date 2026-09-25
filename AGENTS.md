# Notes for AI coding agents

- This is an **Expo SDK 57** project. APIs changed a lot in recent SDKs — check
  the versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing
  native or config code.
- All store-specific configuration lives in `.env` (see `.env.example`) and is
  read through `src/shopify/env.ts` and `app.config.ts`. Don't hard-code store
  names, domains, colours, bundle ids, or URLs anywhere else.
- Routes live in `src/app/` (Expo Router, typed routes on). App code lives in
  `src/`; only screens/layouts go in `src/app/` — **no test files there**
  (Expo Router bundles every file in `src/app/` as a route). Tests for a
  route's logic live in `src/components/commerce/*-routes.test.tsx` instead.
- Optional integrations (accounts, push, analytics, crash reporting,
  accelerated checkout) must **no-op without their env var(s)** and add any
  native config plugin **conditionally** in `app.config.ts` — see
  `docs/architecture.md#optional-integrations-pattern`. Add any new env var in
  all three places: `.env.example`, `src/shopify/env.ts`, and
  `scripts/env-rules.cjs`.
- Before committing: `npm run verify` (`typecheck && lint && test`).
