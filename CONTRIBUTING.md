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

## Dev setup

```sh
npm install
cp .env.example .env      # fill in a test store (see docs/shopify-setup.md)
eas build --profile development --platform android   # one-time dev client
npm start
```

## Before you open a PR

```sh
npm run typecheck
npm run lint
npx expo-doctor
```

Describe what you changed and how you tested it on a device or simulator.
Screenshots for anything visual.

## Reporting bugs

Open an issue with the template, your platform (iOS/Android), Expo SDK version,
and repro steps. Please confirm it happens with a clean `.env` from
`.env.example` where possible.
