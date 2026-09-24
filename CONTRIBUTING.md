# Contributing

Thanks for helping improve this template! It aims to stay a **small, readable,
store-agnostic starting point** — not a framework. Contributions that keep it
that way are very welcome.

## Ground rules

- **No store-specific values in code.** Anything that varies per merchant goes in
  `.env` / `.env.example` and is read via `src/shopify/env.ts` or `app.config.ts`.
- Keep dependencies lean. New runtime deps need a clear justification in the PR.
- Match the existing style: TypeScript strict, functional components, React
  Query for server state, design tokens from `src/constants/theme.ts`.
- The React Compiler is enabled — avoid manual memoization that fights it, and
  don't call `setState` synchronously inside an effect body.
- **No test files under `src/app/`.** Expo Router treats every file in
  `src/app/` as a route module, so a `*.test.tsx` there gets bundled as a
  screen. Tests for a route's logic live alongside the module it exercises —
  route-specific behavior lives in `src/components/commerce/*-routes.test.tsx`
  (e.g. `account-routes.test.tsx`, `discovery-routes.test.tsx`,
  `conversion-routes.test.tsx`, `saved-route.test.tsx`).
- **Optional integrations must no-op without their env var(s)**, and add any
  native config plugin **conditionally** (only when configured) — see
  [docs/architecture.md](docs/architecture.md#optional-integrations-pattern).
  If you add a new env var, add it in all three places: `.env.example`,
  `src/shopify/env.ts` (or wherever the module reads it), and
  `scripts/env-rules.cjs` if `check:env` should validate it.

## Dev setup

```sh
npm install
cp .env.example .env      # fill in a test store (see docs/shopify-setup.md), or leave it — demo mode works with no store
eas build --profile development --platform android   # one-time dev client
npm start
```

## Before you open a PR

```sh
npm run verify        # typecheck && lint && test
npx expo-doctor
```

If you touched `.env.example`, `src/shopify/env.ts`, or `scripts/env-rules.cjs`,
also run `npm run check:env` against a copy of `.env.example` to confirm it
still reports the expected errors/warnings for an unconfigured store.

For anything touching cart, checkout, catalog, or wishlist behavior, run the
Maestro smoke flows against a dev/preview build — see
[docs/e2e.md](docs/e2e.md):

```sh
npm run e2e
```

Describe what you changed and how you tested it on a device or simulator.
Screenshots for anything visual.

### Commit style

Recent history favors short, imperative commit subjects, optionally scoped —
`feat(cart): discount code UI`, `fix: clear the local cart when the sign-out
guest rebuild fails`, `docs: …`, `test: …`, `chore: …`. Not strictly enforced,
but keeping to it makes `git log` and `CHANGELOG.md` easier to maintain.

## Reporting bugs

Open an issue with the template, your platform (iOS/Android), Expo SDK version,
and repro steps. Please confirm it happens with a clean `.env` from
`.env.example` (or in demo mode) where possible.
